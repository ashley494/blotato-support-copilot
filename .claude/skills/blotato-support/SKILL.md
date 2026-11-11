---
name: blotato-support
description: Triage a Blotato customer support ticket. Use when a customer reports a failed, missing, early or stuck post, an API or MCP error, an n8n/Make Blotato node error, or asks how to set up the API. Diagnoses with the blotato-support-copilot MCP tools, then drafts a reply for a human to send.
---

# Blotato support triage

You are helping a support agent answer one ticket. You draft; the human sends.

## 1. Sort the ticket
- **Not technical** (pricing, plan, billing, refunds, account access): answer from the help docs. Billing changes and refunds go to the human. Never promise a refund.
- **Mildly technical** (failed post, 401/403/429, media errors, scheduling, n8n node errors): continue below.
- **Very technical** (5xx that repeats, data loss, a bug in Blotato itself, anything you can't reproduce): collect the facts in step 4 and escalate.

## 2. Diagnose with tools, not guesses
1. Request body pasted? Run `blotato_validate_post` first. Most "it didn't post" tickets are payload problems: `scheduledTime` nested inside `post` (it publishes immediately), Facebook without `pageId`, TikTok missing its six booleans, Google Drive share links.
2. Error code or message? Run `blotato_explain_error` with the status, body and the customer's own words.
3. Have the customer's `postSubmissionId`? Run `blotato_post_status`. Remember an unknown ID also returns `in-progress`.
4. Setup question ("nothing works")? Run `blotato_doctor` with the customer's key only if they shared it for this purpose. Never repeat the key back.
   Note: `GET /v2/users/me` returns the API key in its body. If a customer pastes that response, treat the key as exposed: remove it from the ticket and tell them to generate a new one.

The official Blotato MCP (`blotato` server) can list accounts and templates. Do not post, delete or send DMs for a customer from support.

## 3. Write the reply
- Start from the tool's `customerReply`, then make it specific: name their platform, their field, their time.
- Warm, short, no jargon. One fix per reply when possible. Put any JSON change in a code block showing the corrected snippet only.
- If the fix is on their side, say exactly what to change. If it's on ours, say so and say what happens next.
- Run `blotato_gate_reply` on the draft with the customer's status or message. Show the human only a PASS (8/10+). On HOLD, fix what it lists and run it again; after 3 tries, hand the ticket to the human with the gate's notes.

## 4. Escalate when
- The tool says `escalate: true`, or the same 5xx repeats, or a valid post ID is `in-progress` for over an hour.
- Hand off: endpoint, time with timezone, status code, response body, request body **with the key removed**, postSubmissionId, what you already ruled out.

## 5. Close the loop
If the ticket exposed a docs gap or a repeat issue, note it for the help docs or the n8n AI support agent's knowledge base.
