// Checks a POST /v2/posts body against the rules in Blotato's docs BEFORE it is sent.
// Most "my post didn't go out" tickets come from a handful of payload mistakes;
// catching them locally turns a support ticket into a one-line fix.

export type Severity = "error" | "warning";

export interface Finding {
  severity: Severity;
  path: string;
  message: string;
  fix: string;
}

export const PLATFORMS = [
  "twitter",
  "instagram",
  "linkedin",
  "facebook",
  "tiktok",
  "pinterest",
  "threads",
  "bluesky",
  "youtube",
] as const;

const TIKTOK_PRIVACY = ["SELF_ONLY", "PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "FOLLOWER_OF_CREATOR"];
const TIKTOK_BOOLEANS = ["disabledComments", "disabledDuet", "disabledStitch", "isBrandedContent", "isYourBrand", "isAiGenerated"];
const YT_PRIVACY = ["private", "public", "unlisted"];
const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
const VIDEO_EXT = /\.(mp4|mov|m4v|webm)(\?|$)/i;

const isObj = (v: unknown): v is Record<string, any> => typeof v === "object" && v !== null && !Array.isArray(v);

export function validatePost(body: unknown, now: Date = new Date()): Finding[] {
  const f: Finding[] = [];
  const err = (path: string, message: string, fix: string) => f.push({ severity: "error", path, message, fix });
  const warn = (path: string, message: string, fix: string) => f.push({ severity: "warning", path, message, fix });

  if (!isObj(body)) {
    err("$", "Body must be a JSON object.", 'Send {"post": {...}} as the request body.');
    return f;
  }
  const post = body.post;
  if (!isObj(post)) {
    if (isObj(body.content) || "accountId" in body) {
      err("$", "The post fields are at the top level; Blotato expects them inside a \"post\" object.", 'Wrap them: {"post": {"accountId": ..., "content": ..., "target": ...}}.');
    } else {
      err("post", "Missing required \"post\" object.", 'Add {"post": {"accountId": ..., "content": ..., "target": ...}}.');
    }
    return f;
  }

  // The single most expensive mistake: scheduling fields nested inside post are ignored,
  // so the post goes out immediately instead of at the planned time.
  for (const k of ["scheduledTime", "useNextFreeSlot"]) {
    if (k in post) {
      err(`post.${k}`, `"${k}" is inside "post". Blotato ignores it there and publishes the post immediately.`, `Move "${k}" to the root of the body, next to "post".`);
    }
  }
  if ("scheduledTime" in body && body.useNextFreeSlot === true) {
    err("$", "Both scheduledTime and useNextFreeSlot are set.", "Use one scheduling method only.");
  }
  if ("scheduledTime" in body) {
    const st = body.scheduledTime;
    if (typeof st !== "string" || !ISO_WITH_OFFSET.test(st)) {
      err("scheduledTime", `scheduledTime "${String(st)}" is not ISO 8601 with a timezone.`, 'Use a full timestamp with Z or an offset, e.g. "2026-12-01T09:00:00-08:00".');
    } else if (new Date(st).getTime() < now.getTime()) {
      warn("scheduledTime", `scheduledTime ${st} is in the past.`, "Pick a future time, or drop scheduledTime to publish now.");
    }
  }

  // accountId
  if (post.accountId === undefined || post.accountId === null || post.accountId === "") {
    err("post.accountId", "Missing accountId.", "Get it from GET /v2/users/me/accounts (items[].id).");
  } else if (typeof post.accountId === "number") {
    warn("post.accountId", "accountId is a number; the docs use a string.", `Send it as a string: "${post.accountId}".`);
  }

  // content
  const content = post.content;
  if (!isObj(content)) {
    err("post.content", "Missing content object.", 'Add "content": {"text": "...", "mediaUrls": [], "platform": "..."}.');
    return f;
  }
  if (typeof content.text !== "string") {
    err("post.content.text", "content.text must be a string.", 'Use "" if the post is media only.');
  }
  if (!Array.isArray(content.mediaUrls)) {
    if (typeof content.mediaUrls === "string") {
      err("post.content.mediaUrls", "mediaUrls is a string; it must be an array.", `Wrap it: ["${content.mediaUrls}"].`);
    } else {
      err("post.content.mediaUrls", "mediaUrls is required and must be an array.", "Send [] when there is no media.");
    }
  }
  const platform = content.platform;
  const media: string[] = Array.isArray(content.mediaUrls) ? content.mediaUrls.filter((u: unknown) => typeof u === "string") : [];
  media.forEach((u, i) => checkMediaUrl(u, `post.content.mediaUrls[${i}]`, err, warn));

  // target
  const target = post.target;
  if (!isObj(target)) {
    err("post.target", "Missing target object.", `Add "target": {"targetType": "${platform ?? "<platform>"}"}.`);
    return f;
  }

  if (platform === "other" || target.targetType === "webhook") {
    if (platform !== "other") err("post.content.platform", 'Webhook posts need content.platform "other".', 'Set content.platform to "other".');
    if (target.targetType !== "webhook") err("post.target.targetType", 'content.platform "other" needs targetType "webhook".', 'Set target.targetType to "webhook".');
    if (typeof target.url !== "string") err("post.target.url", "Webhook target needs a url.", 'Add "url": "https://your-endpoint".');
    return f;
  }

  if (!PLATFORMS.includes(platform)) {
    err("post.content.platform", `Unknown platform "${String(platform)}".`, `Use one of: ${PLATFORMS.join(", ")}.`);
    return f;
  }
  if (target.targetType !== platform) {
    err("post.target.targetType", `targetType "${String(target.targetType)}" does not match content.platform "${platform}".`, `Set target.targetType to "${platform}".`);
  }

  switch (platform) {
    case "twitter":
      if (typeof content.text === "string" && content.text.length > 280 && !Array.isArray(content.additionalPosts)) {
        warn("post.content.text", `Text is ${content.text.length} characters; standard X accounts cap at 280.`, "Shorten it, or split it into a thread with content.additionalPosts.");
      }
      break;
    case "facebook":
      if (!target.pageId) err("post.target.pageId", "Facebook posts need target.pageId.", "Get it from GET /v2/users/me/accounts/{accountId}/subaccounts (items[].id).");
      if (target.mediaType && !["reel", "story"].includes(target.mediaType)) err("post.target.mediaType", `Facebook mediaType "${target.mediaType}" is not valid.`, 'Use "reel", "story", or leave it out.');
      break;
    case "pinterest":
      if (!target.boardId) err("post.target.boardId", "Pinterest posts need target.boardId.", "Get it from GET /v2/social/pinterest/boards?accountId=...");
      if (media.length === 0) warn("post.content.mediaUrls", "Pinterest pins need an image or video.", "Add a public media URL.");
      break;
    case "tiktok":
      if (!TIKTOK_PRIVACY.includes(target.privacyLevel)) err("post.target.privacyLevel", `TikTok privacyLevel "${String(target.privacyLevel)}" is missing or invalid.`, `Use one of: ${TIKTOK_PRIVACY.join(", ")}.`);
      for (const b of TIKTOK_BOOLEANS) {
        if (typeof target[b] !== "boolean") err(`post.target.${b}`, `TikTok requires ${b} (true or false).`, `Add "${b}": false (or true).`);
      }
      if (media.length === 0) err("post.content.mediaUrls", "TikTok posts need a video (or photos).", "Add a public video URL to mediaUrls.");
      break;
    case "youtube":
      if (typeof target.title !== "string" || !target.title) err("post.target.title", "YouTube posts need target.title.", "Add a video title.");
      if (!YT_PRIVACY.includes(target.privacyStatus)) err("post.target.privacyStatus", `YouTube privacyStatus "${String(target.privacyStatus)}" is missing or invalid.`, `Use one of: ${YT_PRIVACY.join(", ")}.`);
      if (typeof target.shouldNotifySubscribers !== "boolean") err("post.target.shouldNotifySubscribers", "YouTube requires shouldNotifySubscribers (true or false).", 'Add "shouldNotifySubscribers": false.');
      if (media.length === 0) err("post.content.mediaUrls", "YouTube posts need a video.", "Add a public video URL to mediaUrls.");
      else if (!media.some((u) => VIDEO_EXT.test(u))) warn("post.content.mediaUrls", "None of the media URLs looks like a video file.", "Check the URL points to an .mp4/.mov file, not a web page.");
      break;
    case "instagram":
      if (media.length === 0) err("post.content.mediaUrls", "Instagram posts need at least one image or video.", "Add a public media URL.");
      if (media.length > 10) warn("post.content.mediaUrls", `${media.length} media items; Instagram carousels allow up to 10.`, "Trim to 10.");
      break;
    case "linkedin":
      if (media.length > 10) warn("post.content.mediaUrls", `${media.length} images; LinkedIn carousels take 2 to 10.`, "Trim to 10.");
      break;
  }
  return f;
}

function checkMediaUrl(
  u: string,
  path: string,
  err: (p: string, m: string, fix: string) => void,
  warn: (p: string, m: string, fix: string) => void,
) {
  if (/^(file:|\/Users\/|\/home\/|~\/|[A-Za-z]:\\)/.test(u)) {
    err(path, `"${u}" is a local file path. Blotato can only fetch public URLs.`, "Upload it first: POST /v2/media/uploads gives a presignedUrl to PUT the file to, then use the returned publicUrl.");
    return;
  }
  if (!/^https?:\/\//i.test(u)) {
    err(path, `"${u}" is not a URL.`, "Use a public https:// URL.");
    return;
  }
  const drive = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([\w-]+)/);
  if (drive) {
    err(path, "This is a Google Drive share page, not the file itself, so Blotato gets HTML back.", `Use https://drive.usercontent.google.com/download?id=${drive[1]}&export=download&confirm=t and make sure the file is shared as "Anyone with the link".`);
    return;
  }
  if (/dropbox\.com\/.*[?&]dl=0/.test(u)) {
    err(path, "Dropbox link with dl=0 opens a preview page, not the file.", "Change dl=0 to dl=1.");
    return;
  }
  if (/^http:\/\//i.test(u)) warn(path, "Media URL uses http, not https.", "Use an https URL if the host supports it.");
  if (/(localhost|127\.0\.0\.1|192\.168\.|\.local\/)/.test(u)) err(path, "This URL only works on your own network.", "Host the file somewhere public, or use the presigned upload flow.");
}

export function summarize(findings: Finding[]): string {
  if (findings.length === 0) return "No problems found. This payload matches Blotato's documented rules.";
  const errors = findings.filter((x) => x.severity === "error").length;
  const warnings = findings.length - errors;
  const head = `${errors} error(s), ${warnings} warning(s).`;
  return [head, ...findings.map((x) => `- [${x.severity}] ${x.path}: ${x.message} Fix: ${x.fix}`)].join("\n");
}
