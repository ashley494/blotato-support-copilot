# Blotato ticket evidence

Research date: 2026-11-09. Window: 2025-11-09 to 2026-11-09 (last 12 months). Read-only research; nothing was posted or signed into.

## How this was counted

- **Independent report** = one customer, in their own post, review, issue or PR, describing a problem they hit. Same person posting the same problem in two places counts once.
- Blotato's own help docs and blog are **not** counted as reports. They are used as (a) a signal that support sees the question often enough to document it, and (b) proof of the fix.
- Reports older than the window are listed as "older" for context and are not in the count.
- Blotato's 2026-09-10 developer post (13 failed posts from one agency account over 90 days) is counted as **one** source; its internal breakdown is shown in the notes.
- Volume is small. Public reports are a thin slice of what reaches Blotato's support chat, so treat the ranking as direction, not proportion. (Assumption: public channels under-represent API and media problems, because those users get help in-app.)

### Sources read (about 72)

| Source | What was read | Reachable? |
|---|---|---|
| community.n8n.io | Forum search "blotato" (4 result pages) plus 17 full threads | Yes |
| community.make.com | Forum search "blotato" plus 4 full threads | Yes |
| GitHub | All 11 issues on Blotato-Inc/n8n-nodes-blotato, 2 n8n-io/n8n issues, 8 PRs in user repos fixing Blotato integrations, GitHub issue search | Yes |
| Trustpilot | 1, 2 and 3 star filters (about 30 reviews) | Yes (via fetch tool) |
| help.blotato.com | 29 pages: Error Reference, API FAQs, n8n FAQs, Make FAQs, MCP FAQs, platform FAQs (Facebook, Instagram, TikTok, YouTube, LinkedIn, X, Pinterest), billing, settings, n8n node install, upload media, publishing status, error handling, limits | Yes |
| blotato.com/blog | social-media-api-errors (2026-09-10), blotato-ratings-trustpilot-g2-capterra (2026-10-06), fix-silent-failures | Yes |
| G2, Capterra, Product Hunt | Search summaries only; Capterra returned 403 | Partial |
| Reddit | Blocked to automated fetch; web search returned no Reddit threads about Blotato | No |
| X/Twitter, YouTube comments | Not searchable; no customer problem posts surfaced | No |
| Blotato changelog | No public changelog found | n/a |

Note: many n8n forum replies from Oct 2026 mention Blotato as a recommendation in unrelated threads (about 30 posts, near-identical phrasing). They describe no problems and were excluded.

## Ranked categories (in-window independent reports)

| Rank | Category | Copilot status | Count | Example summaries (paraphrased) | Links and dates |
|---|---|---|---|---|---|
| 1 | **billing-trial-cancel**: charged during or after trial, cannot cancel, double charges, refund refused | NEW | 7 | Could not cancel, the cancel pop-up would not close. Paid but plan never activated and kept asking for payment. Cancellation failed after a charge. Charged $29, cancelled at once, refund refused. Charged three times in two weeks. Subscription started by a third-party $10 purchase. Charged after the trial. | trustpilot.com/review/blotato.com?stars=1 (2026-08-29 Daniel, 2026-08-02 Shridhar, 2026-07-01 Hippo, 2026-02-23 Lam, 2026-01-27 Marsha, 2026-01-06 Emor); ?stars=2 (2026-07-30). Older: 2025-11-03 Flo "past due" on trial, 2025-10-21 Bob, 2025-08-31 Santiago "charged immediately despite a free trial" |
| 2 | **n8n-node-install**: "Unrecognized node type: @blotato/n8n-nodes-blotato.blotato", "Checksum verification failed", no Install / Add Community Node button | NEW | 6 | Cannot install the node on Hostinger, checksum fails. No "Add Community Node" button, workflow shows unrecognized node. Can't install the community node locally. Preview package still shows unrecognized node after install. n8n Cloud Pro has no install button. "How do I find this node to install it". | https://community.n8n.io/t/249245 (2026-01-13; same user filed https://github.com/n8n-io/n8n/issues/24223); https://community.n8n.io/t/229135 (2025-12-01); https://github.com/n8n-io/n8n/issues/24021 (2026-01-08); https://github.com/Blotato-Inc/n8n-nodes-blotato/issues/10 (2026-02-04); https://community.n8n.io/t/126628 post 11 (2025-12-17); https://community.n8n.io/t/172669 post 6 (2025-11-21). Older: n8n-nodes-blotato issues #1, #7, #8 (checksum, 2025-08 to 2025-11-05), #4 (update not showing, 2025-09) |
| 3 | **media-90009 / media URL not fetchable** (Google Drive links, temp or preview URLs, host blocking) | Existing (extend) | 4 | "[500] Failed to read media metadata" on 4 Make scenarios fed by Google Sheets links that always worked. Intermittent 500 uploading Google Drive files to Blotato. Root cause was a preview/temp URL, not a real public file. Blotato's own sample: 9 of 13 failures died on media before reaching a platform. | https://community.make.com/t/100351 (2026-01-07); https://community.make.com/t/97934 (2025-12-04); https://community.n8n.io/t/302420 post by mincha0908 (2026-07-20); https://www.blotato.com/blog/social-media-api-errors (2026-09-10). Older: https://community.n8n.io/t/205135 (2025-10-14, Instagram rejects resize-proxy URLs), https://community.n8n.io/t/130711 (2025-06, template's Drive ID regex drops "_") |
| 4 | **visual-generation-quality-credits**: AI video quality, credits run out, templates changed | NEW | 3 | One two-minute vertical video uses the whole month's credits. Works as a publisher but video quality is poor. Template formatting broke after a change; API changes after upgrade needed rework. | Trustpilot 2026-05-28 Tony (3 star), 2026-05-22 Joe (2 star), 2026-05-10 and 2026-05-15 Shelby (1 and 3 star, counted once). Vendor blog (2026-10-06) says AI video quality draws "a steady share" of Capterra complaints (not counted) |
| 5 | **feature-gap-analytics**: no post stats / analytics | NEW (deflect) | 2 | Wants Instagram likes, saves, impressions back into Sheets. Calendar in beta, asks for analytics. | G2 review (date not shown) via https://www.g2.com/products/blotato-ai/reviews_and_filters; vendor blog 2026-10-06 "several reviewers want deeper analytics". Older: https://community.n8n.io/t/205536 (2025-10-14, founder replied analytics not available yet). Assumption: may be resolved now; the API FAQ has an analytics entry |
| 6 | **silent-success-no-post**: workflow green, nothing published | NEW | 1 | 183 successful runs, zero posts on LinkedIn, Facebook, Instagram. Replies traced it to an n8n filter passing zero items, not Blotato. | https://community.n8n.io/t/250979 (2026-01-16). Older: https://github.com/Blotato-Inc/n8n-nodes-blotato/issues/3 (2025-09-02, node took success path on error) |
| 7 | **upload-in-progress**: "A media upload for this URL is already in progress" | NEW | 1 (+1 possible) | Make shows an error but the video still loads in Blotato. | https://community.make.com/t/97653 (2025-12-01). Assumption: the intermittent 500s in /t/97934 by the same user are the same concurrency cause (respondents suggested it; not confirmed) |
| 8 | **tiktok-public-url**: GET post returns the profile URL, not the video URL | NEW | 1 | Waited, polled the post ID, publicUrl still points to the account profile. | https://github.com/Blotato-Inc/n8n-nodes-blotato/issues/9 (2026-01-02) |
| 9 | **linkedin-nonexistent-version**: LinkedIn error "NONEXISTENT_VERSION" | NEW (escalate) | 1 | "error con linkedin" with NONEXISTENT_VERSION. | https://github.com/Blotato-Inc/n8n-nodes-blotato/issues/11 (2026-09-15). Assumption: Blotato pinned a LinkedIn API version that LinkedIn retired; Blotato-side, not user-fixable |
| 10 | **upload-201-created**: client treats 201 from POST /v2/media/uploads as failure | NEW | 1 | Weekly batch stopped: "media upload answered HTTP 201". | https://github.com/DoctorCRE/carr-system/pull/3052 (2026-11-06) |
| 11 | **account-id-mismatch**: typing LinkedIn/Facebook IDs by hand, wrong accountId vs pageId | Related to existing missing-pageId | 1 | Form asked for a LinkedIn id that the account lookup already lists; only LinkedIn worked of six platforms. | https://github.com/beserericl-hue/Automations/pull/281 (2026-11-05) |
| 12 | **login-after-payment**: paid but locked out | NEW (route to human) | 1 | Locked out on a second computer during trial, no reply, froze card. | Trustpilot 2026-08-07 Sebastian. Older: 2025-10-21 Bob (paid for API, cannot log in), 2025-06-18 Lucian |
| 13 | **connection-422** (expired LinkedIn token) | Existing | 1 | "LinkedIn account has expired". | Blotato blog sample, 2026-09-10 |
| 14 | **tiktok-url-ownership** | NEW | 1 | "Please review our URL ownership verification rules" on TikTok video. | Blotato blog sample, 2026-09-10 |
| 15 | **api-key-401** | Existing | 1 (assumption) | A client's key-shape check refused the user's real key. | https://github.com/Sholbk/Athena/pull/28 (2026-10-22). Assumption: tied to the trailing "=" the docs warn about; the PR does not say |
| 16 | **unsupported-media** (.mov, storage upload) | Existing | 1 | "Could not upload media to storage" x2 in one account's sample; advice: H.264 MP4. | Blotato blog sample, 2026-09-10 |
| 17 | **published-immediately** (scheduledTime) | Existing | 0 in window | Older: n8n node scheduledTime gave "Cannot read properties of undefined (reading 'split')". | https://github.com/Blotato-Inc/n8n-nodes-blotato/issues/2 (2025-08-23) |
| 18 | plan-403, rate-429, template-404, TikTok required booleans, stuck-in-progress | Existing | 0 | No independent public reports found. Docs cover all of them, so they are real support topics; rate limits showed 0 of 13 in Blotato's own sample. | Docs only |

### Support responsiveness (cross-cutting, not a rule)

9 of the in-window Trustpilot complaints also say support did not answer or was "mostly a chatbot". A copilot that answers billing and access questions on the first touch addresses the theme that drives every 1-star review found.

### Doc-only topics (Blotato wrote FAQ entries, so support sees them; no public report found)

Text over platform limit (error 20005), daily post caps (YouTube 10, Facebook 25, LinkedIn 50 per account per 24h), TikTok Starter "3 unique accounts in 24 hours", Instagram 5-hashtag cap, Threads "API Feature Not Available", Facebook "(#100) global id not allowed" (wrong Page ID), Facebook "Please reduce the amount of data", YouTube upload quota and "Unauthorized", X "not permitted" and 2-minute video limit, n8n Binary Data 15 MB limit, multi-paragraph text needing toJsonString(), Facebook/LinkedIn Pages missing from the n8n dropdown. Sources: https://help.blotato.com/support/errors.md, https://help.blotato.com/start-with-an-ai-agent/faqs.md, https://help.blotato.com/integrations-and-automation-templates/n8n/faqs.md.

## New rules worth adding

Ordered by evidence count. Each rule lists the cause, the fix, and the doc page that confirms the fix.

1. **billing-trial-api-key** (7 reports)
   - Cause: generating an API key in Settings > API ends the free trial at that moment and starts the paid plan, even with trial days left. Assumption: this explains at least the "charged during trial" reviews (2026-07-30, older 2025-08-31 and 2025-10-21); the reviews do not say they made a key.
   - Fix: tell the user the key started billing; to stop, Settings > Billing > View Billing Portal > cancel; check refund status by Stripe receipt email, bank statement, or support chat (works even after access ends). For "cannot cancel / charged twice / refund refused", hand off to a human with the Stripe evidence; the copilot should not promise refunds.
   - Confirms: https://help.blotato.com/settings/billing-and-credits.md ("Generating an API key ends your free trial immediately", "Cancel Account", "How to check refund status after cancelling").

2. **n8n-node-install** (6 reports)
   - Cause: Verified Community Nodes off (n8n Cloud), community packages disabled (self-hosted), a non-owner trying to install, or a template imported before the node existed.
   - Fix: Cloud: instance owner enables Verified Community Nodes in the Admin Panel, then searches "Blotato" in the node panel and clicks Install. Self-hosted: owner installs `@blotato/n8n-nodes-blotato` under Settings > Community Nodes; admin checks `N8N_COMMUNITY_PACKAGES_ENABLED`. Then re-import the template. For "Checksum verification failed" the docs say nothing; forum fixes were upgrading n8n, a fresh install, or retrying (forum-sourced, not doc-confirmed).
   - Confirms: https://help.blotato.com/integrations-and-automation-templates/n8n/n8n-blotato-node.md ("Install the Blotato Node", "Template shows question marks"), https://help.blotato.com/integrations-and-automation-templates/n8n/faqs.md ("Having issues with the Blotato node in n8n?").

3. **google-drive-and-host-blocked media** (extend media-90009; 4 reports)
   - Cause: `drive.google.com/uc?export=download` or `/file/d/` links return an HTML virus-scan page for large files; signed or preview URLs expire before publish; hosts behind Cloudflare or bot protection throttle Blotato's server fetch, so "Failed to read media metadata" happens even when the user's own curl returns 200.
   - Fix: detect Drive URLs and rewrite to `https://drive.usercontent.google.com/download?id=FILE_ID&export=download&confirm=t` with "Anyone with the link" sharing; otherwise use presigned upload (`POST /v2/media/uploads`) or a public S3/GCS bucket; never pass expiring signed URLs.
   - Confirms: https://help.blotato.com/support/errors.md ("Google Drive virus scan warning popup blocking media access"), https://help.blotato.com/start-with-an-ai-agent/faqs.md ("Google Drive file is too large to download?", "Failed to read media metadata ... works other times"), https://help.blotato.com/rest-api-reference/publish-post/upload-media-v2-media.md (presigned upload).

4. **upload-in-progress** (1 to 2 reports)
   - Cause: the same media URL was sent to /v2/media again within about 20 seconds while the first upload was still processing (parallel runs in Make or n8n).
   - Fix: the first upload usually succeeded; do not resubmit. Upload one item at a time (iterator plus wait) and reuse the returned Blotato URL.
   - Confirms: https://help.blotato.com/start-with-an-ai-agent/faqs.md ("A media upload for this URL is already in progress").

5. **silent-success-no-post** (1 report, plus Blotato's blog calls it the most frustrating forum bug)
   - Cause: a 2xx with `postSubmissionId` only means queued; the platform can still reject it. In n8n, a node that receives zero items is skipped and the run still shows Success.
   - Fix: poll `GET /v2/posts/{postSubmissionId}` until `published` or `failed` and read `errorMessage`; check Posts > Failed; in n8n check item counts per node before debugging Blotato.
   - Confirms: https://help.blotato.com/start-with-an-ai-agent/faqs.md ("API posting succeeded, but you don't see the uploaded video?"), https://help.blotato.com/start-with-an-ai-agent/publishing-status.md.

6. **tiktok-url-ownership** (1 report)
   - Cause: TikTok only pulls video from verified domains.
   - Fix: upload media to Blotato first, then post with the returned Blotato URL.
   - Confirms: https://help.blotato.com/start-with-an-ai-agent/faqs.md ("Error uploading video to TikTok: Please review our URL ownership verification rules").

7. **upload-201-created** (1 report)
   - Cause: client code accepts only 200, but `POST /v2/media/uploads` (and post creation) answer `201 Created`.
   - Fix: treat any 2xx as success; read `presignedUrl` and `publicUrl` from the body.
   - Confirms: https://help.blotato.com/rest-api-reference/publish-post/upload-media-v2-media.md ("Status Code: 201 Created").

8. **n8n-server-url** (older report only, cheap to add)
   - Cause: the n8n credential's "Blotato Server" set to `https://backend.blotato.com/v2`, which double-adds the path and returns "resource could not be found".
   - Fix: set it to `https://backend.blotato.com` with no `/v2`. Check whether the existing `wrong-host` rule already catches this.
   - Confirms: https://help.blotato.com/integrations-and-automation-templates/n8n/n8n-blotato-node.md (Configure and verify the credential, step 5). Report: https://community.n8n.io/t/130711 (2025-06).

9. **escalate-to-human** (no doc fix exists; route, don't answer)
   - tiktok-public-url (GitHub #9), linkedin NONEXISTENT_VERSION (GitHub #11), login-after-payment (Trustpilot), refund disputes. The copilot should collect postSubmissionId, timestamp, account, exact error and hand off. Confirms the evidence list: https://help.blotato.com/support/errors.md (top: "Preserve the error text, request ID, and submission ID when asking support").

10. **feature-gap-analytics** (2 reports)
    - Cause: user expects stats in Blotato. Assumption: the API FAQ now has "How do you get social analytics via API?", so this may be answerable now; read that entry before writing the rule.
    - Confirms: https://help.blotato.com/start-with-an-ai-agent/faqs.md ("How do you get social analytics (views, likes, etc.) via API?").

## Gaps and caveats

- Reddit (the requested r/n8n, r/socialmedia, r/automation) could not be read: Reddit blocks automated fetch and web search returned no Reddit threads. This is the largest hole; a manual Reddit search may add API-level reports.
- Capterra blocked fetch (403); G2 showed one review. Product Hunt comments were praise only.
- No public Blotato changelog exists, so "what changed recently" could not be checked against reports.
- Counts are small (largest is 7). The ranking says which ticket types are visible in public, not their share of real support volume.
