// A small stand-in for backend.blotato.com/v2 that returns the response shapes from Blotato's docs.
// Used by the tests and for demos without a live key. It is NOT Blotato; the live API is the source of truth.
import { createServer, type Server } from "node:http";

export const MOCK_GOOD_KEY = "mock_test_key_abc123=";
export const MOCK_RATE_LIMIT_KEY = "mock_rate_limited=";

export function startMock(port = 0): Promise<{ server: Server; baseUrl: string }> {
  const posts = new Map<string, any>();
  let n = 0;
  const server = createServer((req, res) => {
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };
    const key = req.headers["blotato-api-key"];
    if (key === MOCK_RATE_LIMIT_KEY) return send(429, { statusCode: 429, message: "Rate limit exceeded, retry in 1 seconds" });
    if (key !== MOCK_GOOD_KEY) return send(401, { message: "Invalid API key" });

    const url = new URL(req.url ?? "/", "http://x");
    const p = url.pathname.replace(/^\/v2/, "");
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      if (req.method === "GET" && p === "/users/me") return send(200, { id: "u1", email: "demo@example.com" });
      if (req.method === "GET" && p === "/users/me/accounts")
        return send(200, {
          items: [
            { id: "98432", platform: "twitter", fullname: "Jane Smith", username: "janesmith" },
            { id: "98433", platform: "facebook", fullname: "Jane Smith", username: "janesmith.fb" },
            { id: "98440", platform: "linkedin", fullname: "Jane Smith", username: "janesmith-li" },
          ],
        });
      const sub = p.match(/^\/users\/me\/accounts\/([^/]+)\/subaccounts$/);
      if (req.method === "GET" && sub) {
        if (sub[1] === "98440") return send(422, { message: "LinkedIn connection expired. Please reconnect." });
        return send(200, { items: [{ id: "123456789", accountId: sub[1], name: "My Business Page" }] });
      }
      if (req.method === "POST" && p === "/posts") {
        const body = JSON.parse(raw || "{}");
        const id = `00000000-0000-0000-0000-${String(++n).padStart(12, "0")}`;
        const scheduledTime = body.scheduledTime;
        const media: string[] = body?.post?.content?.mediaUrls ?? [];
        posts.set(
          id,
          media.some((m) => m.includes("drive.google.com"))
            ? { postSubmissionId: id, status: "failed", errorMessage: "Unsupported media type" }
            : scheduledTime
              ? { postSubmissionId: id, status: "scheduled", scheduledTime }
              : { postSubmissionId: id, status: "published", publicUrl: "https://x.com/janesmith/status/1" },
        );
        return send(201, scheduledTime ? { postSubmissionId: id, scheduledTime } : { postSubmissionId: id });
      }
      const st = p.match(/^\/posts\/([^/]+)$/);
      if (req.method === "GET" && st) return send(200, posts.get(st[1]) ?? { postSubmissionId: st[1], status: "in-progress" });
      send(404, { message: "Not found" });
    });
  });
  return new Promise((resolve) =>
    server.listen(port, "127.0.0.1", () => {
      const a = server.address();
      const p = typeof a === "object" && a ? a.port : port;
      resolve({ server, baseUrl: `http://127.0.0.1:${p}/v2` });
    }),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { baseUrl } = await startMock(Number(process.env.PORT ?? 4799));
  console.log(`Mock Blotato API on ${baseUrl}\nKey: ${MOCK_GOOD_KEY}\nexport BLOTATO_BASE_URL=${baseUrl} BLOTATO_API_KEY='${MOCK_GOOD_KEY}'`);
}
