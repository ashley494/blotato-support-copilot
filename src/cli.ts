#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { runDoctor, formatReport } from "./doctor.js";
import { validatePost, summarize } from "./validate.js";
import { explainError } from "./explain.js";
import { BlotatoClient } from "./blotato.js";
import { gateReply } from "./gate.js";
import { reviewReply, triage } from "./review.js";

const [cmd, ...args] = process.argv.slice(2);
const key = process.env.BLOTATO_API_KEY;

const usage = `blotato-copilot <command>

  doctor                      Check key, accounts and pages for BLOTATO_API_KEY
  validate <file.json|->      Check a POST /v2/posts body without sending it
  explain [--status N] "msg"  Explain an error and draft the customer reply
  status <postSubmissionId>   Look up a post and explain the result
  triage [--ai claude-cli|api] "customer message"
                              The whole ticket: diagnose (rules, then the AI if no rule matches), draft the
                              reply, decide SEND or a person.
  gate [--status N] [--issue "msg"] [--judge claude-cli|api] "reply"
                              Check a reply with 10 yes/no checks (docs/scoring.md). SEND only after the
                              safety screen, all 10 pattern checks or known-bad checks, AND the AI judge
                              meeting all 10. Without --judge the best result is DRAFT OK (a person sends).

Set BLOTATO_BASE_URL to point at the mock server for offline demos.`;

async function main() {
  switch (cmd) {
    case "doctor": {
      const r = await runDoctor(key);
      console.log(formatReport(r));
      process.exitCode = r.healthy ? 0 : 1;
      break;
    }
    case "validate": {
      const src = !args[0] || args[0] === "-" ? readFileSync(0, "utf8") : readFileSync(args[0], "utf8");
      let body: unknown;
      try {
        body = JSON.parse(src);
      } catch (e: any) {
        console.log(`Not valid JSON: ${e.message}`);
        process.exitCode = 1;
        return;
      }
      const f = validatePost(body);
      console.log(summarize(f));
      process.exitCode = f.some((x) => x.severity === "error") ? 1 : 0;
      break;
    }
    case "explain": {
      let status: number | undefined;
      const rest: string[] = [];
      for (let i = 0; i < args.length; i++) {
        if (args[i] === "--status") status = Number(args[++i]);
        else rest.push(args[i]);
      }
      for (const e of explainError({ status, message: rest.join(" ") })) {
        console.log(`## ${e.title}${e.escalate ? "  (escalate)" : ""}\nCause: ${e.cause}\nFix:\n${e.fix.map((x) => `  - ${x}`).join("\n")}\nReply to customer:\n  ${e.customerReply}\n`);
      }
      break;
    }
    case "gate": {
      let status: number | undefined;
      let issue: string | undefined;
      let judge: "api" | "claude-cli" | "off" | undefined;
      const rest: string[] = [];
      for (let i = 0; i < args.length; i++) {
        if (args[i] === "--status") status = Number(args[++i]);
        else if (args[i] === "--issue") issue = args[++i];
        else if (args[i] === "--judge") judge = args[++i] as "api" | "claude-cli" | "off";
        else rest.push(args[i]);
      }
      const reply = rest.length === 1 && rest[0] === "-" ? readFileSync(0, "utf8") : rest.join(" ");
      const iss = status !== undefined || issue ? { status, message: issue } : undefined;
      const r = gateReply({ reply, issue: iss });
      console.log(`Pattern checks: ${r.score}/10  (${r.source === "builtin" ? "built-in reply" : "free-form draft"})${r.expected ? `  issue: ${r.expected.title}` : ""}`);
      for (const c of r.checks) console.log(`  ${c.pass ? "yes" : "NO "} ${c.id.padEnd(18)}${c.critical ? " CRITICAL" : "         "}  ${c.pass ? c.rule : c.note}`);
      let send = false;
      let why = r.holdReason ?? (r.pass ? "Built-in reply passed the pattern checks. Nothing sends without the AI judge (--judge), so a person sends it." : "Pattern checks failed.");
      if (judge && judge !== "off" && iss) {
        const rv = await reviewReply(reply, iss, { judge });
        send = rv.send;
        why = rv.why;
        if (rv.judge) console.log(`AI judge (${judge}): ${rv.judge.score}/10${rv.judge.failed.length ? "  failed: " + rv.judge.failed.join(" | ") : ""}`);
      }
      console.log(`${send ? "SEND" : r.pass && !judge ? "DRAFT OK" : "HOLD"}: ${why}`);
      process.exitCode = send ? 0 : 1;
      break;
    }
    case "triage": {
      let ai: "api" | "claude-cli" | "off" = "off";
      const rest: string[] = [];
      for (let i = 0; i < args.length; i++) {
        if (args[i] === "--ai") ai = args[++i] as "api" | "claude-cli";
        else rest.push(args[i]);
      }
      const r = await triage({ message: rest.join(" ") }, { ai });
      console.log(`Issue:  ${r.diagnosis} (by ${r.by})\nReply:  ${r.reply}\n${r.send ? "SEND" : "TO A PERSON"}: ${r.why}`);
      process.exitCode = r.send ? 0 : 1;
      break;
    }
    case "status": {
      if (!key || !args[0]) {
        console.log("Need BLOTATO_API_KEY and a postSubmissionId.");
        process.exitCode = 1;
        return;
      }
      const r = await new BlotatoClient({ apiKey: key }).postStatus(args[0]);
      console.log(JSON.stringify(r.ok ? r.data : { status: r.status, explanation: explainError({ status: r.status, body: r.errorBody }) }, null, 2));
      if (r.ok && r.data?.status === "failed") {
        const e = explainError({ message: r.data.errorMessage ?? "" })[0];
        console.log(`\n${e.title}: ${e.cause}\nFix: ${e.fix.join(" ")}`);
      }
      break;
    }
    default:
      console.log(usage);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
