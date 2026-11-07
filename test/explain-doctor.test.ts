import { test, after } from "node:test";
import assert from "node:assert/strict";
import { explainError } from "../src/explain.js";
import { inspectKey, runDoctor } from "../src/doctor.js";
import { BlotatoClient, parseRetrySeconds } from "../src/blotato.js";
import { startMock, MOCK_GOOD_KEY, MOCK_RATE_LIMIT_KEY } from "../src/mock-server.js";

const mock = await startMock();
after(() => mock.server.close());

test("explain: 401, 429 with seconds, 90009, nested schedule complaint, unknown", () => {
  assert.equal(explainError({ status: 401 })[0].id, "auth-401");
  const r = explainError({ status: 429, body: { statusCode: 429, message: "Rate limit exceeded, retry in 49 seconds" } })[0];
  assert.equal(r.id, "rate-429");
  assert.match(r.customerReply, /49 seconds/);
  assert.equal(explainError({ body: { code: 90009 } })[0].id, "media-90009");
  assert.equal(explainError({ message: "my post was published immediately instead of at 9am" })[0].id, "published-immediately");
  const u = explainError({ message: "the sky is green" })[0];
  assert.equal(u.id, "unknown");
  assert.equal(u.escalate, true);
});

test("parseRetrySeconds reads header or Blotato message", () => {
  assert.equal(parseRetrySeconds({ message: "Rate limit exceeded, retry in 12 seconds" }), 12);
  assert.equal(parseRetrySeconds(null, "7"), 7);
});

test("inspectKey catches pasted-key mistakes", () => {
  assert.equal(inspectKey(undefined).status, "fail");
  assert.equal(inspectKey(" abc= ").status, "fail");
  assert.equal(inspectKey('"abc="').status, "fail");
  assert.equal(inspectKey("Bearer abc=").status, "fail");
  assert.equal(inspectKey("abc=").status, "pass");
});

test("doctor against mock: good key finds accounts, page, and expired LinkedIn", async () => {
  const r = await runDoctor(MOCK_GOOD_KEY, { baseUrl: mock.baseUrl });
  const byName = Object.fromEntries(r.checks.map((c) => [c.name, c]));
  assert.equal(byName["Key accepted (GET /users/me)"].status, "pass");
  assert.match(byName["Connected accounts"].detail, /twitter: 1, facebook: 1, linkedin: 1/);
  assert.match(byName["Pages for facebook @janesmith.fb"].detail, /pageId 123456789/);
  const li = byName["Pages for linkedin @janesmith-li"];
  assert.equal(li.status, "fail");
  assert.equal(li.explanation?.id, "connection-422");
  assert.equal(r.healthy, false);
});

test("doctor against mock: bad key stops at 401 with the trailing = hint", async () => {
  const r = await runDoctor("mock_test_key_abc123", { baseUrl: mock.baseUrl });
  const last = r.checks.at(-1)!;
  assert.equal(last.status, "fail");
  assert.match(last.explanation!.cause, /trailing "="/);
});

test("client retries a 429 then reports it", async () => {
  const waits: number[] = [];
  const c = new BlotatoClient({ apiKey: MOCK_RATE_LIMIT_KEY, baseUrl: mock.baseUrl, max429Retries: 2, sleep: async (ms) => void waits.push(ms) });
  const r = await c.me();
  assert.equal(r.status, 429);
  assert.deepEqual(waits, [1000, 1000]);
  assert.equal(r.retryAfterSeconds, 1);
});

test("publish then status round trip against mock", async () => {
  const c = new BlotatoClient({ apiKey: MOCK_GOOD_KEY, baseUrl: mock.baseUrl });
  const p = await c.createPost({ post: { accountId: "98432", content: { text: "hi", mediaUrls: [], platform: "twitter" }, target: { targetType: "twitter" } }, scheduledTime: "2026-12-25T15:00:00Z" });
  assert.equal(p.status, 201);
  const s = await c.postStatus(p.data!.postSubmissionId);
  assert.equal(s.data!.status, "scheduled");
  const ghost = await c.postStatus("does-not-exist");
  assert.equal(ghost.data!.status, "in-progress");
});
