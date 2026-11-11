// Decides whether a reply can go to the customer (gate v5, after the third hostile review, 2026-11-11).
//
//   1. Safety screen (src/safety.ts): self-harm, security incidents, legal, privacy requests, shared passwords,
//      policy abuse, "let me talk to a person". Any hit: a person, no automatic reply.
//   2. Pattern checks (src/gate.ts): a known wrong fix, false fact or promise, an ambiguous ticket, or a status
//      code the customer's words don't back up: a person.
//   3. Nothing is sent on keyword rules alone. The AI judge reads the customer's actual words and must meet all
//      10 checks, built-in reply or not. With no AI judge configured, the reply is a draft for a person to send.
//
// Why step 3 changed: round 3 showed keyword rules can't tell "my post went out early" from "will my post go
// out early?", or a support question from one about our help-center page. Only something that reads the whole
// message can.
import { gateReply, CLAIMS, type GateResult } from "./gate.js";
import { judgeReply, type JudgeVerdict } from "./judge.js";
import { explainError, explanationFor } from "./explain.js";
import { classifyIssue } from "./classify.js";
import { safetyScreen, SAFETY_REPLY, looksEnglish } from "./safety.js";

type Backend = "api" | "claude-cli" | "off";

export interface Review {
  send: boolean;
  why: string;
  gate: GateResult;
  judge?: { score: number; pass: boolean; failed: string[]; verdict: JudgeVerdict };
}

// The judge is a model, so one sample can differ from the next (round 5: the same draft passed once and
// failed once). A reply sends only if every sample meets all 10 checks. COPILOT_JUDGE_SAMPLES, default 2.
async function judged(reply: string, issueId: string, customer: string, needsPerson: boolean, backend: Exclude<Backend, "off">) {
  const n = Math.max(1, Number(process.env.COPILOT_JUDGE_SAMPLES ?? 2));
  const runs = await Promise.all(Array.from({ length: n }, () => judgeReply(reply, { customer, correct: (CLAIMS[issueId] ?? CLAIMS.unknown).say, needsPerson }, backend)));
  const scores = runs.map((v) => v.checks.filter((c) => c.pass).length);
  const worst = runs[scores.indexOf(Math.min(...scores))];
  const failed = worst.checks.filter((c) => !c.pass).map((c) => `${c.id}: ${c.reason}`);
  return { score: Math.min(...scores), pass: scores.every((x) => x === 10), failed, verdict: worst, samples: scores };
}

export async function reviewReply(
  reply: string,
  issue: { status?: number; body?: unknown; message?: string },
  opts: { judge?: Backend } = {},
): Promise<Review> {
  const gate = gateReply({ reply, issue });
  if (issue.message && !looksEnglish(issue.message)) {
    return { send: false, why: "The ticket isn't in English; a person replies in the customer's language.", gate };
  }
  if (gate.safety.length || !(gate.pass || gate.needsJudge)) {
    return { send: false, why: gate.holdReason ?? `Pattern checks: ${gate.toFix.join(" ")}`, gate };
  }
  if (!opts.judge || opts.judge === "off") {
    return { send: false, why: `${gate.pass ? "Built-in reply passed the pattern checks" : "Draft passed the known-bad checks"}; nothing sends without the AI judge, so a person reviews and sends it.`, gate };
  }
  const customer = [issue.status ? `HTTP ${issue.status}` : "", issue.message ?? ""].join(" ").trim();
  const j = await judged(reply, gate.expected!.id, customer, gate.expected!.escalate, opts.judge);
  return { send: j.pass, why: j.pass ? "Pattern checks and the AI judge (all 10) passed." : `AI judge: ${j.failed.join(" | ")}`, gate, judge: j };
}

// Whole ticket, end to end.
export async function triage(
  issue: { status?: number; body?: unknown; message?: string },
  opts: { ai?: Backend } = {},
): Promise<{ diagnosis: string; by: "rules" | "ai" | "none" | "safety"; reply: string; send: boolean; why: string }> {
  const flags = safetyScreen(issue.message ?? "");
  if (flags.length) {
    return { diagnosis: flags.map((f) => f.id).join("+"), by: "safety", reply: SAFETY_REPLY, send: false, why: `To a person: ${flags.map((f) => f.reason).join(" ")}` };
  }
  if (issue.message && !looksEnglish(issue.message)) {
    return { diagnosis: "other-language", by: "safety", reply: "", send: false, why: "The ticket isn't in English; a person replies in the customer's language." };
  }
  const ai = opts.ai ?? "off";
  const hits = explainError(issue);
  const matched = hits.filter((h) => h.id !== "unknown");
  // With the AI on, Claude diagnoses every ticket too (round 4: the safety words are English-only, and a rule
  // can match a minor detail). Two independent diagnoses must agree, and Claude's "needs a person" always wins.
  const pick = ai !== "off" && issue.message ? await classifyIssue(issue.message, ai) : undefined;
  if (pick?.needsPerson) return { diagnosis: pick.id, by: "ai", reply: SAFETY_REPLY, send: false, why: `AI: needs a person. ${pick.reason}` };
  if (pick && matched.length >= 1 && pick.id !== hits[0].id) {
    return { diagnosis: `${hits[0].id} vs ${pick.id}`, by: "rules", reply: hits[0].customerReply, send: false,
      why: `The rules say ${hits[0].id} but the AI says ${pick.id}. A person picks.` };
  }
  if (matched.length >= 1) {
    const r = await reviewReply(hits[0].customerReply, issue, { judge: ai });
    const needsPerson = hits[0].escalate;
    return { diagnosis: hits[0].id, by: "rules", reply: hits[0].customerReply, send: r.send && !needsPerson,
      why: needsPerson ? "This issue type always goes to a person (the reply tells the customer so)." : r.why };
  }
  if (ai === "off" || !issue.message) {
    return { diagnosis: "unknown", by: "none", reply: hits[0].customerReply, send: false, why: "No rule matched; a person takes it." };
  }
  if (!pick) return { diagnosis: "unknown", by: "none", reply: hits[0].customerReply, send: false, why: "No rule matched; a person takes it." };
  if (pick.id === "unknown") return { diagnosis: "unknown", by: "ai", reply: hits[0].customerReply, send: false, why: `AI: ${pick.reason}` };
  const rule = explanationFor(pick.id, { message: issue.message });
  if (!rule) return { diagnosis: pick.id, by: "ai", reply: hits[0].customerReply, send: false, why: "AI picked an issue the rules can't draft for; a person takes it." };
  if (rule.escalate) return { diagnosis: pick.id, by: "ai", reply: rule.customerReply, send: false, why: "AI-picked issue that always goes to a person." };
  const j = await judged(rule.customerReply, pick.id, issue.message, false, ai);
  return { diagnosis: pick.id, by: "ai", reply: rule.customerReply, send: j.pass,
    why: j.pass ? `AI picked ${pick.id} (${pick.reason}); the AI judge passed the reply on all 10 checks.` : `AI picked ${pick.id}; judge failed: ${j.failed.map((f) => f.split(":")[0]).join(", ")}` };
}
