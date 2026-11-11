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
  test: (s: { status?: number; text: string; code?: number; bodyText?: string }) => boolean;
  build: (s: { status?: number; text: string; code?: number; bodyText?: string }) => Omit<Explanation, "id">;
}

// Shared vocabulary for the media rules (added 2026-11-10 from the real-ticket replay, docs/replay-results.md).
const MEDIA_NOUN = String.raw`(media|image|video|photo|file)s?`;
const FAILS = String.raw`(fail\w*|reject\w*|died|break\w*|broke|won'?t (take|accept|load))`;

const RULES: Rule[] = [
  // Added 2026-11-10 from the replay: paying customers locked out. Before billing, because these
  // reports also mention paying, and the lockout is what blocks them.
  {
    id: "login-locked-out",
    test: (s) =>
      /locked (me )?out|lock(ed|s)? me out|(can'?t|cannot|unable to|couldn'?t) (log ?in|sign ?in|get (in|into my account)|access my account)|(log ?in|sign[- ]?in) (fails|failed|isn'?t working|not working)/i.test(s.text),
    build: () => ({
      title: "Locked out of the Blotato account",
      cause: "The customer cannot sign in to my.blotato.com, often right after paying or on a new device. There is no self-serve recovery path in the docs, so a person with account access has to look.",
      fix: [
        "Collect the account email, the device and browser, and when they last signed in.",
        "Hand off to a human with account access. If there is a charge they don't recognize, add the billing team.",
        "Never promise a refund or a time to restore access.",
      ],
      escalate: true,
      customerReply:
        "Sorry you're locked out, that's stressful. I can't restore access from this chat, so I'm passing this to someone with account access. To speed that up, please reply with the email you use to sign in at https://my.blotato.com, the device and browser you used, and roughly when you last signed in. If a charge looks wrong too, include the amount and date. I'll update you in this chat as soon as I hear back.",
    }),
  },
  // Added 2026-11-09 from public reports (docs/ticket-evidence.md), ordered by report count.
  // Broadened 2026-11-10: any money event (charge, bill, refund, past due, a payment that didn't apply,
  // a purchase that started a subscription) or a cancel that failed goes to a human.
  {
    id: "billing-trial-api-key",
    test: (s) =>
      /\b(charg(e|ed|es|ing)|bill(ed|ing)|refund\w*|money back|past due|overcharg\w*|double[- ]charg\w*|credit card|debit card|payment method|invoice|receipt)\b|update (my )?(card|payment)|cancell?ation|can'?t cancel|cancel\w*.{0,30}(subscription|plan|account|membership)|\b(paid|pay|paying|payment|purchase\w*)\b.{0,60}\b(plan|subscription|activat\w*)|\$\d/i.test(
        s.text,
      ),
    build: () => ({
      title: "Billing: charged during the trial, cancel or refund",
      cause: "Generating an API key in Settings > API ends the free trial right away and starts the paid plan, even with trial days left. Cancel and refund questions need a person with access to Stripe.",
      fix: [
        "Check whether an API key was generated during the trial (that starts billing).",
        "To stop billing: Settings > Billing > View Billing Portal > cancel.",
        "Refund status: the Stripe receipt email, the bank statement, or support chat (works after access ends).",
        "Double charges, refund requests and disputes go to a human with the Stripe receipt. Never promise a refund.",
      ],
      escalate: true,
      customerReply:
        "I'm sorry about the unexpected charge. One thing that often explains it: clicking Generate API Key in Settings > API ends the free trial right away, and your card is charged for Starter that day, even if trial days are left. To stop future charges, go to Settings > Billing > View Billing Portal and cancel. For this charge, I'm passing it to our billing team. Please reply with your account email and the amount and date on the receipt, and I'll update you here.",
    }),
  },
  {
    id: "n8n-node-install",
    // Broadened 2026-11-10: checksum or package-integrity errors, "node type" not known, legacy version,
    // and plain "how do I find / install / add / update the node" questions.
    test: (s) =>
      /unrecognized node|node type|checksum|package integrity|community nodes?|legacy version|install button|question marks?|(find|install\w*|add|get|update\w*|download\w*)\b.{0,30}\b(blotato|community|n8n) node|can'?t (find|install).{0,30}(blotato )?node/i.test(
        s.text,
      ),
    build: () => ({
      title: "n8n can't find or install the Blotato node",
      cause: "Verified community nodes are off (n8n Cloud), community packages are disabled (self-hosted), a non-owner is installing, the wrong package name was used, or the template was imported before the node was installed.",
      fix: [
        "n8n Cloud: the instance owner turns on Verified Community Nodes in the Admin Panel, then searches \"Blotato\" in the node panel and clicks Install.",
        "Self-hosted: the owner installs @blotato/n8n-nodes-blotato under Settings > Community Nodes (N8N_COMMUNITY_PACKAGES_ENABLED must not be false).",
        "The package name is @blotato/n8n-nodes-blotato. The \".blotato\" at the end of the error is the node type, not part of the package name.",
        "If the error names @blotato/n8n-nodes-preview-blotato, the template uses the preview package: install that one, or swap the node for the installed Blotato node.",
        "Re-import the template after the node is installed.",
        "\"Checksum verification failed\" or a legacy version warning: update n8n and retry the install (forum fix, not in the docs).",
      ],
      escalate: false,
      customerReply:
        "This usually means the Blotato node isn't installed in your n8n yet. On n8n Cloud, the instance owner turns on Verified Community Nodes in the Admin Panel, then searches Blotato in the node panel and clicks Install. On self-hosted n8n, the owner installs @blotato/n8n-nodes-blotato under Settings > Community Nodes. Then open the template again. Does the Install button show up for you?",
    }),
  },
  // Added 2026-11-10 from the replay: the node itself misbehaves (wrong output branch, a crash inside
  // the node, a value that can't be picked). No documented fix, so collect versions and escalate.
  {
    id: "n8n-node-bug",
    test: (s) =>
      /cannot read propert(y|ies) of (undefined|null)|success (path|branch|output).{0,60}(error|even|still)|(error\w*|fail\w*).{0,60}success (path|branch|output)|(can'?t|cannot|unable to) (choose|select|pick).{0,60}\bnode\b|\b(blotato|n8n) node\b.{0,40}\b(bug|crash\w*)/i.test(
        s.text,
      ),
    build: (s) => {
      const schedule = /schedul/i.test(s.text);
      return {
        title: "The Blotato n8n node misbehaves",
        cause: "The node crashes, takes the wrong output branch, or won't offer a value. These are node bugs with no documented customer fix.",
        fix: [
          "Collect the n8n version, the Blotato node version (Settings > Community Nodes), a screenshot of the node settings and the exact error.",
          ...(schedule ? ["For scheduled time, try a full ISO 8601 value with timezone, like 2026-12-01T09:00:00-08:00."] : []),
          "Workaround while it is fixed: call the REST API from an HTTP Request node (https://backend.blotato.com/v2/posts).",
          "Escalate to engineering with the above.",
        ],
        escalate: true,
        customerReply: `Thanks for the details. That looks like a problem in the Blotato n8n node itself, so I'm passing it to our engineering team. While they look, you can post with an HTTP Request node instead: send it to https://backend.blotato.com/v2/posts with your blotato-api-key header.${schedule ? " For the scheduled time, use the full format with timezone, like 2026-12-01T09:00:00-08:00." : ""} Could you reply with your n8n version, the Blotato node version from Settings > Community Nodes, and the exact error? I'll update you here.`,
      };
    },
  },
  {
    id: "n8n-server-url",
    // Broadened 2026-11-10: any n8n credential or server field ending in /v2 (not a /v2/... path),
    // n8n's longer "resource you are requesting could not be found", and a doubled /v2/v2.
    test: (s) =>
      /blotato server.{0,40}\/v2|(n8n|credential|server)\b[\s\S]{0,80}backend\.blotato\.com\/v2(?!\/)|resource (you are requesting )?could not be found|\/v2\/v2|\b(n8n|credential)\b[^.]{0,80}\bapi\.blotato\.com/i.test(s.text),
    build: () => ({
      title: "n8n credential Server URL includes /v2",
      cause: "The n8n Blotato credential's Server field adds /v2 itself, so https://backend.blotato.com/v2 becomes /v2/v2 and returns not found.",
      fix: ["Set the credential's Blotato Server to https://backend.blotato.com with no /v2, save, and test the credential."],
      escalate: false,
      customerReply:
        "In n8n, open your Blotato credential and look at the Server field. If it ends in /v2, that's the cause: it should be just https://backend.blotato.com, with no /v2, because the node adds that part itself. Change it, save, and click Test on the credential. Does the test pass now?",
    }),
  },
  {
    id: "upload-in-progress",
    // Broadened 2026-11-10: "it shows an error, but the file uploaded anyway" is the same duplicate-request
    // pattern even when the customer doesn't quote the message.
    test: (s) =>
      /upload for this url is already in progress|already in progress/i.test(s.text) ||
      (new RegExp(MEDIA_NOUN + "|upload", "i").test(s.text) &&
        /error\w*.{0,80}\b(but|yet|then|still|anyway)\b.{0,60}\b(still|anyway|there|loads?|loaded|uploaded|appears?|shows? up|went through|worked)\b/i.test(s.text)),
    build: () => ({
      title: "Same media URL sent again while the first upload runs",
      cause: "The same URL was sent to /v2/media again within about 20 seconds, usually from parallel runs in Make or n8n. The first upload normally succeeded.",
      fix: ["Don't resubmit. Upload one item at a time (iterator plus a Wait) and reuse the Blotato URL the first upload returned."],
      escalate: false,
      customerReply:
        "That message means Blotato is still uploading the same file from your first request, so the second copy was turned away. Please don't resend it. Wait for the first upload to finish and reuse the link it gives you. In Make or n8n, upload one file at a time with a short wait between them. Want me to check whether the first upload went through?",
    }),
  },
  {
    id: "silent-success",
    // Broadened 2026-11-10: "ran successfully / every execution is green, but nothing was posted /
    // the page hasn't gotten a post", with a little more room between the two halves.
    test: (s) =>
      /(success\w*|succeeded|200|201|green|completed?).{0,80}\b(nothing|never|no|not|hasn'?t|haven'?t|didn'?t|wasn'?t|isn'?t)\b.{0,40}\b(post\w*|show\w*|appear\w*|publish\w*)|no post (appeared|showed)/i.test(
        s.text,
      ),
    build: () => ({
      title: "Run says success but no post appeared",
      cause: "A 2xx with postSubmissionId only means queued; the platform can still reject it later. In n8n a node that receives zero items is skipped and the run still shows success.",
      fix: [
        "Poll GET /v2/posts/{postSubmissionId} every 10+ seconds until published or failed and read errorMessage.",
        "Check Posts > Failed in Blotato.",
        "In n8n, check each node's item count; a node with 0 items never ran.",
      ],
      escalate: false,
      customerReply:
        "A green run means the request was sent, not that the post went live. First, check Posts > Failed in Blotato for an error on that post. If you use n8n, look at each node's item count: a node with 0 items never ran. Could you send me the postSubmissionId from the run? I'll look it up.",
    }),
  },
  // Added 2026-11-10 from the replay: client code that only accepts 200 treats Blotato's 201 Created as a failure.
  // After silent-success, so "got 201 but nothing posted" still reads as a queued-then-rejected post.
  {
    id: "upload-201-created",
    // Not when the post itself then failed: 201 only means the request was accepted (round 2 hostile case S4).
    test: (s) => (s.status === 201 || /\b201\b/.test(s.text)) && !/\b(status|post)\b[^.]{0,30}\b(failed|rejected)\b|\b(failed|rejected)\b[^.]{0,40}\b(image|video|media|post)\b|must be (jpe?g|png|mp4)/i.test(s.text),
    build: () => ({
      title: "Client treats 201 Created as an error",
      cause: "POST /v2/media/uploads and POST /v2/posts answer 201 Created on success. Code that accepts only 200 reports a failure even though Blotato did the work.",
      fix: [
        "Treat any 2xx status as success.",
        "Read presignedUrl and publicUrl (media uploads) or postSubmissionId (posts) from the response body.",
        "Before retrying, check whether the first call already uploaded the file or queued the post, to avoid duplicates.",
      ],
      escalate: false,
      customerReply:
        "Good news: a 201 status means it worked. It's the code for created, so Blotato accepted the upload or the post. If your tool treats 201 as an error, set it to count any 2xx status as success, then read the link or postSubmissionId from the response. Before retrying, check Posts so you don't create a duplicate. Did it show up?",
    }),
  },
  {
    id: "tiktok-url-ownership",
    test: (s) => /url ownership|verify.{0,20}domain|ownership verification/i.test(s.text),
    build: () => ({
      title: "TikTok rejects the video URL (URL ownership)",
      cause: "TikTok only pulls video from verified domains, so a link to your own host or a cloud drive is rejected.",
      fix: ["Upload the video to Blotato first (POST /v2/media or the upload flow), then post with the returned Blotato URL."],
      escalate: false,
      customerReply:
        "TikTok only accepts videos from links it trusts, so links from other sites get rejected. Upload the video to Blotato first as an MP4: in the app, add it from your computer, or with the API use the media upload and post the Blotato link it returns. Then post again. Want me to walk you through the upload?",
    }),
  },
  // Added 2026-11-10 from the replay: the post's public link points at the profile, not the post.
  // No documented fix; needs the postSubmissionId and an engineer.
  {
    id: "tiktok-public-url",
    test: (s) => /(public ?url|post (url|link)|link to (the|my) post).{0,80}\b(profile|account page|not the (video|post))/i.test(s.text),
    build: () => ({
      title: "Post's publicUrl points to the profile, not the post",
      cause: "After publishing, GET /v2/posts/{postSubmissionId} returns a publicUrl for the account profile instead of the post. Seen on TikTok. No documented customer fix.",
      fix: [
        "Collect the postSubmissionId, the platform, and when it was published.",
        "Confirm the post itself is live on the platform.",
        "Escalate to engineering with the above.",
      ],
      escalate: true,
      customerReply:
        "Thanks for catching that. If the post itself is live on TikTok, the link we returned pointing to your profile is a bug on our side, so I'm passing it to our engineering team. Please reply with the postSubmissionId and the time it was published so they can trace it. I'll update you here as soon as I hear back.",
    }),
  },
  // Added 2026-11-10 from the replay: LinkedIn rejects the API version Blotato calls with. Not user-fixable.
  {
    id: "linkedin-nonexistent-version",
    test: (s) => /nonexistent_version|nonexistent version|(api )?version (is )?(not active|no longer (active|supported)|deprecated|sunset)/i.test(s.text),
    build: () => ({
      title: "LinkedIn rejects the API version (NONEXISTENT_VERSION)",
      cause: "Assumption: Blotato is calling a LinkedIn API version that LinkedIn has retired. Blotato has to update it; the customer can't fix it.",
      fix: [
        "Collect the postSubmissionId, the time, and the exact error.",
        "Escalate to engineering right away; every LinkedIn post on the account will fail until it is fixed.",
      ],
      escalate: true,
      customerReply:
        "Sorry about this. That LinkedIn error points to a problem on our side with LinkedIn's API version, not your account, so I'm escalating it to engineering right away. Until it's fixed, other LinkedIn posts may fail too, so please keep an eye on the scheduled ones in your calendar. Could you reply with the post ID and the time it failed? I'll update you here.",
    }),
  },
  {
    id: "auth-401",
    // Broadened 2026-11-10: "my key is refused / rejected / not accepted" without a status code.
    test: (s) =>
      s.status === 401 ||
      /\b401\b|invalid api key|unauthori[sz]ed|\bkey\b.{0,30}\b(invalid|rejected|refused|not (valid|accepted|recogni[sz]ed|working)|doesn'?t work)|(refus\w*|reject\w*|won'?t accept|doesn'?t accept|not accept\w*)\b.{0,40}\b(api )?key\b/i.test(s.text),
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
        "A 401 means Blotato didn't recognize the API key. Usually a character got lost when copying it, often the = at the end. Copy the key again from Settings > API, all of it, and paste it in place of the old one. If you call the API directly, send it in the blotato-api-key header. Does it work now? If not, send me the time of the request and I'll look it up.",
    }),
  },
  {
    id: "plan-403",
    test: (s) => s.status === 403 || /\b(api|mcp|api key)\b[^.]{0,50}\b(trial|paid plan|subscription|plan)\b|\b(trial|paid plan|subscription|plan)\b[^.]{0,50}\b(api|mcp)\b|subscription (error|required)|requires? a paid plan/i.test(s.text),
    build: () => ({
      title: "Plan does not include API access (403)",
      cause: "The API and MCP are for paid plans only (Starter and up). Free trials have no API access.",
      fix: [
        "Check the plan on https://my.blotato.com/settings/billing.",
        "Generating an API key under Settings > API ends the free trial and starts the paid Starter plan; tell the customer this before they click.",
      ],
      escalate: false,
      customerReply:
        "API and MCP access need a paid plan (Starter and up), so they don't work during the free trial. You can check your plan in Settings > Billing. Heads up before you upgrade: clicking Generate API Key in Settings > API ends the trial right away, and your card is charged for Starter that day. Want me to walk you through it?",
    }),
  },
  {
    id: "rate-429",
    test: (s) => s.status === 429 || /rate limit/i.test(s.text),
    build: (s) => {
      // Only Blotato's own response sets the wait (round 3: customers typed "retry in 3600s" and it was echoed).
      const raw = Number((s.bodyText ?? "").match(/retry in (\d+) ?s(ec(ond)?s?)?\b/i)?.[1]);
      const secs = raw >= 1 && raw <= 3600 ? String(raw) : undefined; // hostile review 2026-11-10: "retry in 999999" was echoed back
      return {
        title: "Rate limit hit (429)",
        cause: `Each route has its own per-minute limit (create post 30/min, status checks 60/min, media from URL 30/min).${secs ? ` The server asked to wait ${secs} seconds.` : ""}`,
        fix: [
          `Stop calling that route and wait${secs ? ` ${secs} seconds` : " for the interval in the response"}.`,
          "When polling post status, wait at least 10 seconds between checks.",
          "In n8n, add a Wait node or batch items instead of looping as fast as possible.",
        ],
        escalate: false,
        customerReply: `Requests came in faster than Blotato allows, so those requests were turned away and not posted.${secs ? ` Wait ${secs} seconds, then send them again.` : " Wait the number of seconds shown in the error, then send them again."} If you check post status in a loop, wait at least 10 seconds between checks, or add a Wait node in n8n. Did they go through after the pause?`,
      };
    },
  },
  // Moved above media-90009 on 2026-11-10 so a format problem isn't read as a download problem.
  {
    id: "unsupported-media",
    // Broadened 2026-11-10: other wordings of "format not supported", the storage-upload error Blotato's
    // own sample traced to .mov files, and container formats platforms commonly refuse.
    test: (s) =>
      /unsupported media type|unsupported (file|format|codec)|must be (a )?(jpe?g|png|mp4|gif)\b|only (jpe?g|png|mp4)|(format|file type|codec) (is )?(not supported|unsupported)|could not upload media to storage|\.(mov|avi|mkv|webm|heic)\b/i.test(s.text),
    build: () => ({
      title: "Unsupported media type",
      cause: "The file type or format is not accepted by the destination platform, or the URL returns HTML instead of the file.",
      fix: [
        "Check the URL returns the raw file (Content-Type image/* or video/*), not a web page.",
        "Use MP4 (H.264) for video and JPG or PNG for images. Convert .mov and other formats first.",
      ],
      escalate: false,
      customerReply:
        "Blotato couldn't read that file type. Use MP4 for video, and JPG or PNG for images. If you have a .mov or another format, convert it to one of those first. Also make sure the link opens the file itself, not a web page about it. Want to send me the link so I can check it?",
    }),
  },
  {
    id: "media-90009",
    // Broadened 2026-11-10: "Failed to read media metadata" (often sent as a 500), "can't read/fetch the file",
    // the link types that usually cause it (Drive, Dropbox, preview, temporary, signed, proxy), and
    // a failure word next to "media" or a media URL.
    test: (s) =>
      s.code === 90009 ||
      /90009|could not fetch the media|media metadata|(can'?t|cannot|couldn'?t|unable to|failed to) (read|fetch|download|get|access|reach) (the |my |your )?(media|file|video|image|photo)|google drive|drive\.google|dropbox|preview (link|url)|temporary (link|url)|signed url|resize proxy|proxy url/i.test(s.text) ||
      new RegExp(`${FAILS}.{0,40}\\b(media\\b|${MEDIA_NOUN} (url|link)s?\\b)|\\bmedia\\b.{0,40}${FAILS}`, "i").test(s.text),
    build: () => ({
      title: "Blotato could not download the media (90009)",
      cause: "The media URL needs a sign-in, points to a preview page (Google Drive, Dropbox dl=0), is temporary or signed and expired, or the host blocks Blotato's server. Blotato sometimes reports this as a 500 \"Failed to read media metadata\".",
      fix: [
        "Open the URL in a private browser window. It should download or show the raw file with no sign-in.",
        "Google Drive: use https://drive.usercontent.google.com/download?id=FILE_ID&export=download&confirm=t and share as Anyone with the link.",
        "Avoid preview, temporary, signed or proxy URLs. Upload the file to Blotato instead: POST /v2/media/uploads, PUT the file to presignedUrl, then post publicUrl.",
        "If it works sometimes and fails other times, the host may be throttling Blotato's server; upload to Blotato or a public bucket instead.",
      ],
      escalate: false,
      customerReply:
        "The post failed because Blotato couldn't download the file from that link. Usually the link opens a preview page, needs a login, or is a temporary link that stopped working. If it's on Google Drive, set sharing to \"Anyone with the link\" and use the direct-download form of the link (I can convert it for you). Or upload the file to Blotato first and post with the link it gives you. Then try again.",
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
        "That template ID isn't one Blotato knows, often because it was copied with a typo or from an old template. Copy the ID again from the template list (in the API: GET /v2/videos/templates) and paste it exactly. Does it work with the fresh ID?",
    }),
  },
  {
    id: "connection-422",
    test: (s) => s.status === 422 || /\breconnect|\b(connection|account|token|session|authori[sz]ation|linkedin|facebook|instagram|tiktok|threads|pinterest|bluesky|youtube|twitter|\bx\b)\b[^.]{0,40}\bexpired|\bexpired\b[^.]{0,30}\b(connection|token|authori[sz]ation)/i.test(s.text) && !/\b(card|payment method|subscription)\b[^.]{0,20}\bexpired|expired[^.]{0,20}\b(card|payment)/i.test(s.text),
    build: () => ({
      title: "Social account connection expired (422)",
      cause: "The Facebook or LinkedIn login behind this account has expired, so Blotato cannot list its pages or post to it.",
      fix: ["Reconnect the account at https://my.blotato.com/settings, then retry."],
      escalate: false,
      customerReply:
        "Your social account's login inside Blotato has expired, so Blotato can't post there right now. Reconnect the account in Settings in the Blotato app, then check Posts > Failed and resend anything that failed while it was disconnected. Did the reconnect work?",
    }),
  },
  // Added 2026-11-10 from the replay: customers typing account or page ids by hand, or posting to only
  // some of the accounts on their key. The ids should be read from the API, never typed.
  {
    id: "find-account-ids",
    test: (s) =>
      /(type|enter|paste|find|where|get|look up)\b.{0,40}\b(account|page|board) ?id|(account|page|board) ?ids?\b.{0,40}\b(by hand|manually|where|find)|can only post to (one|linkedin|facebook|instagram|x|twitter|tiktok|pinterest|threads|youtube|bluesky)/i.test(
        s.text,
      ),
    build: () => ({
      title: "Finding the right accountId and pageId",
      cause: "accountId values are not guessable. Each connected account has its own id, and Facebook Pages and LinkedIn company pages also need a pageId from that account's subaccounts.",
      fix: [
        "List every account on the key with GET /v2/users/me/accounts and use items[].id as accountId.",
        "For Facebook Pages and LinkedIn company pages, GET /v2/users/me/accounts/{accountId}/subaccounts and use items[].id as target.pageId.",
        "Store the ids your app reads from those calls; don't ask users to type them.",
      ],
      escalate: false,
      customerReply:
        "Every account and page you connect has an ID. In the app you don't need them. If you use the API, list your accounts and use each item's id as accountId. For Facebook Pages and LinkedIn company pages, list the subaccounts the same way and use that id as pageId. Want me to send the exact requests?",
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
        "That means Blotato couldn't find what the request asked for, usually an account ID that isn't on your key, or an address missing /v2. Check that the address starts with https://backend.blotato.com/v2, and use an account ID from your accounts list. Want to send me the request (without your key) so I can look?",
    }),
  },
  {
    id: "wrong-host",
    test: (s) => /(?<!backend\.)\bapi\.blotato\.com/i.test(s.text) && !/\b(mcp|n8n|credential)\b/i.test(s.text),
    build: () => ({
      title: "Wrong API host",
      cause: "api.blotato.com is not a valid base URL.",
      fix: ["Use https://backend.blotato.com/v2."],
      escalate: false,
      customerReply: "Quick fix: the API address is https://backend.blotato.com/v2, not api.blotato.com. Swap the base address in your tool and send the request again. Did that do it?",
    }),
  },
  {
    // Found in the live test on 2026-11-10: a sandboxed network made DNS fail for the RIGHT host,
    // and the old rule blamed api.blotato.com. A network failure is not a wrong URL.
    id: "network-unreachable",
    test: (s) => /ENOTFOUND|getaddrinfo|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|\b[A-Z_]*CERT[A-Z_]*\b|\b[Cc]ertificate\b|[Ss]elf[- ]signed|[Ff]etch failed/.test(s.text),
    build: () => ({
      title: "Could not reach Blotato",
      cause: "The request never got an answer from backend.blotato.com: DNS, a firewall or proxy, a VPN, or a certificate problem on the caller's network. The key and URL may be fine.",
      fix: [
        "Confirm the base URL is exactly https://backend.blotato.com/v2.",
        "Run: curl -sI https://backend.blotato.com/v2/users/me  (any HTTP status, even 401, means the network is fine).",
        "If curl fails too, check VPN, proxy, firewall or a self-hosted n8n's outbound network and certificates.",
      ],
      escalate: false,
      customerReply:
        "Your request isn't reaching Blotato at all, so your key is probably fine. Usually a VPN, firewall or proxy is blocking it. Try turning off the VPN or switching networks, then send the request again. If it still fails, could you send me what this prints: curl -sI https://backend.blotato.com/v2/users/me",
    }),
  },
  {
    // Round 4: an MCP connection question got the REST API address.
    id: "mcp-url",
    test: (s) => /\bmcp\b/i.test(s.text) && /\b(url|address|connect\w*|won'?t (connect|work)|server)\b/i.test(s.text) && !/mcp\.blotato\.com\/mcp|\b403\b|forbidden|\btrial\b|\bplan\b/i.test(s.text),
    build: () => ({
      title: "Wrong Blotato MCP server address",
      cause: "The Blotato MCP server lives at https://mcp.blotato.com/mcp. api.blotato.com and backend.blotato.com/v2 are not MCP addresses.",
      fix: ["Set the MCP server URL to https://mcp.blotato.com/mcp.", "Sign in when the client asks, or send the API key in the blotato-api-key header if the client uses headers.", "MCP needs a paid plan."],
      escalate: false,
      customerReply:
        "The Blotato MCP server address is https://mcp.blotato.com/mcp, so please swap that in for the address you have now. Then sign in when your app asks, or add your API key in the blotato-api-key header if your app uses headers. MCP works on the paid plans. Does it connect now?",
    }),
  },
  {
    // Round 4: scheduledTime already at the top level, but the post went out hours off: a missing timezone offset.
    id: "scheduled-wrong-time",
    test: (s) => /\b(wrong time|hours? (early|late|off|before|after)|instead of \d|at \d{1,2}(:\d\d)? ?(am|pm)[^.]{0,30}instead)\b/i.test(s.text) && !/(went out|posted|published)[^.?!]{0,30}(right away|immediately|instantly)/i.test(s.text),
    build: () => ({
      title: "Post went out at the wrong time (timezone)",
      cause: "A scheduledTime without a timezone offset (for example 2026-11-12T09:00:00) is read as UTC, so it publishes hours off local time.",
      fix: ["Add the offset: 2026-11-12T09:00:00-08:00 for Pacific, or send UTC with a Z.", "Check the account's timezone setting in Blotato."],
      escalate: false,
      customerReply:
        "Thanks for the details, that helps. When scheduledTime has no timezone on the end, like 2026-11-12T09:00:00, it is read as UTC, so the post goes out hours off your local time. Add your offset, for example 2026-11-12T09:00:00-08:00 for Pacific, and it will post at the time you expect. Want me to check the next one before it goes out?",
    }),
  },
  {
    id: "published-immediately",
    test: (s) => /(posted|published|went (out|live))[^.?!]{0,80}(immediately|right away|instead of|too early|the (second|moment|minute)|as soon as)|ignored[^.?!]{0,60}schedul/i.test(s.text) && !/\bat \d{1,2}(:\d\d)? ?(am|pm)[^.]{0,30}instead of \d|\bhours? (early|late|off)\b|\bwrong time\b/i.test(s.text),
    build: () => ({
      title: "Post published immediately instead of on schedule",
      cause: "scheduledTime (or useNextFreeSlot) was placed inside the \"post\" object. Blotato only reads it at the root of the body, so the post went out right away.",
      fix: ['Move scheduledTime to the top level: {"post": {...}, "scheduledTime": "2026-12-01T09:00:00-08:00"}.'],
      escalate: false,
      customerReply:
        "I'm sorry your post went out early. Were you scheduling in the Blotato app, or through the API, n8n or Make? With the API, the usual cause is scheduledTime sitting inside \"post\", where Blotato ignores it; it belongs at the top level, next to \"post\". To take the early post down, delete it on the platform. Send me the request (without your key) and I'll check it.",
    }),
  },
  {
    id: "stuck-in-progress",
    test: (s) => /in[- ]progress|\bstuck\b|still processing|pending forever/i.test(s.text) && !/upload[^.]{0,40}already in progress/i.test(s.text),
    build: () => ({
      title: "Post stuck at in-progress",
      cause: "One of three things: it is still publishing (video can take a while), the postSubmissionId is wrong (an ID that matches nothing also returns in-progress), or the scheduled post was cancelled (a deleted schedule also reads in-progress; verified live 2026-11-10).",
      fix: [
        "Confirm the postSubmissionId is the one returned by POST /v2/posts.",
        "Check the calendar (my.blotato.com or blotato_list_schedules): if the post is no longer there, it was cancelled. Schedules use their own id, not the postSubmissionId.",
        "Poll no faster than every 10 seconds; stop at published or failed.",
        "Check https://my.blotato.com/posts?status=failed and https://my.blotato.com/logs.",
        "If a valid ID is in-progress for over an hour, escalate with the ID.",
      ],
      escalate: true,
      customerReply:
        "Let's check three things. First, make sure you're checking the exact postSubmissionId you got back when you created the post; any ID that doesn't match also shows in-progress. Second, look at your calendar: if the post was cancelled, it also shows in-progress. Third, videos can take a while. If it's the right ID, still on the calendar, and over an hour old, send it to me and I'll escalate it.",
    }),
  },
  // Added 2026-11-10 from the replay: AI video credits and quality, and template changes. Product feedback,
  // not an error; acknowledge, point to the credit balance, and pass it on. Placed late so real errors win.
  {
    id: "ai-video-credits-quality",
    test: (s) =>
      /\b(ai |video |design |generation )?credits\b|\bcredit (balance|usage|limit)|out of credit|(video|image|output) quality|quality (is|was) (poor|bad|low)|(poor|bad|low)[- ]quality|template (change|changed|update)|(formatting|layout) (broke|changed)|(change|changes|update)\b.{0,30}\bbroke/i.test(s.text),
    build: () => ({
      title: "AI video credits, quality or template changes",
      cause: "Feedback on visual generation: credits used faster than expected, output quality, or templates that changed. Not an API error.",
      fix: [
        "Point the customer to their credit balance under Settings > Billing.",
        "Pass quality and template feedback to the product team with examples (video IDs or links).",
        "Don't promise credits back; route credit disputes to billing.",
      ],
      escalate: true,
      customerReply:
        "Thanks for telling us, and sorry the result wasn't what you hoped for. AI video can use a lot of credits at once, so check your balance under Settings > Billing before a long render. I'm passing this on to our product team. If you send me a link to the video or template that changed, I'll attach it so they can see exactly what happened.",
    }),
  },
  // Added 2026-11-10 from the replay: customers asking for post stats. The Blotato API and MCP now
  // return post analytics (the MCP exposes post analytics and top posts).
  {
    id: "post-analytics",
    test: (s) => /\b(analytics|insights|impressions|engagement|metrics|stats)\b|\b(likes|views|saves|reach)\b.{0,60}\b(post|posts|back|api|sheet|sheets)\b/i.test(s.text),
    build: (s) => {
      const sheets = /sheet/i.test(s.text);
      return {
        title: "Getting post analytics",
        cause: "The customer wants post stats (views, likes, reach). Blotato returns post analytics through the API and MCP.",
        fix: [
          "Point to the help entry \"How do you get social analytics (views, likes, etc.) via API?\" at https://help.blotato.com/start-with-an-ai-agent/faqs.md.",
          "For Google Sheets, read the analytics in an n8n or Make step and append a row per post.",
          "Note which stats each platform shares; not every platform returns every metric.",
        ],
        escalate: false,
        customerReply: `Yes, you can get views and likes for your published posts. Blotato returns post analytics through the API and MCP; the help center entry "How do you get social analytics via API?" at https://help.blotato.com walks through it.${sheets ? " For Google Sheets, read the analytics in an n8n or Make step and add a row per post." : ""} Not every platform shares every number. Which platform do you need? I'll send the exact fields.`,
      };
    },
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
        "Sorry about that, this error is on our side, not yours. Please try again in a minute. If it fails again, reply with the time (with your timezone) and what you were doing, and I'll pass it to our engineering team right away.",
    }),
  },
];

export function explainError(input: { status?: number; body?: unknown; message?: string }): Explanation[] {
  const bodyText = input.body === undefined ? "" : typeof input.body === "string" ? input.body : JSON.stringify(input.body);
  const text = [input.message ?? "", bodyText].join(" ").trim().slice(0, 4000); // cap: a 140 KB ticket took 5 s
  let code: number | undefined;
  if (typeof input.body === "object" && input.body !== null && typeof (input.body as any).code === "number") code = (input.body as any).code;
  // "I get a 403 error", "HTTP 500", "422 on linkedin": use a status the customer typed when none was passed.
  const typed = input.status === undefined ? text.match(/\b(?:http|error|status|code|got|getting|get|returns?|returned|a|an)\s+([45]\d{2})\b|\b([45]\d{2})\s+(?:error|status|response|on|from|internal|not found|forbidden|unauthorized)/i) : null;
  const status = input.status ?? (typed ? Number(typed[1] ?? typed[2]) : undefined);
  const signal = { status, text, code, bodyText: bodyText.slice(0, 2000) };
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
        "Thanks for the details. I haven't seen this exact error before, so I'm passing it to our engineering team. To help them, please reply with what you were doing, the time with your timezone, and the exact error message (with your API key removed). I'll update you here as soon as I hear back.",
    },
  ];
}

// The explanation for a known issue id, used when the AI classifier (classify.ts) picked the issue.
export function explanationFor(id: string, input: { status?: number; message?: string } = {}): Explanation | undefined {
  const rule = RULES.find((r) => r.id === id);
  return rule && { id, ...rule.build({ status: input.status, text: input.message ?? "" }) };
}
