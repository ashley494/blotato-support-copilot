# Live test against the real Blotato API (2026-11-10)

Account: Blotato Starter, one connected LinkedIn personal profile. Key loaded from a gitignored `.env`, never printed.

## What ran

| Step | Result |
|---|---|
| `doctor` | All checks pass: key format, `GET /v2/users/me` accepted, 1 LinkedIn account, no company pages |
| `validate` on a scheduled LinkedIn body (`scheduledTime` at the root) | No problems found |
| `POST /v2/posts` with `scheduledTime` 2026-12-10T17:07:00Z | 201, `postSubmissionId` returned, scheduled time echoed back |
| `GET /v2/posts/:id` after 12 s | `status: "scheduled"` |
| `GET /v2/posts/:id` with an all-zero ID | `status: "in-progress"` (confirms the doc's warning: unknown IDs do not 404) |
| Cancel via the official Blotato MCP (`blotato_delete_schedule`) | Schedule removed, calendar empty |
| `GET /v2/posts/:id` after cancelling | `status: "in-progress"` |
| Earlier the same day: immediate LinkedIn post through the official MCP | Published, then deleted on LinkedIn by hand |

Nothing stayed public.

## What the live run found that the mock didn't

1. **Network failures were misdiagnosed.** A run from a sandboxed network failed DNS for the correct host (`ENOTFOUND backend.blotato.com`). The `wrong-host` rule matched any `ENOTFOUND` and told the user to stop using api.blotato.com, which they weren't using. Fixed: `wrong-host` now fires only when api.blotato.com is actually in the text, and a new `network-unreachable` rule covers DNS, proxy, firewall and certificate failures with a curl check. A regression test covers both.
2. **LinkedIn accounts come back with `username: ""`.** The doctor printed `linkedin @`. Fixed to fall back to `fullname`.
3. **A cancelled schedule also reads `in-progress`.** So "my post is stuck in-progress" has three causes, not two: still publishing, wrong ID, or the schedule was deleted. The `stuck-in-progress` rule now says so.
4. **Schedules have their own ID.** The schedule ID (a number) is not the `postSubmissionId` (a UUID). To cancel, find it in the calendar list first.
5. **There is no API or MCP call to delete a post that has already published** (checked in the MCP tool list and the API reference on 2026-11-10). "Undo that post" has to happen on the platform itself. Worth a help-doc line.
6. **`GET /v2/users/me` returns the API key in its body.** If a customer pastes that response into a ticket, their key is exposed. The triage skill now says to remove it and have them generate a new key.

## Real response shapes (values removed)

```
GET /v2/users/me                         {"id","subscriptionStatus","apiKey","subscriptionPlan"}
GET /v2/users/me/accounts                {"items":[{"id","platform","username","fullname"}]}
GET /v2/users/me/accounts/:id/subaccounts {"items":[]}
POST /v2/posts (scheduled)               201 {"postSubmissionId","scheduledTime"}
GET /v2/posts/:id                        {"postSubmissionId","status"[,"scheduledTime"]}
```

Tests right after the live fixes: 27 of 27 passed. More tests were added later the same night (replay, gate v2 and v3, n8n drift); run `npm test` for the current count.

## n8n run (same night)

Both flows ran in a local n8n 1.123. The health check reached the real account, checked the LinkedIn connection (HTTP 200) and correctly output nothing broken. The triage flow answered webhook tickets. One more bug came out of running it for real: with n8n's task runner turned on, the bundled Code node failed with "Copilot.explainError is not a function", because the runner doesn't see the bundler's getter-based exports. The build now emits plain functions, and the same tickets pass with the runner on.
