// Real-ticket replay: runs the copilot on paraphrased public customer reports and measures
// how often the top explanation is the one a support engineer would pick, and whether the
// drafted reply passes the copilot's own gate. Cases: test/fixtures/real-tickets.json.
// Held-out A (written before tuning, but visible while tuning): test/fixtures/held-out-tickets.json.
// Held-out B (written blind by a separate agent after tuning, never used to tune): test/fixtures/held-out-blind.json.
//
// Writes the numbers and the per-case table into docs/replay-results.md between the
// replay markers; the hand-written analysis outside the markers is left alone.
// REPLAY_SAVE_BASELINE=1 npm test  stores this run as the baseline (do that only before rule changes).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { explainError } from "../src/explain.js";
import { gateReply } from "../src/gate.js";

interface Case {
  id: string;
  window?: "in" | "older";
  source: { url: string; date: string };
  customerText: string;
  status?: number;
  expectedId: string;
  newRule?: boolean;
  notes: string;
}

interface CaseResult {
  id: string;
  expectedId: string;
  got: string;
  top3: string[];
  hit: boolean;
  hit3: boolean;
  gateScore?: number;
  gatePass?: boolean;
  gateToFix?: string[];
}

interface Summary {
  cases: number;
  top1: number;
  top3: number;
  gatePass: number;
  results: CaseResult[];
}

// dist/test/replay.test.js -> project root
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FIX = join(ROOT, "test", "fixtures");
const DOC = join(ROOT, "docs", "replay-results.md");
const BASELINE = join(FIX, "replay-baseline.json");

// Regression floors, set to the measured "after" numbers so a rule change that loses a case fails the build.
const FLOOR = { realTop1: 48, heldOutTop1: 8, blindTop1: 10 };

const load = (f: string): Case[] => JSON.parse(readFileSync(join(FIX, f), "utf8"));
const real = load("real-tickets.json");
const heldOut = load("held-out-tickets.json");
const blind = load("held-out-blind.json");

type Baseline = { real: Summary; heldOut: Summary; heldOutBlind?: Summary };

function replay(cases: Case[]): Summary {
  const results = cases.map((c): CaseResult => {
    const issue = { status: c.status, message: c.customerText };
    const hits = explainError(issue);
    const top3 = hits.slice(0, 3).map((h) => h.id);
    const r: CaseResult = { id: c.id, expectedId: c.expectedId, got: hits[0].id, top3, hit: hits[0].id === c.expectedId, hit3: top3.includes(c.expectedId) };
    if (r.hit) {
      const g = gateReply({ reply: hits[0].customerReply, issue, expectedId: c.expectedId });
      r.gateScore = g.score;
      r.gatePass = g.pass;
      r.gateToFix = g.toFix;
    }
    return r;
  });
  return {
    cases: cases.length,
    top1: results.filter((r) => r.hit).length,
    top3: results.filter((r) => r.hit3).length,
    gatePass: results.filter((r) => r.gatePass).length,
    results,
  };
}

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "n/a");
const line = (s: Summary) =>
  `${s.top1}/${s.cases} (${pct(s.top1, s.cases)}) | ${s.top3}/${s.cases} (${pct(s.top3, s.cases)}) | ${s.gatePass}/${s.top1} (${pct(s.gatePass, s.top1)}) | ${s.gatePass}/${s.cases} (${pct(s.gatePass, s.cases)})`;

function short(s: string, n = 80): string {
  const t = s.replace(/\|/g, "/").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 3).trimEnd()}...` : t;
}

function table(cases: Case[], after: Summary, before?: Summary): string {
  const rows = cases.map((c) => {
    const a = after.results.find((r) => r.id === c.id)!;
    const b = before?.results.find((r) => r.id === c.id);
    const src = c.source.url.startsWith("http") ? `[${c.source.date}](${c.source.url})` : c.source.date;
    const exp = `${c.expectedId}${c.newRule ? " (new)" : ""}`;
    const gate = a.hit ? `${a.gateScore} ${a.gatePass ? "pass" : "FAIL"}` : "";
    const hit = a.hit ? "yes" : a.hit3 ? "top-3" : "no";
    return `| ${c.id} | ${src} | ${short(c.customerText)} | ${exp} | ${b ? b.got : ""} | ${a.got} | ${hit} | ${gate} |`;
  });
  return ["| Case | Source | Complaint | Expected | Baseline got | After got | Hit? | Gate |", "|---|---|---|---|---|---|---|---|", ...rows].join("\n");
}

function render(r: Summary, h: Summary, b: Summary, base?: Baseline): string {
  const head = "| Set | Run | Top-1 hit | Top-3 hit | Gate pass (of top-1 hits) | Correct and gate-passing (of all) |\n|---|---|---|---|---|---|";
  const rows = [
    base && `| Real (${r.cases}) | Baseline | ${line(base.real)} |`,
    `| Real (${r.cases}) | After | ${line(r)} |`,
    base && `| Held-out A (${h.cases}) | Baseline | ${line(base.heldOut)} |`,
    `| Held-out A (${h.cases}) | After | ${line(h)} |`,
    base?.heldOutBlind && `| Held-out B, blind (${b.cases}) | Baseline | ${line(base.heldOutBlind)} |`,
    `| Held-out B, blind (${b.cases}) | After | ${line(b)} |`,
  ].filter(Boolean);
  const inWin = real.filter((c) => c.window === "in").map((c) => c.id);
  const sub = (ids: string[], s: Summary) => {
    const rs = s.results.filter((x) => ids.includes(x.id));
    return `${rs.filter((x) => x.hit).length}/${rs.length}`;
  };
  const older = real.filter((c) => c.window !== "in").map((c) => c.id);
  return [
    "<!-- replay:start (generated by test/replay.test.ts; edits inside these markers are overwritten) -->",
    "",
    "### Numbers",
    "",
    head,
    ...rows,
    "",
    `Top-1 by window, after: in-window ${sub(inWin, r)}, older ${sub(older, r)}.` + (base ? ` Baseline: in-window ${sub(inWin, base.real)}, older ${sub(older, base.real)}.` : ""),
    "",
    "### Every real case",
    "",
    table(real, r, base?.real),
    "",
    "### Held-out A (written before tuning)",
    "",
    table(heldOut, h, base?.heldOut),
    "",
    "### Held-out B (written blind by a separate agent after tuning)",
    "",
    table(blind, b, base?.heldOutBlind),
    "",
    "<!-- replay:end -->",
  ].join("\n");
}

test("replay: real tickets and held-out tickets", () => {
  const r = replay(real);
  const h = replay(heldOut);
  const b = replay(blind);

  if (process.env.REPLAY_SAVE_BASELINE === "1") writeFileSync(BASELINE, JSON.stringify({ real: r, heldOut: h, heldOutBlind: b }, null, 2) + "\n");
  const base = existsSync(BASELINE) ? (JSON.parse(readFileSync(BASELINE, "utf8")) as Baseline) : undefined;

  const block = render(r, h, b, base);
  const doc = existsSync(DOC) ? readFileSync(DOC, "utf8") : "# Real-ticket replay\n\n<!-- replay:start -->\n<!-- replay:end -->\n";
  const next = /<!-- replay:start[\s\S]*?<!-- replay:end -->/.test(doc)
    ? doc.replace(/<!-- replay:start[\s\S]*?<!-- replay:end -->/, block)
    : `${doc.trimEnd()}\n\n${block}\n`;
  writeFileSync(DOC, next);

  console.log(`real: top1 ${r.top1}/${r.cases}, top3 ${r.top3}/${r.cases}, gate ${r.gatePass}/${r.top1}`);
  console.log(`held-out A: top1 ${h.top1}/${h.cases}, top3 ${h.top3}/${h.cases}, gate ${h.gatePass}/${h.top1}`);
  console.log(`held-out B (blind): top1 ${b.top1}/${b.cases}, top3 ${b.top3}/${b.cases}, gate ${b.gatePass}/${b.top1}`);
  for (const x of [...r.results, ...h.results, ...b.results]) {
    if (!x.hit) console.log(`  miss ${x.id}: expected ${x.expectedId}, got ${x.top3.join(", ")}`);
    else if (!x.gatePass) console.log(`  gate fail ${x.id} (${x.gateScore}): ${x.gateToFix?.join(" | ")}`);
  }

  // Every case id is unique across both sets, and held-out never reuses real wording.
  const ids = [...real, ...heldOut, ...blind].map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const c of [...heldOut, ...blind]) assert.ok(!real.some((x) => x.customerText === c.customerText), `${c.id} copies a real case`);

  if (process.env.REPLAY_SAVE_BASELINE === "1") return; // baseline run measures only
  assert.ok(r.top1 >= FLOOR.realTop1, `real top-1 fell to ${r.top1} (floor ${FLOOR.realTop1})`);
  assert.ok(h.top1 >= FLOOR.heldOutTop1, `held-out A top-1 fell to ${h.top1} (floor ${FLOOR.heldOutTop1})`);
  assert.ok(b.top1 >= FLOOR.blindTop1, `held-out B top-1 fell to ${b.top1} (floor ${FLOOR.blindTop1})`);
  for (const x of [...r.results, ...h.results, ...b.results].filter((x) => x.hit)) assert.ok(x.gatePass, `${x.id} reply failed the gate: ${x.gateToFix?.join(" | ")}`);
});
