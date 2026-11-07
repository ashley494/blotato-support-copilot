#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { runDoctor, formatReport } from "./doctor.js";
import { validatePost, summarize } from "./validate.js";
import { explainError } from "./explain.js";
import { BlotatoClient } from "./blotato.js";

const [cmd, ...args] = process.argv.slice(2);
const key = process.env.BLOTATO_API_KEY;

const usage = `blotato-copilot <command>

  doctor                      Check key, accounts and pages for BLOTATO_API_KEY
  validate <file.json|->      Check a POST /v2/posts body without sending it
  explain [--status N] "msg"  Explain an error and draft the customer reply
  status <postSubmissionId>   Look up a post and explain the result

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
