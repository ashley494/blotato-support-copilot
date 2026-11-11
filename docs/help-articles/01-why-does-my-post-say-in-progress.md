# Why does my post say "in-progress"?

**Short answer:** "In-progress" means Blotato found no scheduled, published or failed record for the ID you checked, and that happens for three different reasons.

## Find your reason

1. **Check your Posts screen first.** Open Posts and look under Scheduled, Published and Failed for the same account and content. If the post is there, that is its real status.
2. **Give it a few minutes.** A post that is still publishing reads in-progress. Videos take longer than text or images, so wait a few minutes and check again.
3. **Make sure you're checking the right ID.** A status check needs the postSubmissionId you got when you created the post. An ID that doesn't match any of your posts (a typo, or an ID copied from somewhere else) also reads in-progress instead of showing an error. Schedules have their own ID, separate from the postSubmissionId, so a schedule ID won't work here either.
4. **Check whether the schedule was cancelled.** If you, a teammate or an automation cancelled a scheduled post before its time, it will not publish, and its postSubmissionId reads in-progress from then on.

## For API, n8n and Make users

- `GET /v2/posts/{postSubmissionId}` returns `in-progress` as a fallback whenever it finds no matching record. Set a limit on how long you poll instead of polling forever.
- Schedule IDs come from `GET /v2/schedules` (MCP: `blotato_list_schedules`), not from the create-post response.
- Don't create the post again while its outcome is unknown, or you may get a duplicate.

**Still stuck?** Send support the postSubmissionId from the original create response, the account and platform, when you created or scheduled the post (with your time zone), and what you see under Posts. Never send your API key.
