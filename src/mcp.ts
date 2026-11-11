#!/usr/bin/env node
// MCP server (stdio). Gives Claude Code, Codex or any MCP client the support tools:
// diagnose a setup, validate a post body, explain an error, check a post, and (dry run by default) publish.
//
// Why a separate server when Blotato already ships one at https://mcp.blotato.com/mcp?
// Blotato's official MCP is for *doing* things (post, design, upload). This one is for *support*:
// it never posts unless told to, explains failures, and drafts the customer reply.
// Run both side by side; see .mcp.json.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { BlotatoClient } from "./blotato.js";
import { runDoctor, formatReport } from "./doctor.js";
import { validatePost, summarize } from "./validate.js";
import { explainError } from "./explain.js";
import { reviewReply } from "./review.js";

const server = new McpServer({ name: "blotato-support-copilot", version: "0.1.0" });

const text = (s: string) => ({ content: [{ type: "text" as const, text: s }] });
const keyOr = (k?: string) => k ?? process.env.BLOTATO_API_KEY;

server.tool(
  "blotato_doctor",
  "Check a Blotato setup end to end: key format, key accepted, connected accounts, Facebook/LinkedIn pages and expired connections. Stops at the first real problem and says how to fix it.",
  { apiKey: z.string().optional().describe("Customer's key. Defaults to BLOTATO_API_KEY. Never echo it back.") },
  async ({ apiKey }) => text(formatReport(await runDoctor(keyOr(apiKey)))),
);

server.tool(
  "blotato_validate_post",
  "Validate a POST /v2/posts JSON body against Blotato's documented rules without sending it. Catches nested scheduledTime (post goes out immediately), missing platform fields, Google Drive/Dropbox/local media links, and more.",
  { body: z.union([z.string(), z.record(z.any())]).describe("The request body, as JSON text or an object.") },
  async ({ body }) => {
    let parsed: unknown = body;
    if (typeof body === "string") {
      try {
        parsed = JSON.parse(body);
      } catch (e: any) {
        return text(`The body is not valid JSON: ${e.message}. That alone would make the request fail.`);
      }
    }
    return text(summarize(validatePost(parsed)));
  },
);

server.tool(
  "blotato_gate_reply",
  "Check a drafted customer reply with 10 yes/no checks (correct fix, no wrong fix, no false facts, no promises, escalation, action, specifics, no blame, length, next step). send=true only if all 4 critical checks pass, the score is 9 or 10, and the reply is the copilot's built-in reply or the AI judge (judge: \"api\") passes it. Otherwise lists what to fix or hands it to a person.",
  {
    reply: z.string().describe("The drafted reply to the customer."),
    status: z.number().optional().describe("HTTP status of the customer's error, if known."),
    issue: z.string().optional().describe("The customer's message or error text, so the gate knows the likely cause."),
    judge: z.enum(["api", "off"]).default("off").describe("api = also run the AI judge on a free-form draft (needs ANTHROPIC_API_KEY)."),
  },
  async ({ reply, status, issue, judge }) =>
    text(JSON.stringify(await reviewReply(reply, { status, message: issue }, { judge }), null, 2)),
);

server.tool(
  "blotato_explain_error",
  "Explain a Blotato error in plain words: cause, fix steps, whether to escalate, and a friendly reply to send the customer. Pass a status code, the error body, and/or the customer's own description.",
  {
    status: z.number().optional(),
    body: z.string().optional().describe("Error response body (JSON text is fine)."),
    message: z.string().optional().describe("What the customer said, or the errorMessage from a failed post."),
  },
  async ({ status, body, message }) => {
    let b: unknown = body;
    if (body) {
      try {
        b = JSON.parse(body);
      } catch {
        b = body;
      }
    }
    return text(JSON.stringify(explainError({ status, body: b, message }), null, 2));
  },
);

server.tool(
  "blotato_post_status",
  "Look up a post by postSubmissionId and explain the result. Note: an ID that matches nothing also returns in-progress.",
  { postSubmissionId: z.string(), apiKey: z.string().optional() },
  async ({ postSubmissionId, apiKey }) => {
    const key = keyOr(apiKey);
    if (!key) return text("No API key. Set BLOTATO_API_KEY.");
    const r = await new BlotatoClient({ apiKey: key }).postStatus(postSubmissionId);
    if (!r.ok) return text(JSON.stringify({ status: r.status, explanation: explainError({ status: r.status, body: r.errorBody }) }, null, 2));
    const d = r.data!;
    const extra = d.status === "failed" ? explainError({ message: d.errorMessage ?? "" }) : d.status === "in-progress" ? explainError({ message: "in-progress" }) : undefined;
    return text(JSON.stringify({ post: d, explanation: extra }, null, 2));
  },
);

server.tool(
  "blotato_publish_post",
  "Validate, then publish or schedule a post through POST /v2/posts. dryRun defaults to TRUE: it only validates. Set dryRun false only after the human has approved the exact body.",
  {
    body: z.record(z.any()),
    dryRun: z.boolean().default(true),
    apiKey: z.string().optional(),
  },
  async ({ body, dryRun, apiKey }) => {
    const findings = validatePost(body);
    if (findings.some((f) => f.severity === "error")) return text(`Not sent. ${summarize(findings)}`);
    if (dryRun) return text(`Dry run only, nothing sent. ${summarize(findings)}`);
    const key = keyOr(apiKey);
    if (!key) return text("No API key. Set BLOTATO_API_KEY.");
    const r = await new BlotatoClient({ apiKey: key }).createPost(body);
    if (!r.ok) return text(JSON.stringify({ status: r.status, explanation: explainError({ status: r.status, body: r.errorBody }) }, null, 2));
    return text(`Accepted. postSubmissionId ${r.data!.postSubmissionId}${r.data!.scheduledTime ? `, scheduled for ${r.data!.scheduledTime}` : ", publishing now"}. Check it with blotato_post_status after 10+ seconds.`);
  },
);

await server.connect(new StdioServerTransport());
