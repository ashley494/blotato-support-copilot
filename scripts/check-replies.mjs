// Every built-in reply must pass the gate for the issue it answers. One trigger per rule;
// fails (exit 1) if a reply fails or a rule has no trigger here.
const { explainError } = await import(new URL("../dist/src/explain.js", import.meta.url));
const { gateReply } = await import(new URL("../dist/src/gate.js", import.meta.url));
const fs = await import("node:fs");
const TRIGGERS = [
  { message: "I can't log in to my account" },
  { message: "I was charged during my trial and can't cancel" },
  { message: "Unrecognized node type: @blotato/n8n-nodes-blotato.blotato" },
  { message: "the Blotato node crashed: Cannot read properties of undefined" },
  { message: "Blotato server set to https://backend.blotato.com/v2 and it says the resource could not be found" },
  { message: "A media upload for this URL is already in progress" },
  { message: "n8n says success but nothing posted to Instagram" },
  { message: "my HTTP node throws an error but the response is 201 Created" },
  { message: "Please review our URL ownership verification rules" },
  { message: "the publicUrl for my TikTok post points to my profile, not the post" },
  { message: "LinkedIn error NONEXISTENT_VERSION" },
  { status: 401 }, { status: 403 }, { status: 429, body: { message: "Rate limit exceeded, retry in 49 seconds" } },
  { message: "Unsupported media type" }, { body: { code: 90009 } }, { message: "Unknown template ID" },
  { status: 422 }, { message: "where do I find my accountId and pageId?" }, { status: 404 },
  { message: "calling https://api.blotato.com/v2/posts fails" }, { message: "getaddrinfo ENOTFOUND backend.blotato.com" },
  { message: "my post was published immediately instead of at 9am" }, { message: "my post is stuck in-progress" },
  { message: "the AI video used all my credits and the quality is bad" }, { message: "how do I get analytics for my posts?" },
  { status: 500 }, { message: "the sky is green" },
  { message: "my Claude Desktop MCP server url is wrong and it will not connect" },
  { message: "the post went out at 1 AM instead of 9 AM, hours early" },
];
const src = fs.readFileSync(new URL("../src/explain.ts", import.meta.url), "utf8");
const allIds = [...src.matchAll(/id: "([a-z0-9-]+)"/g)].map((m) => m[1]);
const covered = new Set();
let bad = 0;
for (const issue of TRIGGERS) {
  const e = explainError(issue)[0];
  covered.add(e.id);
  const g = gateReply({ reply: e.customerReply, issue });
  if (!g.pass) { bad++; console.log(`FAIL ${e.id}: ${g.score}/10 critical: ${g.criticalFailed.join(",") || "none"} | ${g.toFix.join(" | ")} ${g.holdReason ?? ""}`); }
}
const missing = allIds.filter((id) => !covered.has(id));
if (missing.length) console.log(`No trigger reaches: ${missing.join(", ")}`);
console.log(`${covered.size - bad} of ${allIds.length} built-in replies checked and passing`);
process.exitCode = bad || missing.length ? 1 : 0;
