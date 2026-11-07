// Turns a Blotato error (status code, error body, or a customer's pasted message)
// into: what happened, how to fix it, whether to escalate, and a reply a support agent can send.

export interface Explanation {
  id: string;
  title: string;
  cause: string;
  fix: string[];
  escalate: boolean;
  customerReply: string;
}

interface Rule {
  id: string;
  test: (s: { status?: number; text: string; code?: number }) => boolean;
  build: (s: { status?: number; text: string; code?: number }) => Omit<Explanation, "id">;
}

const RULES: Rule[] = [
  {
    id: "auth-401",
    test: (s) => s.status === 401 || /\b401\b|invalid api key|unauthori[sz]ed/i.test(s.text),
    build: () => ({
      title: "API key rejected (401)",
      cause: "The blotato-api-key header is missing or does not match a key. The usual cause is a copy-paste that dropped the trailing \"=\" or added a space, quote or \"Bearer \" prefix.",
      fix: [
        "Copy the key again from https://my.blotato.com/settings/api, including any \"=\" at the end.",
        "Send it as the header blotato-api-key (not Authorization) for the REST API.",
        "Test with GET https://backend.blotato.com/v2/users/me before anything else.",
      ],
      escalate: false,
      customerReply:
        "Thanks for flagging this! A 401 means Blotato didn't recognize the API key. Most of the time a character got lost when copying it, especially an \"=\" at the very end. Could you copy the key again from Settings > API (all of it), paste it into the blotato-api-key header, and try once more? If it still fails, send me the time of the request and I'll look it up in our logs.",
    }),
  },
  {
    id: "plan-403",
    test: (s) => s.status === 403 || /subscription|paid plan|trial/i.test(s.text),
    build: () => ({
      title: "Plan does not include API access (403)",
      cause: "The API and MCP are for paid plans only (Starter and up). Free trials have no API access.",
      fix: [
        "Check the plan on https://my.blotato.com/settings/billing.",
        "Generating an API key under Settings > API ends the free trial and starts the paid Starter plan; tell the customer this before they click.",
      ],
      escalate: false,
      customerReply:
        "Good question! API and MCP access are part of the paid plans (Starter and up), so they don't work during the free trial. Heads up: generating an API key in Settings > API ends the trial and starts Starter right away, so only do that when you're ready.",
    }),
  },
  {
    id: "rate-429",
    test: (s) => s.status === 429 || /rate limit/i.test(s.text),
    build: (s) => {
      const secs = s.text.match(/retry in (\d+)/i)?.[1];
      return {
        title: "Rate limit hit (429)",
        cause: `Each route has its own per-minute limit (create post 30/min, status checks 60/min, media from URL 30/min).${secs ? ` The server asked to wait ${secs} seconds.` : ""}`,
        fix: [
          `Stop calling that route and wait${secs ? ` ${secs} seconds` : " for the interval in the response"}.`,
          "When polling post status, wait at least 10 seconds between checks.",
          "In n8n, add a Wait node or batch items instead of looping as fast as possible.",
        ],
        escalate: false,
        customerReply: `You're sending requests a little faster than that endpoint allows${secs ? ` (it asked to wait ${secs} seconds)` : ""}. Adding a short pause between calls fixes it, and for status checks every 10 seconds is plenty. Nothing was lost; you can retry after the wait.`,
      };
    },
  },
  {
    id: "media-90009",
    test: (s) => s.code === 90009 || /90009|could not fetch the media/i.test(s.text),
    build: () => ({
      title: "Blotato could not download the media (90009)",
      cause: "The media URL needs a sign-in, points to a preview page (Google Drive, Dropbox dl=0), or has expired.",
      fix: [
        "Open the URL in a private browser window. It should download or show the raw file with no sign-in.",
        "Google Drive: use https://drive.usercontent.google.com/download?id=FILE_ID&export=download&confirm=t and share as Anyone with the link.",
        "Local files: use POST /v2/media/uploads, PUT the file to presignedUrl, then post publicUrl.",
      ],
      escalate: false,
      customerReply:
        "The post failed because Blotato couldn't download the file from that link. Usually the link opens a preview page or needs a login. If it's on Google Drive, set sharing to \"Anyone with the link\" and use the direct-download form of the link (I can convert it for you). Then try again.",
    }),
  },
  {
    id: "unsupported-media",
    test: (s) => /unsupported media type/i.test(s.text),
    build: () => ({
      title: "Unsupported media type",
      cause: "The file type or format is not accepted by the destination platform, or the URL returns HTML instead of the file.",
      fix: [
        "Check the URL returns the raw file (Content-Type image/* or video/*), not a web page.",
        "Use MP4 (H.264) for video and JPG or PNG for images.",
      ],
      escalate: false,
      customerReply:
        "That platform didn't accept the file format. MP4 for video and JPG or PNG for images work best. If the link opens a web page instead of the file itself, that also causes this message. Could you send me the link so I can check which one it is?",
    }),
  },
  {
    id: "template-404",
    test: (s) => /unknown template id/i.test(s.text),
    build: () => ({
      title: "Unknown template ID",
      cause: "templateId does not match a premade template. IDs are full paths, like /base/v2/image-slideshow/<uuid>/v1.",
      fix: ["List templates with GET /v2/videos/templates?fields=id,name,description,inputs and copy the id exactly."],
      escalate: false,
      customerReply:
        "That template ID doesn't match one of our templates. The ID is the full path, so copy it exactly from the templates list (GET /v2/videos/templates). Want me to look up the right one for the template you're after?",
    }),
  },
  {
    id: "connection-422",
    test: (s) => s.status === 422 || /expired|reconnect/i.test(s.text),
    build: () => ({
      title: "Social account connection expired (422)",
      cause: "The Facebook or LinkedIn login behind this account has expired, so Blotato cannot list its pages or post to it.",
      fix: ["Reconnect the account at https://my.blotato.com/settings, then retry."],
      escalate: false,
      customerReply:
        "Your connection to that account has expired, which happens with Facebook and LinkedIn from time to time. Please reconnect it in Blotato's settings and try again. Your posts and settings stay as they are.",
    }),
  },
  {
    id: "not-found-404",
    test: (s) => s.status === 404,
    build: () => ({
      title: "Not found (404)",
      cause: "The accountId or ID in the path does not exist for this key, or the URL path is wrong (for example a missing /v2).",
      fix: ["Check the base URL is https://backend.blotato.com/v2.", "Re-list accounts with GET /v2/users/me/accounts and use items[].id."],
      escalate: false,
      customerReply:
        "We couldn't find that account or item under your API key. Could you double-check the accountId against the list from GET /v2/users/me/accounts, and that the URL starts with https://backend.blotato.com/v2? If it still doesn't match, send me the request and I'll take a look.",
    }),
  },
  {
    id: "wrong-host",
    test: (s) => /api\.blotato\.com|ENOTFOUND|getaddrinfo/i.test(s.text),
    build: () => ({
      title: "Wrong API host",
      cause: "api.blotato.com is not a valid base URL.",
      fix: ["Use https://backend.blotato.com/v2."],
      escalate: false,
      customerReply: "Quick fix: the API lives at https://backend.blotato.com/v2 (not api.blotato.com). Swap the base URL and you should be good.",
    }),
  },
  {
    id: "published-immediately",
    test: (s) => /(posted|published|went out).*(immediately|right away|instead of|too early)|ignored.*schedul/i.test(s.text),
    build: () => ({
      title: "Post published immediately instead of on schedule",
      cause: "scheduledTime (or useNextFreeSlot) was placed inside the \"post\" object. Blotato only reads it at the root of the body, so the post went out right away.",
      fix: ['Move scheduledTime to the top level: {"post": {...}, "scheduledTime": "2026-12-01T09:00:00-08:00"}.'],
      escalate: false,
      customerReply:
        "I see what happened: scheduledTime was inside the \"post\" object, where Blotato ignores it, so the post went out right away. Move scheduledTime up one level so it sits next to \"post\" and it'll schedule as expected. Sorry for the surprise!",
    }),
  },
  {
    id: "stuck-in-progress",
    test: (s) => /in-progress|stuck|still processing|pending forever/i.test(s.text),
    build: () => ({
      title: "Post stuck at in-progress",
      cause: "Either it is still publishing (video can take a while), or the postSubmissionId is wrong: an ID that matches nothing also returns in-progress.",
      fix: [
        "Confirm the postSubmissionId is the one returned by POST /v2/posts.",
        "Poll no faster than every 10 seconds; stop at published or failed.",
        "Check https://my.blotato.com/posts?status=failed and https://my.blotato.com/logs.",
        "If a valid ID is in-progress for over an hour, escalate with the ID.",
      ],
      escalate: true,
      customerReply:
        "Let's check two things. First, make sure you're checking the exact postSubmissionId the API returned (any ID that doesn't match also shows \"in-progress\"). Second, video posts can take a little while. If it's the right ID and it's been more than an hour, send it to me and I'll escalate it right away.",
    }),
  },
  {
    id: "server-9999",
    test: (s) => s.code === 9999 || (s.status !== undefined && s.status >= 500) || /9999|unknown error/i.test(s.text),
    build: () => ({
      title: "Unknown server error (9999 / 5xx)",
      cause: "Something failed on Blotato's side.",
      fix: ["Retry once after a minute.", "If it repeats, escalate with the time, endpoint and request body (key removed)."],
      escalate: true,
      customerReply:
        "Sorry about that, this one is on our side. Please try once more in a minute. If it happens again, I've got what I need to escalate it to engineering and I'll update you as soon as I hear back.",
    }),
  },
];

export function explainError(input: { status?: number; body?: unknown; message?: string }): Explanation[] {
  const bodyText = input.body === undefined ? "" : typeof input.body === "string" ? input.body : JSON.stringify(input.body);
  const text = [input.message ?? "", bodyText].join(" ").trim();
  let code: number | undefined;
  if (typeof input.body === "object" && input.body !== null && typeof (input.body as any).code === "number") code = (input.body as any).code;
  const signal = { status: input.status, text, code };
  const hits = RULES.filter((r) => r.test(signal)).map((r) => ({ id: r.id, ...r.build(signal) }));
  if (hits.length) return hits;
  return [
    {
      id: "unknown",
      title: "Not a known pattern",
      cause: "This error does not match any known Blotato issue.",
      fix: [
        "Collect: endpoint, time (with timezone), status code, response body, request body with the key removed.",
        "Check https://my.blotato.com/logs for the request.",
      ],
      escalate: true,
      customerReply:
        "Thanks for the details! I haven't seen this exact error before, so I'm passing it to engineering with everything you sent. I'll follow up as soon as I have an answer.",
    },
  ];
}
