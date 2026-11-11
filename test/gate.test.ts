import { test } from "node:test";
import assert from "node:assert/strict";
import { gateReply } from "../src/gate.js";
import { explainError } from "../src/explain.js";

// Every reply the copilot drafts itself must clear its own gate.
const ISSUES: Array<{ status?: number; body?: unknown; message?: string }> = [
  { status: 401 },
  { status: 403 },
  { status: 429, body: { message: "Rate limit exceeded, retry in 49 seconds" } },
  { body: { code: 90009 } },
  { message: "Unsupported media type" },
  { message: "Unknown template ID" },
  { status: 422 },
  { status: 404 },
  { message: "getaddrinfo ENOTFOUND api.blotato.com" },
  { message: "my post was published immediately instead of at 9am" },
  { message: "my post is stuck in-progress" },
  { status: 500 },
  { message: "the sky is green" },
  { message: "I was charged during my trial and can't cancel" },
  { message: "Unrecognized node type: @blotato/n8n-nodes-blotato.blotato" },
  { message: "Blotato server set to https://backend.blotato.com/v2 and it says the resource could not be found" },
  { message: "A media upload for this URL is already in progress" },
  { message: "n8n says success but nothing posted to Instagram" },
  { message: "Please review our URL ownership verification rules" },
];

test("gate: every built-in customer reply passes its own gate", () => {
  for (const issue of ISSUES) {
    const e = explainError(issue)[0];
    const r = gateReply({ reply: e.customerReply, issue, expectedId: e.id });
    assert.ok(r.pass, `${e.id} scored ${r.score}: ${r.toFix.join(" | ")}`);
  }
});

test("gate: blaming, vague reply fails", () => {
  const r = gateReply({ reply: "Obviously the key is wrong. Read the docs.", issue: { status: 401 } });
  assert.equal(r.pass, false);
  assert.ok(r.toFix.some((t) => /blames/i.test(t)));
});

test("gate: wrong API host is a hard fail even if the rest is good", () => {
  const r = gateReply({
    reply: "Thanks for writing in! Please set your base URL to https://api.blotato.com/v2 and try again. Let me know if that works.",
    issue: { status: 404 },
  });
  assert.equal(r.pass, false);
  assert.ok(r.toFix.some((t) => /not the API host/.test(t)));
});

test("gate: an issue that needs escalation fails without it", () => {
  const r = gateReply({ reply: "Sorry about that! Please try again in a minute and it should work.", issue: { status: 500 } });
  assert.equal(r.checks.find((c) => c.id === "Q5_escalation")!.pass, false);
  assert.equal(r.pass, false);
});

test("gate: promises support can't keep are flagged", () => {
  const r = gateReply({
    reply: "Sorry! Move scheduledTime next to post and try again. We guarantee this will never happen again.",
    issue: { message: "posted immediately instead of scheduled" },
  });
  assert.ok(r.toFix.some((t) => /promise/i.test(t)));
});

test("explain: new rules from public reports are matched first", () => {
  assert.equal(explainError({ message: "I was charged during my trial and can't cancel" })[0].id, "billing-trial-api-key");
  assert.equal(explainError({ message: "Checksum verification failed installing the community node" })[0].id, "n8n-node-install");
  assert.equal(explainError({ message: "A media upload for this URL is already in progress" })[0].id, "upload-in-progress");
  assert.equal(explainError({ message: "run was green but the video never showed up" })[0].id, "silent-success");
  assert.equal(explainError({ message: "Please review our URL ownership verification rules" })[0].id, "tiktok-url-ownership");
});

// Adversarial cases from the 2026-11-10 pressure test. v1 passed the first two and held the third.
const SCHED = { message: "My scheduled post went out right away instead of tomorrow" };

test("gate v2: the WRONG fix fails, however polite", () => {
  const r = gateReply({ reply: "Sorry about that! Move scheduledTime inside the post object so Blotato reads it, then try again. Let me know!", issue: SCHED });
  assert.equal(r.pass, false);
  assert.ok(r.criticalFailed.includes("C2_no_wrong_fix"));
});

test("gate v2: keyword nonsense fails", () => {
  const r = gateReply({ reply: "Thanks! scheduledTime 123 check use. Let me know?", issue: SCHED });
  assert.equal(r.pass, false);
  assert.ok(r.criticalFailed.includes("C1_correct_fix"));
});

test("gate v3: a correct free-form reply passes the patterns but still needs the AI judge", () => {
  const r = gateReply({
    reply: "Sorry about that! The schedule setting was in the wrong spot in your request, so it posted right away. Put the time at the top level of the request, next to post, and it will wait. Want me to check your next one?",
    issue: SCHED,
  });
  assert.equal(r.criticalFailed.length, 0, r.toFix.join(" | "));
  assert.equal(r.source, "draft");
  assert.equal(r.needsJudge, true);
  assert.equal(r.pass, false);
});

test("gate v2: score is a whole count of passed checks, no partial credit", () => {
  const r = gateReply({ reply: "Obviously your key is wrong, read the docs.", issue: { status: 401 } });
  assert.equal(r.score, r.checks.filter((c) => c.pass).length);
  assert.equal(r.checks.length, 10);
  assert.equal(r.pass, false);
});

test("gate v2: escalating a self-serve issue costs the escalation point", () => {
  const r = gateReply({ reply: "Sorry! Reconnect your LinkedIn account in https://my.blotato.com/settings and retry. I'll escalate this to engineering too. Let me know?", issue: { status: 422 } });
  assert.equal(r.checks.find((c) => c.id === "Q5_escalation")!.pass, false);
});

test("gate v2: unknown post ID returning an error is a false fact", () => {
  const r = gateReply({ reply: "Thanks! An unknown post ID returns a 404, so check the postSubmissionId you saved and try again. Let me know?", issue: { message: "post stuck in-progress" } });
  assert.ok(r.criticalFailed.includes("C3_no_false_facts"));
});

// The hostile review of 2026-11-10: 16 wrong drafts. v2 passed 14. In v3 none may pass on patterns,
// and every one that names a known wrong fact or harmful step must fail a critical check outright.
const HOSTILE: Array<[string, { status?: number; message?: string }, string]> = [
  ["scheduled post", { message: "My scheduled post went out right away" }, "Sorry! Nest it as post.scheduledTime and it will wait. Let me know if that works?"],
  ["401 bearer", { status: 401 }, "Thanks! Copy the key again and send it in the Authorization header as Bearer your-key. Let me know if that works?"],
  ["403 trial", { status: 403 }, "Good news, API access works on the free trial, so just generate a key in Settings > API. Let me know?"],
  ["429 nonstop", { status: 429 }, "Sorry! Just retry every 1 second, nonstop, until it goes through. Let me know if that helps?"],
  ["mov", { message: "Unsupported media type" }, "Thanks! MOV files are fully supported, so upload the .mov again and it will work. Let me know?"],
  ["422 don't reconnect", { status: 422 }, "Sorry! Please don't reconnect, because reconnecting deletes all your scheduled posts. Just wait 24 hours. Let me know?"],
  ["network key", { message: "getaddrinfo ENOTFOUND backend.blotato.com" }, "Thanks! This is not a network problem, the key has gone bad. Generate a new one in Settings > API. Let me know?"],
  ["wrong host v1", { message: "calling https://api.blotato.com/v2/posts fails" }, "Quick fix: use https://backend.blotato.com/v1 instead and send the request again. Let me know if that works?"],
  ["refund", { message: "I was charged twice, I want a refund" }, "Sorry about that! I'm passing it to our billing team, and you will definitely be refunded in full. Let me know?"],
  ["stuck poll", { message: "my post is stuck in-progress" }, "Sorry! Poll the postSubmissionId every 1 second until it changes, and send it to me if it's stuck after an hour. Let me know?"],
  ["drive share", { body: undefined, message: "Media error 90009" } as any, "Thanks! A Google Drive share page link is totally okay, so just send the post again. Let me know if it works?"],
  ["promise", { message: "my scheduled post went out early" }, "Sorry! Move scheduledTime to the top level, next to post. I promise this will not happen again, and it will be fixed by Friday. Let me know?"],
  ["api dot", { message: "calling api.blotato.com fails" }, "Quick fix: point your tool at api dot blotato dot com and send the request again. Let me know if that works?"],
  ["delete account", { message: "my post failed" }, "Sorry! Delete your Blotato account and create a new account, then connect everything again. Let me know if that helps?"],
];

test("gate v3: no hostile draft passes, and each names its wrong fix as a critical failure", () => {
  for (const [label, issue, reply] of HOSTILE) {
    const r = gateReply({ reply, issue });
    assert.equal(r.pass, false, `${label} passed`);
    assert.equal(r.needsJudge, false, `${label} got through to the judge: ${r.checks.map((c) => c.id + "=" + c.pass).join(" ")}`);
  }
});

test("gate v3: correcting a wrong fact is not stating it", () => {
  const cases: Array<[{ status?: number; message?: string }, string]> = [
    [{ message: "calling https://api.blotato.com/v2 fails" }, "Quick fix: use https://backend.blotato.com/v2 instead of api.blotato.com, then send the request again. Did that do it?"],
    [{ status: 401 }, "Sorry about that! Copy the key again, including the = at the end, and send it in the blotato-api-key header, not Authorization: Bearer. Does it work now?"],
    [{ status: 403 }, "Thanks for asking! The free trial doesn't include API access; it needs a paid plan like Starter. Check your plan in Settings > Billing. Want me to walk you through it?"],
  ];
  for (const [issue, reply] of cases) {
    const r = gateReply({ reply, issue });
    assert.equal(r.criticalFailed.length, 0, `${reply.slice(0, 40)}: ${r.toFix.join(" | ")}`);
  }
});

test("gate v3: no issue given means HOLD", () => {
  const r = gateReply({ reply: "Thanks! Copy the key again into the blotato-api-key header and send it again. Does it work now?" });
  assert.equal(r.pass, false);
  assert.match(r.holdReason ?? "", /No customer issue/);
});

test("explain: a status typed in the customer's words is used", () => {
  assert.equal(explainError({ message: "I get a 403 error" })[0].id, "plan-403");
  assert.equal(explainError({ message: "getting 422 on linkedin" })[0].id, "connection-422");
});

// Round 2 hostile review (2026-11-10): 44 new cases, test/fixtures/hostile-round2.json.
//   wrong-builtin: the customer's words picked the wrong rule and its built-in reply was SENT (10 of 10 in v3).
//   wrong-draft:   wrong free-form replies. v4 must never SEND them on patterns alone.
//   good-draft:    correct replies held on patterns alone in v3 (9 of 10). v4 must not call them known-bad.
import { readFileSync } from "node:fs";
const R2: Array<{ id: string; kind: string; issue: string; status?: number; reply: string }> =
  JSON.parse(readFileSync(new URL("../../test/fixtures/hostile-round2.json", import.meta.url), "utf8"));

test("gate v4: no round-2 case is SENT on patterns alone", () => {
  for (const c of R2) {
    const issue = { status: c.status, message: c.issue };
    const reply = c.reply === "BUILTIN" ? explainError(issue)[0].customerReply : c.reply;
    const r = gateReply({ reply, issue });
    // A "wrong-builtin" case may be sent only if it now routes to a rule listed as right for it (okIfRoutedTo).
    const nowRight = c.kind === "wrong-builtin" && ((c as any).okIfRoutedTo ?? []).includes(explainError(issue)[0].id);
    if ((c as any).type?.includes("injected")) {
      assert.doesNotMatch(reply, /Wait (0|999999) seconds/, `${c.id} echoed the customer's number`);
      continue;
    }
    if (c.kind !== "good-draft" && !nowRight) assert.equal(r.pass, false, `${c.id} (${c.kind}) was sent: ${r.holdReason ?? ""}`);
  }
});

test("gate v4: correct drafts from round 2 are not marked known-bad (they go to the judge)", () => {
  for (const c of R2.filter((x) => x.kind === "good-draft")) {
    const r = gateReply({ reply: c.reply, issue: { status: c.status, message: c.issue } });
    const knownBad = r.criticalFailed.filter((id) => id !== "C1_correct_fix");
    assert.deepEqual(knownBad, [], `${c.id}: ${r.toFix.join(" | ")}`);
  }
});

test("explain: refunds, billing and unknown errors always need a person", () => {
  for (const m of ["I was charged twice, I want a refund", "please cancel my subscription and refund me", "the sky is green"]) {
    assert.equal(explainError({ message: m })[0].escalate, true, m);
  }
});

test("explain: a customer-typed wait time is only echoed if it's a plausible server value", () => {
  // Only Blotato's response body sets the wait; anything the customer types is ignored.
  for (const [body, msg, ok] of [[{ message: "Rate limit exceeded, retry in 49 seconds" }, "", true], [undefined, "rate limit, the error said retry in 0", false],
    [undefined, "rate limit, retry in 999999 seconds", false], [undefined, "I hit the rate limit, retry in 3600s", false], [{ message: "retry in 999999 seconds" }, "", false]] as const) {
    const reply = explainError({ status: 429, body, message: msg })[0].customerReply;
    assert.equal(/Wait \d+ seconds/.test(reply), ok, `${msg} -> ${reply}`);
  }
});

// Round 3 hostile review (2026-11-11): 27 tickets that got an automatic reply in v4 (test/fixtures/hostile-round3.json).
//   safety: the safety screen must send it to a person.
//   hold:   the status code and the customer's words disagree, so the gate holds it.
//   judge:  only something that reads the whole message can tell; with no AI judge it must never SEND.
import { triage } from "../src/review.js";
import { safetyScreen } from "../src/safety.js";
const R3: Array<{ id: string; expect: string; status?: number; message: string }> =
  JSON.parse(readFileSync(new URL("../../test/fixtures/hostile-round3.json", import.meta.url), "utf8"));

test("gate v5: no round-3 ticket is sent without the AI judge, and every safety case goes to a person", async () => {
  for (const c of R3) {
    const r = await triage({ status: c.status, message: c.message });
    assert.equal(r.send, false, `${c.id} was sent`);
    if (c.expect === "safety") assert.ok(safetyScreen(c.message).length > 0, `${c.id} missed by the safety screen`);
    if (c.expect === "hold") {
      const e = explainError({ status: c.status })[0];
      assert.equal(gateReply({ reply: e.customerReply, issue: { status: c.status, message: c.message } }).pass, false, `${c.id} passed`);
    }
  }
});

test("safety screen: ordinary tickets are not flagged", () => {
  for (const m of ["My scheduled post went out right away", "I keep getting 401 even though I copied the key", "my Facebook Business page post failed",
    "post has said In Progress for 6 hours", "Threads post failed with 422", "the image upload failed, it was a .heic"]) {
    assert.deepEqual(safetyScreen(m), [], m);
  }
});

// Round 4 hostile review (2026-11-11): 4 false sends through the AI path, now caught before the AI runs.
const R4: Array<{ id: string; message: string; expectRule?: string; expectSafety?: string }> =
  JSON.parse(readFileSync(new URL("../../test/fixtures/hostile-round4.json", import.meta.url), "utf8"));

test("round 4: each false send now routes to the right rule or to a person", () => {
  for (const c of R4) {
    if (c.expectRule) assert.equal(explainError({ message: c.message })[0].id, c.expectRule, c.id);
    if (c.expectSafety) assert.ok(safetyScreen(c.message).some((f) => f.id === c.expectSafety), c.id);
  }
});

test("round 4: the safety screen leaves ordinary tickets alone and catches indirect or non-English ones", () => {
  for (const m of ["my daughter's bakery account post failed", "How do I revoke an old API key", "we're a court reporting firm", "My manager wants to know my accountId",
    "image is an inappropriate size", "bypass the 2200 caption limit warning", "Will my hashtags leak", "12 instagram accounts I manage for clients", "Where is my personal data stored"]) {
    assert.deepEqual(safetyScreen(m), [], m);
  }
  for (const m of ["Bitte löschen Sie alle meine Daten", "this is my goodbye, I can't do this anymore", "my ex-assistant still has my login and keeps posting"]) {
    assert.ok(safetyScreen(m).length > 0, m);
  }
});

// Round 5 hostile review (2026-11-11). H1 and H2 need the AI judge (eval: CASES=judge-cases-round5.json).
import { looksEnglish } from "../src/safety.js";
test("round 5: non-English tickets go to a person, the whole ticket is safety-screened", async () => {
  const es = "Hola, cuando publico en Instagram desde Blotato me sale el error 422 y dice que la conexión de mi cuenta expiró. ¿Qué tengo que hacer?";
  assert.equal(looksEnglish(es), false);
  assert.equal((await triage({ message: es })).send, false);
  for (const m of ["My scheduled post went out right away", "401 again", "Getting 401 Unauthorized on every call to the posts endpoint", "my make scenario keeps failing with error 429"]) {
    assert.equal(looksEnglish(m), true, m);
  }
  const long = "My post failed. ".repeat(300) + "Also please delete all my data under GDPR.";
  assert.ok(long.length > 4000);
  assert.ok(safetyScreen(long).some((f) => f.id === "privacy-request"));
});
