# Blotato Support Copilot

A support engineer's toolkit for the [Blotato](https://www.blotato.com) API. It answers the three questions behind most "my post didn't go out" tickets:

1. **Is the setup right?** `doctor` checks the API key, connected accounts, Facebook and LinkedIn pages, and expired connections, and stops at the first real problem.
2. **Is the request right?** `validate` checks a `POST /v2/posts` body against Blotato's documented rules *before* it is sent.
3. **What does this error mean?** `explain` turns a status code, error body or the customer's own words into a cause, a fix, an escalate yes/no, and a friendly reply.

It ships as a **CLI**, an **MCP server** for Claude Code / Codex / Cursor, a **Claude Code skill** for ticket triage, and an **n8n workflow** that flags expired social connections every day.

## Why these checks

Each rule comes from Blotato's own docs, and each one maps to a ticket someone will send:

| Customer says | What actually happened | Caught by |
|---|---|---|
| "My scheduled post went out right away" | `scheduledTime` was nested inside `post`, where it is ignored | `validate` |
| "I get 401 but I copied the key" | The trailing `=` was dropped, or a space/quote/`Bearer ` crept in | `doctor`, `explain` |
| "Facebook post fails" | `target.pageId` missing | `validate`, `doctor` lists the page IDs |
| "TikTok post rejected" | One of the six required booleans or `privacyLevel` missing | `validate` |
| "Media error 90009" | Google Drive share page or Dropbox `dl=0` link, not the file | `validate` rewrites the Drive URL |
| "Post stuck in-progress" | Wrong `postSubmissionId` (unknown IDs also return in-progress) | `explain`, `status` |
| "Rate limit exceeded" | Polling faster than the per-route limit | client retries with the server's wait time; `explain` |
| "LinkedIn page list errors" | Connection expired (422) | `doctor`, n8n health check |

## Quick start

```bash
npm install
npm run build
export BLOTATO_API_KEY='your key, including any = at the end'

node dist/src/cli.js doctor
node dist/src/cli.js validate examples/broken-scheduled-tweet.json   # the classic mistake
node dist/src/cli.js validate examples/fixed-scheduled-tweet.json    # passes
node dist/src/cli.js explain --status 429 "Rate limit exceeded, retry in 49 seconds"
node dist/src/cli.js status <postSubmissionId>
```

No key yet? Run against the bundled mock (same response shapes as the docs):

```bash
npm run mock      # prints the BLOTATO_BASE_URL and test key to export
```

## MCP: two servers, two jobs

`.mcp.json` registers both:

- **`blotato`** (official, `https://mcp.blotato.com/mcp`): does things. Lists accounts, creates posts and visuals, uploads media.
- **`blotato-support-copilot`** (this repo, stdio): supports people. Diagnoses, validates and explains. `blotato_publish_post` is a **dry run unless `dryRun: false`**, so an agent can't post for a customer by accident.

Tools: `blotato_doctor`, `blotato_validate_post`, `blotato_explain_error`, `blotato_post_status`, `blotato_publish_post`.

```bash
claude mcp add --transport http blotato https://mcp.blotato.com/mcp --header "blotato-api-key: $BLOTATO_API_KEY"
claude mcp add blotato-support-copilot -- node "$(pwd)/dist/src/mcp.js"
```

## Claude Code skill

`.claude/skills/blotato-support/SKILL.md` teaches Claude Code to triage a ticket: sort it (non-technical, mildly technical, escalate), diagnose with the MCP tools instead of guessing, draft the reply, and hand off cleanly with the key removed.

## Scheduled agent task

Run the doctor every morning and only speak up when something breaks:

```bash
# crontab -e
7 8 * * * cd /path/to/blotato-support-copilot && BLOTATO_API_KEY=... node dist/src/cli.js doctor > /tmp/blotato-doctor.txt || claude -p "Read /tmp/blotato-doctor.txt and write a 3-line summary of what broke and the fix." 
```

## n8n

`n8n/connection-health-check.json`: import into n8n, set `BLOTATO_API_KEY` as an environment variable. Daily it lists accounts, checks each Facebook and LinkedIn connection 2.5 seconds apart (under the rate limit), and outputs only the broken ones with the action to take. Wire the last node to email, Slack or Discord.

## Tests

```bash
npm test   # 20 tests: validator rules, explainer, key checks, doctor, 429 retry, publish/status round trip
```

The doctor, retry and round-trip tests run against the local mock server, which needs permission to open a local port.

## Status

- Validator, explainer, CLI and MCP server: built and tested (20/20) against Blotato's documented request and response shapes.
- Live API: not yet run against a real key. Rules and shapes come from Blotato's docs (Nov 2026).
- n8n workflow: importable JSON, not yet run in an n8n instance.

## License

MIT
