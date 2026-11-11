// Scores held-out-blind-2 (20 tickets written 2026-11-10 by an agent that never saw this code) end to end.
//   node scripts/blind2.mjs                    rules only (free, instant)
//   AI=claude-cli node scripts/blind2.mjs      rules, then the AI classifier + judge for what the rules miss
const { triage } = await import(new URL("../dist/src/review.js", import.meta.url));
const fs = await import("node:fs");
const cases = JSON.parse(fs.readFileSync(new URL("../test/fixtures/held-out-blind-2.json", import.meta.url)));
const ai = process.env.AI ?? "off";
const t = { right: 0, sentRight: 0, sentWrong: 0, person: 0 };
const rows = [];
const queue = [...cases];
await Promise.all(Array.from({ length: 4 }, async () => { // 4 at a time: more parallel CLI calls fail and fall back to a person
  while (queue.length) { const c = queue.shift(); rows.push({ c, r: await triage({ message: c.customerText }, { ai }) }); }
}));
rows.sort((a, b) => a.c.id.localeCompare(b.c.id));
for (const { c, r } of rows) {
  const right = r.diagnosis === c.expectedId;
  if (right) t.right++;
  if (r.send && right) t.sentRight++; else if (r.send) t.sentWrong++; else t.person++;
  console.log(`${right ? "ok  " : "MISS"} ${c.id}${c.hard ? " (hard)" : "       "} expected=${c.expectedId.padEnd(22)} got=${r.diagnosis.padEnd(22)} by=${r.by.padEnd(5)} -> ${r.send ? (right ? "SEND" : "SEND WRONG") : "person"}`);
}
console.log(`\nai=${ai}: diagnosed right ${t.right}/20 | auto-sent right ${t.sentRight} | auto-sent WRONG ${t.sentWrong} | to a person ${t.person}`);
