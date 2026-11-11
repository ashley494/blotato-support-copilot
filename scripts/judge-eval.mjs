// Runs every case in eval/judge-cases.json through reviewReply with the AI judge and reports
// false passes (a wrong draft sent) and false holds (a correct draft held). Usage:
//   COPILOT_JUDGE=claude-cli node scripts/judge-eval.mjs     (or =api with ANTHROPIC_API_KEY)
import { readFileSync, writeFileSync } from "node:fs";
const { reviewReply } = await import(new URL("../dist/src/review.js", import.meta.url));
const cases = JSON.parse(readFileSync(new URL("../eval/" + (process.env.CASES ?? "judge-cases.json"), import.meta.url)));
const judge = process.env.COPILOT_JUDGE ?? "claude-cli";
const out = [];
const queue = [...cases];
async function worker() {
  while (queue.length) {
    const c = queue.shift();
    const r = await reviewReply(c.reply, c.issue, { judge });
    const got = r.send ? "send" : "hold";
    out.push({ id: c.id, expect: c.expect, got, ok: got === c.expect, patterns: `${r.gate.score}/10 ${r.gate.criticalFailed.join(",") || "-"}`, judge: r.judge ? `${r.judge.score}/10` : "not run", why: r.why.slice(0, 220) });
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
out.sort((a, b) => a.id.localeCompare(b.id));
const fp = out.filter((o) => o.expect === "hold" && o.got === "send");
const fh = out.filter((o) => o.expect === "send" && o.got === "hold");
for (const o of out) console.log(`${o.ok ? "ok  " : "MISS"} ${o.id} expect=${o.expect} got=${o.got} patterns=${o.patterns} judge=${o.judge}${o.ok ? "" : "  " + o.why}`);
console.log(`\n${out.length} cases, judge=${judge}: false passes ${fp.length}, false holds ${fh.length}`);
writeFileSync(new URL("../eval/" + (process.env.CASES ?? "judge-cases.json").replace("cases", "results"), import.meta.url), JSON.stringify({ date: new Date().toLocaleDateString("en-CA"), judge, model: judge === "api" ? "claude-opus-5-5" : "claude-cli default", results: out }, null, 1) + "\n");
