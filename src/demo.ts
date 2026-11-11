// `npm run demo`: the whole copilot in about a minute, no API key, no network.
// Runs against the bundled mock (same response shapes as Blotato's docs and the 2026-11-10 live run).
import { readFileSync } from "node:fs";
import { startMock, MOCK_GOOD_KEY } from "./mock-server.js";
import { runDoctor, formatReport } from "./doctor.js";
import { validatePost, summarize } from "./validate.js";
import { explainError } from "./explain.js";
import { gateReply } from "./gate.js";

const h = (s: string) => console.log(`\n=== ${s} ===`);
const { server, baseUrl } = await startMock();
try {
  h("1. doctor: is the customer's setup right? (mock account)");
  console.log(formatReport(await runDoctor(MOCK_GOOD_KEY, { baseUrl })));

  h('2. validate: "my scheduled post went out right away"');
  const broken = JSON.parse(readFileSync(new URL("../../examples/broken-scheduled-tweet.json", import.meta.url), "utf8"));
  console.log(summarize(validatePost(broken)));

  h('3. explain: "I keep getting 401 even though I copied the key"');
  const e = explainError({ status: 401, message: "I keep getting 401 even though I copied the key" })[0];
  console.log(`${e.title}\nCause: ${e.cause}\nReply: ${e.customerReply}`);

  h("4. gate: three drafts for the same ticket (10 yes/no checks, see docs/scoring.md)");
  const issue = { message: "My scheduled post went out right away instead of tomorrow" };
  const drafts: Array<[string, string]> = [
    ["built-in reply", explainError(issue)[0].customerReply],
    ["polite but WRONG fix", "Sorry about that! Move scheduledTime inside the post object so Blotato reads it, then try again. Let me know!"],
    ["rude, no fix", "Obviously your scheduling is wrong, read the docs."],
  ];
  for (const [label, reply] of drafts) {
    const g = gateReply({ reply, issue });
    console.log(`${g.pass ? "PASS" : "HOLD"} ${g.score}/10  ${label}${g.criticalFailed.length ? `  (critical: ${g.criticalFailed.join(", ")})` : ""}`);
  }
  console.log("\nDone. Next: npm test, or see README for the CLI, MCP server and n8n flows.");
} finally {
  server.close();
}
