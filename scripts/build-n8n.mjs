// Builds n8n/support-triage.json: a drop-in triage + reply-gate flow for an n8n support agent.
// The copilot's rules are bundled into one Code node, so the flow needs no server and no npm install.
import { build } from "esbuild";
import { writeFileSync } from "node:fs";

const result = await build({
  entryPoints: ["src/n8n-entry.ts"],
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2020",
  write: false,
  legalComments: "none",
});
// n8n's task runner (N8N_RUNNERS_ENABLED) did not see esbuild's getter-based IIFE exports
// ("Copilot.explainError is not a function", found running the flow live). Plain ESM top-level
// functions plus a plain object work in both the runner and the legacy sandbox.
const esm = result.outputFiles[0].text;
const m = esm.match(/export\s*\{([^}]*)\};?\s*$/);
if (!m) throw new Error("could not find the export list in the bundle");
const pairs = m[1].split(",").map((x) => x.trim()).filter(Boolean).map((x) => {
  const [local, exported] = x.split(/\s+as\s+/);
  return `${exported ?? local}: ${local}`;
});
const bundle = esm.slice(0, m.index) + `const Copilot = { ${pairs.join(", ")} };\n`;

const glue = `
// ---- Blotato support copilot: triage, safety screen and pattern checks ----
// Input (webhook JSON body): message (what the customer said), optional status, errorBody,
// requestBody (their POST /v2/posts body) and draftReply (a reply your AI agent already wrote).
// Output route: "judge" = ready for the AI judge (next node); "human" = a person takes it.
// Nothing is sent from here: only the AI judge, which reads the customer's whole message, can clear a reply.
const results = [];
for (const item of $input.all()) {
  const t = item.json.body ?? item.json;
  const status = t.status !== undefined && t.status !== "" ? Number(t.status) : undefined;
  const message = String(t.message ?? "").slice(0, 4000);
  const flags = Copilot.safetyScreen(message);
  if (message && !Copilot.looksEnglish(message)) flags.push({ id: "other-language", reason: "Not in English; a person replies in the customer's language." });
  const validation = t.requestBody ? Copilot.validatePost(t.requestBody) : [];
  const diagnoses = Copilot.explainError({ status, body: t.errorBody, message });
  const top = diagnoses[0];
  const reply = flags.length ? Copilot.SAFETY_REPLY : (t.draftReply || top.customerReply);
  const gate = Copilot.gateReply({ reply, issue: { status, body: t.errorBody, message } });
  const ready = !flags.length && !top.escalate && (gate.pass || gate.needsJudge);
  results.push({ json: {
    route: ready ? "judge" : "human",
    why: flags.length ? "Safety screen: " + flags.map((f) => f.reason).join(" ")
      : top.escalate ? "This issue type always goes to a person."
      : ready ? "Passed the pattern checks; the AI judge decides."
      : (gate.holdReason ?? "Reply failed the gate: " + gate.toFix.join(" ")),
    diagnosis: { id: top.id, title: top.title, cause: top.cause, fix: top.fix, escalate: top.escalate },
    otherPossibleCauses: diagnoses.slice(1, 3).map((d) => d.id),
    payloadProblems: validation,
    safety: flags,
    reply, message, status: status ?? null, errorBody: t.errorBody ?? null,
    gate: { score: gate.score, pass: gate.pass, source: gate.source, needsJudge: gate.needsJudge, criticalFailed: gate.criticalFailed, toFix: gate.toFix },
  } });
}
return results;
`;

const jsCode = bundle + "\n" + glue;

const workflow = {
  id: "blotatoTriage001",
  name: "Blotato support triage and reply gate",
  nodes: [
    {
      parameters: { httpMethod: "POST", path: "support-ticket", responseMode: "responseNode", options: {} },
      id: "t1", name: "New ticket", type: "n8n-nodes-base.webhook", typeVersion: 2, position: [0, 0],
      webhookId: "6f1c2b9e-4a1d-4e57-9c1b-2d7e8a0b5c31",
    },
    {
      parameters: { jsCode },
      id: "t2", name: "Diagnose, draft, safety + checks", type: "n8n-nodes-base.code", typeVersion: 2, position: [240, 0],
      onError: "continueErrorOutput",
    },
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: "", typeValidation: "strict" },
          conditions: [{ id: "r1", leftValue: "={{ $json.route }}", rightValue: "judge", operator: { type: "string", operation: "equals" } }],
          combinator: "and",
        },
        options: {},
      },
      id: "t3", name: "Ready for the AI judge?", type: "n8n-nodes-base.if", typeVersion: 2, position: [480, 0],
    },
    {
      // The copilot service (npm run serve) runs the AI judge on the customer's whole message: all 10 checks.
      parameters: {
        method: "POST",
        url: "http://127.0.0.1:8787/review",
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={{ JSON.stringify({ reply: $json.reply, message: $json.message, status: $json.status, errorBody: $json.errorBody }) }}",
        options: { timeout: 180000 },
      },
      id: "t6", name: "AI judge (copilot service)", type: "n8n-nodes-base.httpRequest", typeVersion: 4.2, position: [720, -80],
      onError: "continueErrorOutput",
    },
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: "", typeValidation: "loose" },
          conditions: [{ id: "r2", leftValue: "={{ $json.send }}", rightValue: true, operator: { type: "boolean", operation: "true", singleValue: true } }],
          combinator: "and",
        },
        options: {},
      },
      id: "t7", name: "Judge says send?", type: "n8n-nodes-base.if", typeVersion: 2, position: [960, -80],
    },
    {
      parameters: { respondWith: "json", responseBody: "={{ JSON.stringify({ route: 'send', reply: $('Diagnose, draft, safety + checks').item.json.reply, diagnosis: $('Diagnose, draft, safety + checks').item.json.diagnosis.id, why: $json.why }) }}", options: {} },
      id: "t4", name: "Send reply (or post to chat)", type: "n8n-nodes-base.respondToWebhook", typeVersion: 1.1, position: [1200, -160],
    },
    {
      parameters: { respondWith: "json", responseBody: "={{ JSON.stringify({ route: 'human', reply: $('Diagnose, draft, safety + checks').item.json.reply, diagnosis: $('Diagnose, draft, safety + checks').item.json.diagnosis.id, why: $json.why ?? $('Diagnose, draft, safety + checks').item.json.why }) }}", options: { responseCode: 202 } },
      id: "t5", name: "Hand to a human", type: "n8n-nodes-base.respondToWebhook", typeVersion: 1.1, position: [1200, 120],
    },
  ],
  connections: {
    "New ticket": { main: [[{ node: "Diagnose, draft, safety + checks", type: "main", index: 0 }]] },
    // output 1 = the Code node threw: a person gets the ticket instead of the customer getting silence
    "Diagnose, draft, safety + checks": { main: [[{ node: "Ready for the AI judge?", type: "main", index: 0 }], [{ node: "Hand to a human", type: "main", index: 0 }]] },
    "Ready for the AI judge?": { main: [[{ node: "AI judge (copilot service)", type: "main", index: 0 }], [{ node: "Hand to a human", type: "main", index: 0 }]] },
    // judge unreachable or erroring = a person
    "AI judge (copilot service)": { main: [[{ node: "Judge says send?", type: "main", index: 0 }], [{ node: "Hand to a human", type: "main", index: 0 }]] },
    "Judge says send?": { main: [[{ node: "Send reply (or post to chat)", type: "main", index: 0 }], [{ node: "Hand to a human", type: "main", index: 0 }]] },
  },
  settings: { executionOrder: "v1" },
  pinData: {},
};

const out = process.env.N8N_OUT ?? "n8n/support-triage.json";
writeFileSync(out, JSON.stringify(workflow, null, 2) + "\n");
console.log(`${out} written (Code node ${Math.round(jsCode.length / 1024)} KB)`);
