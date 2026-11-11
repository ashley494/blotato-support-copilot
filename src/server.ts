// Small HTTP service so n8n (or any agent) can ask the copilot to judge a reply before it is sent.
//   POST /review  {reply, message?, status?, errorBody?}  -> {send, why, ...}
//   POST /triage  {message, status?}                     -> {diagnosis, by, reply, send, why}
// The AI backend comes from COPILOT_JUDGE: "api" (Anthropic API, needs ANTHROPIC_API_KEY) or "claude-cli".
// Run: npm run serve   (port COPILOT_PORT, default 8787, localhost only)
import { createServer } from "node:http";
import { reviewReply, triage } from "./review.js";

const backend = (process.env.COPILOT_JUDGE as "api" | "claude-cli" | undefined) ?? "api";
const port = Number(process.env.COPILOT_PORT ?? 8787);

createServer(async (req, res) => {
  const send = (code: number, body: unknown) => {
    res.writeHead(code, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (req.method !== "POST") return send(405, { error: "POST only" });
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 64_000) return send(413, { error: "too large" });
  }
  let b: any;
  try {
    b = JSON.parse(raw || "{}");
  } catch {
    return send(400, { error: "invalid JSON" });
  }
  const issue = { status: b.status === undefined || b.status === "" ? undefined : Number(b.status), body: b.errorBody, message: b.message };
  try {
    if (req.url === "/review") {
      const r = await reviewReply(String(b.reply ?? ""), issue, { judge: backend });
      return send(200, { send: r.send, why: r.why, judgeScore: r.judge?.score ?? null, judgeFailed: r.judge?.failed ?? [] });
    }
    if (req.url === "/triage") return send(200, await triage(issue, { ai: backend }));
    return send(404, { error: "use /review or /triage" });
  } catch (e) {
    return send(200, { send: false, why: `Copilot error, so a person takes it: ${(e as Error).message}` });
  }
}).listen(port, "127.0.0.1", () => console.log(`copilot service on http://127.0.0.1:${port} (judge: ${backend})`));
