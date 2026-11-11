# Can I delete or undo a post after it's published?

**Short answer:** Not from Blotato. Once a post is live, you delete it on the social platform itself; Blotato can only cancel posts that are still scheduled.

## Delete a post that's already live

Sign in to the platform with the account the post went to, then:

1. **LinkedIn:** Open the post, click the three dots (...) at its top right, and choose Delete.
2. **X:** Open the post, click the three dots (...) and choose Delete.
3. **Facebook:** Find the post on your profile or Page, click the three dots (...) and choose Delete or Move to trash.
4. **Instagram:** Open the post, tap the three dots (...) and choose Delete.

If you posted to more than one account, delete it on each one.

Deleting a post's record inside Blotato (for example, a failed post) does not remove anything from the platform.

## Stop a post that hasn't gone out yet

1. In Blotato, open Posts and choose Scheduled.
2. Find the post and choose Move to drafts.
3. It won't publish, and you keep the content to edit or reschedule.

## For API, n8n and Make users

- No API or MCP call deletes a post that has already published.
- To cancel a scheduled post, list your schedules with `GET /v2/schedules` (MCP: `blotato_list_schedules`), copy the schedule ID, then call `DELETE /v2/schedules/{id}` (MCP: `blotato_delete_schedule`). This can't be undone. The schedule ID is not the postSubmissionId.
- In n8n or Make, send these calls with an HTTP Request node or module and your `blotato-api-key` header.
- After you cancel, the old postSubmissionId reads `in-progress`. That's expected: the post will not publish.

**Still stuck?** Send support the account and platform, the post's link or postSubmissionId, and whether Blotato shows it as Scheduled or Published. Never send your API key.
