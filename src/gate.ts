// Reply gate v4: checks a customer reply with 10 yes/no checks, 1 point each. No partial credit.
//
// Why v2: v1 (2026-11-09) graded keywords. Pressure-tested on 2026-11-10, it gave 10/10 to a reply with the
// WRONG fix ("move scheduledTime inside post") and 9.4 to keyword nonsense, and held back a correct reply
// written in plain words. v2 checks the fix itself: every issue type lists what a correct reply must say
// (any one phrasing counts) and what a wrong reply says. The full rubric is docs/scoring.md.
//
// Decision (v4, after two hostile reviews on 2026-11-10):
//   HOLD now  - a known wrong fix, false fact or promise (C2, C3, C4), or no issue given, or the customer's
//               words match more than one issue (round 2 showed a misrouted ticket getting the wrong built-in reply).
//   SEND now  - the copilot's own built-in reply for the ONE matched issue, with all 10 checks met.
//   JUDGE     - anything else (a free-form draft, or a reply that only misses phrasing checks). The AI judge
//               must meet all 10 checks too (src/judge.ts via reviewReply in src/review.ts). No judge = a person.
// The method follows Cody Schneider's creative-director gate: explicit can/can't checks, loop until clean.
// Limit, stated plainly: these are pattern checks. They catch the known right and wrong answers for each
// issue; they do not understand meaning. test/gate.test.ts holds the adversarial cases they must pass.

import { explainError, type Explanation } from "./explain.js";
import { safetyScreen, type SafetyFlag } from "./safety.js";

export type CheckId =
  | "C1_correct_fix" | "C2_no_wrong_fix" | "C3_no_false_facts" | "C4_no_promises"
  | "Q5_escalation" | "Q6_action" | "Q7_specific" | "Q8_no_blame" | "Q9_length" | "Q10_next_step";

export interface GateCheck {
  id: CheckId;
  critical: boolean;
  pass: boolean;
  rule: string; // the exact test, in words
  note?: string; // why it failed
}

export interface GateResult {
  score: number; // 0 to 10, whole points
  pass: boolean;
  source: "builtin" | "draft"; // builtin = the copilot's own reviewed reply for this issue
  safety: SafetyFlag[]; // anything here = a person, no automatic reply
  needsJudge: boolean; // a draft that passed the patterns; only an AI judge can pass it
  holdReason?: string;
  threshold: number;
  criticalFailed: CheckId[];
  expected?: Pick<Explanation, "id" | "title" | "escalate">;
  checks: GateCheck[];
  toFix: string[];
}

interface Claims {
  must: RegExp[]; // a correct reply says at least one of these
  mustNot?: RegExp[]; // a reply that says any of these gives the wrong fix
  say: string; // the correct fix in words, for the note
}

// What a correct reply says for each issue. Written from the rule's fix steps in src/explain.ts.
export const CLAIMS: Record<string, Claims> = {
  "mcp-url": { say: "the Blotato MCP server URL is https://mcp.blotato.com/mcp", must: [/mcp\.blotato\.com\/mcp/i], mustNot: [/\bmcp\b[^.]{0,60}backend\.blotato\.com/i] },
  "scheduled-wrong-time": { say: "add a timezone offset to scheduledTime (for example -08:00 for Pacific) or send UTC with Z", must: [/\b(offset|timezone|time zone|utc)\b|[+-]\d\d:\d\d\b/i] },
  "published-immediately": {
    say: "scheduledTime goes at the top level of the body, next to post, not inside it",
    must: [/\b(top[- ]level|root|outside (the )?["“]?post|(next to|beside|alongside) ["“]?post|up one level|same level as ["“]?post|not (inside|in) (the )?["“]?post)/i],
    mustNot: [/\b(mov(e|ing)|put(ting)?|plac(e|ing)|add(ing)?|nest(ing)?|keep(ing)?|leav(e|ing))\b(?![^.]{0,25}\b(out|outside)\b)[^.]{0,40}\b(inside|into|within|under)\b[^.]{0,12}["“]?post\b/i, /\bpost\.scheduledTime\b/i, /\bnest (it|scheduledTime)\b/i, /\binside (the )?["“]?post["”]?( object)? (also |still )?(works|is fine|is ok)/i],
  },
  "auth-401": {
    say: "re-copy the full key (with any = at the end) and send it as the blotato-api-key header",
    must: [/blotato-api-key/i, /\b(re-?copy|copy (it|the key|your key) again|trailing ["“]?=|the = at the end|ends? (with|in) ["“]?=)/i],
    mustNot: [/authorization:\s*bearer/i, /\bbearer\b[^.]{0,30}\bheader\b/i, /\bauthorization header\b[^.]{0,20}\bbearer\b/i, /\bas (a )?bearer\b/i],
  },
  "plan-403": {
    say: "API access needs a paid plan (Starter); generating a key ends the trial",
    must: [/\b(paid plan|starter|upgrade|plan (does not|doesn't) include)/i],
    mustNot: [/free (trial|plan)(?![^.]{0,40}\b(doesn'?t|does not|isn'?t|is not|won'?t|not)\b)[^.]{0,40}\b(includes?|works?|has)\b[^.]{0,20}\b(api|mcp)/i],
  },
  "rate-429": {
    say: "wait the seconds in the response, and poll no faster than every 10 seconds",
    must: [/\b(wait|pause|hold off)\b[^.]{0,40}\b(\d+\s*(s|sec|seconds)|seconds|before (retrying|trying|sending))/i, /\bwait node\b/i, /\b10 seconds\b/i],
    mustNot: [/\b(retry|try again|resend)\b[^.]{0,30}\b(immediately|right away|in a loop|every (1|one) second|nonstop|non-stop)\b/i],
  },
  "media-90009": {
    say: "the media URL must be a direct, public file link (not a share or preview page), or upload the file to Blotato",
    must: [/\b(direct (download )?link|raw file|private (browser )?window|anyone with the link|usercontent\.google|export=download|upload (it|the file) to blotato|presigned)/i],
    mustNot: [/\bshare (page )?link\b[^.]{0,30}\b(works|is fine|is (totally )?ok(ay)?|is good)\b/i, /\bpreview link\b[^.]{0,30}\b(works|is fine|ok(ay)?)\b/i],
  },
  "unsupported-media": {
    say: "use MP4 (H.264) for video, JPG or PNG for images, and a URL that returns the raw file",
    must: [/\b(mp4|h\.?264|jpe?g|png)\b/i],
    mustNot: [/\b(\.?mov|webm|heic|avi|gif)\b(?![^.]{0,30}\b(isn'?t|is not|aren'?t|are not|not|won'?t)\b)[^.]{0,30}\b(works|(are |is )?(fully )?supported|is fine|ok(ay)?)\b/i],
  },
  "connection-422": {
    say: "reconnect the social account in Blotato settings, then retry",
    must: [/\breconnect|\bconnect (it|the account|your account) again/i],
    mustNot: [/\b(don'?t|do not|no need to|never)\s+(\w+\s+){0,2}reconnect/i, /reconnect\w*[^.]{0,40}\b(deletes?|erases?|removes?|loses?)\b/i],
  },
  "wrong-host": {
    say: "use https://backend.blotato.com/v2",
    must: [/backend\.blotato\.com/i],
  },
  "network-unreachable": {
    say: "the request isn't reaching Blotato; check network, VPN, proxy or firewall, test with curl",
    must: [/\b(network|vpn|proxy|firewall|curl|dns|tunnel|wi-?fi)\b/i],
    mustNot: [/\b(your|the) (api )?key (is|has gone|went) (wrong|invalid|bad|expired)\b/i, /\bnot a network (problem|issue)\b/i],
  },
  "not-found-404": {
    say: "check the base URL and use an accountId from GET /v2/users/me/accounts",
    must: [/\/v2\/users\/me\/accounts|backend\.blotato\.com\/v2|account ?id/i],
  },
  "find-account-ids": {
    say: "list accounts (and subaccounts for pages) with the API and use items[].id",
    must: [/\/users\/me\/accounts|subaccounts|items\[\]\.id|list (your )?accounts/i],
  },
  "template-404": {
    say: "list templates and copy the template id exactly",
    must: [/\btemplates?\b[^.]{0,60}\b(list|copy|exact)|\b(list|copy)\b[^.]{0,60}\btemplates?\b/i],
  },
  "stuck-in-progress": {
    say: "check it's the postSubmissionId from the create call, check the calendar for a cancelled post, video can take a while",
    must: [/\bpostsubmissionid\b|\b(exact|right|same) id\b/i],
    mustNot: [/\bin-progress means (it'?s|it is) (still )?(publishing|processing)\b/i, /\bpoll\w*[^.]{0,20}\bevery (1|one|2|two|3|three|5|five) seconds?\b/i],
  },
  "silent-success": {
    say: "check the post status with the postSubmissionId, the Failed list, and n8n item counts",
    must: [/\b(postsubmissionid|failed|item count|0 items|status)\b/i],
  },
  "upload-in-progress": {
    say: "don't resubmit; upload one at a time and reuse the first upload's URL",
    must: [/\b(one at a time|reuse|first upload|don'?t (re)?submit|wait for the first)/i],
  },
  "upload-201-created": {
    say: "treat any 2xx (including 201) as success",
    must: [/\b(2xx|201)\b[^.]{0,40}\b(success|ok|worked)/i, /\bsuccess\b[^.]{0,40}\b(2xx|201)\b/i],
  },
  "tiktok-url-ownership": {
    say: "upload the video to Blotato first, then post the returned Blotato URL",
    must: [/\bupload\b[^.]{0,40}\bblotato\b|\bblotato\b[^.]{0,40}\bupload/i],
  },
  "n8n-node-install": {
    say: "the owner enables (verified) community nodes and installs @blotato/n8n-nodes-blotato",
    must: [/\bcommunity nodes?\b/i, /@blotato\/n8n-nodes-blotato/i],
  },
  "n8n-server-url": {
    say: "set the credential's server to https://backend.blotato.com with no /v2",
    must: [/\b(no|without|remove)\b[^.]{0,20}\/v2|backend\.blotato\.com(?!\/v2)/i],
    // keep: the n8n credential Server field is https://backend.blotato.com with no /v2
    mustNot: [/\bserver\b[^.]{0,40}backend\.blotato\.com\/v2/i],
  },
  "post-analytics": {
    say: "point to the analytics help entry or the analytics endpoint",
    must: [/\banalytics\b/i],
  },
  // Issues a person must handle: a correct reply collects details and hands off.
  "billing-trial-api-key": { say: "pass the charge to the billing team and ask for the account email and the receipt details (amount, date); it may explain that generating an API key ends the trial and how to cancel; it never promises a refund", must: [/\b(billing team|pass(ing)? (it|this)|escalat|hand(ing)? (it|this))/i] },
  "login-locked-out": { say: "collect details and hand to a person with account access", must: [/\b(escalat|passing (it|this)|our team|someone with access)/i] },
  "n8n-node-bug": { say: "collect versions and the error, offer the HTTP Request workaround, escalate", must: [/\b(http request|escalat|version)/i] },
  "tiktok-public-url": { say: "collect the post id and escalate", must: [/\b(escalat|engineering)/i] },
  "linkedin-nonexistent-version": { say: "escalate to engineering right away", must: [/\b(escalat|engineering)/i] },
  "ai-video-credits-quality": { say: "point to the credit balance and pass feedback on, no promises", must: [/\b(credit|billing|product team|passing)/i] },
  "server-9999": { say: "retry once after a minute; escalate with details if it repeats", must: [/\b(retry|try (it )?again|escalat)/i] },
  unknown: { say: "collect the details and escalate", must: [/\b(escalat|engineering|passing (it|this)|send (me|us|the))/i] },
};

// Wrong for any issue: advice that destroys data or makes a fix impossible.
const HARMFUL: RegExp[] = [
  /\b(delete|close|remove)\s+(your|the)\s+(blotato\s+)?account\b/i,
  /\bcreate\s+a\s+new\s+(blotato\s+)?account\b/i,
  /\b(retry|resend|poll|check)\w*\b[^.]{0,30}\b(every (1|one) second|nonstop|non-stop|continuously|in a tight loop|as fast as)/i,
  /\bdisconnect (all|every)\b/i,
];

// True anywhere, whatever the issue.
const FALSE_FACTS: Array<[RegExp, string]> = [
  [/(?<!not\s)(?<!backend\.)\bapi\.blotato\.com/i, "Points to api.blotato.com, which is not the API host (it is backend.blotato.com/v2)."],
  [/authorization:\s*bearer/i, "Says to send Authorization: Bearer; the REST API reads the blotato-api-key header."],
  [/free (trial|plan)(?![^.]{0,40}\b(doesn'?t|does not|isn'?t|is not|won'?t|not)\b)[^.]{0,40}\b(includes?|works?|has)\b[^.]{0,20}\b(api|mcp)/i, "Says the API works on the free trial; it needs a paid plan."],
  [/\bunknown (post )?ids? (return|give)s? (a )?(404|not found|an error)/i, "Says an unknown post ID returns an error; it returns in-progress."],
  [/api\s*(\.|dot)\s*blotato\s*(\.|dot)\s*(com|io)|backend\.blotato\.com\/v(?!2)\d|blotato\.io/i, "Gives a wrong API address (the API is https://backend.blotato.com/v2)."],
  [/\b(api|mcp)( access)? (works|is (included|available|free)) (on|with|in|during) (the )?(free )?trial/i, "Says the API works on the free trial; it needs a paid plan."],
];

const PROMISES = /\b(guarantee[ds]?|100%|i promise|we promise|never happen again|will not happen again|won'?t happen again|(you|it|this) will definitely|definitely (be|get|work)|(you'?ll|you will|will) (get|receive|be) (a |your )?(full )?refund\w*|refund\w*[^.]{0,40}\b(on (its|the) way|processed|issued|approved|coming|sent|guaranteed)|i'?ve refunded|we'?ll refund|refunded in full|compensat\w*|credit(s|ed)? back|by (today|tomorrow|tonight|end of (the )?day|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|(fixed|resolved|done|back|refunded|ready) (with)?in \d+ (minutes|hours|days|business days)|(will|we'?ll|you'?ll) [^.]{0,30}\b(with)?in \d+ (minutes|hours|days|business days))\b/i;
const BLAME = /\b(obviously|you should have|as (i|we) (said|stated)|user error|read the docs|simply|just read|clearly you|your fault)\b/i;
const ACTION = /\b(copy|paste|move|reconnect|connect|set|use|swap|add|wait|open|send|check|try|retry|confirm|list|generate|share|upload|re-?run|update|click|install|import|cancel|search|enable|turn on|delete|remove|go to|put|test|poll|convert|reply)\b/i;
const SPECIFIC = /(settings|https?:\/\/|\/v2|\b\d+\b|scheduledTime|postSubmissionId|accountId|pageId|blotato-api-key|header|template|mp4|jpe?g|png|google drive|n8n|wait node|billing|calendar|top level|community node|status code|endpoint|time ?zone|response body)/i;
const ESCALATES = /\b(escalat\w*|engineering|engineers?\b|our (\w+ )?team|billing team|pass(ing)? (it|this) (on|to|along)|hand(ing)? (it|this) (to|over)|someone with (account )?access|send (it|that|the id|them) (to me|over)|a person will)/i;
const NEXT_STEP = /(\?|let me know|send me|reply (here|with)|i'?ll (follow up|update you|reply|look|take a look|escalate|check)|you should be good|it should (now )?(work|schedule|post)|(try|send) (it |them )?(again|once more))/i;

// "not api.blotato.com", "instead of Authorization: Bearer", "doesn't include the API" correct a wrong fact;
// they don't state it. A match counts only if the 30 characters before it hold no negation.
const NEGATION = /\b(not|instead of|rather than|never|isn'?t|doesn'?t|don'?t|won'?t|no longer|wrong|avoid|without)\b[^.]{0,30}$/i;
function states(re: RegExp, text: string): boolean {
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  for (const m of text.matchAll(g)) {
    if (!NEGATION.test(text.slice(Math.max(0, m.index! - 30), m.index!))) return true;
  }
  return false;
}
// The reverse for the correct fix: "don't reconnect" or "no need to reconnect" is not giving the fix.
const REFUSAL = /\b(don'?t|do not|no need to|never|shouldn'?t|stop)\s+(\w+\s+){0,2}$/i;
function gives(re: RegExp, text: string): boolean {
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  for (const m of text.matchAll(g)) {
    if (!REFUSAL.test(text.slice(Math.max(0, m.index! - 25), m.index!))) return true;
  }
  return false;
}

function words(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function lastSentence(s: string): string {
  const parts = s.trim().split(/(?<=[.!?])\s+/).filter(Boolean);
  return parts.slice(-2).join(" ");
}

export function gateReply(input: {
  reply: string;
  issue?: { status?: number; body?: unknown; message?: string };
  expectedId?: string;
  threshold?: number;
}): GateResult {
  const reply = input.reply ?? "";
  const threshold = input.threshold ?? 10;
  let expected: Explanation | undefined;
  if (input.issue) {
    const hits = explainError(input.issue);
    expected = input.expectedId ? hits.find((h) => h.id === input.expectedId) ?? hits[0] : hits[0];
  }
  const claims = expected ? CLAIMS[expected.id] ?? CLAIMS.unknown : undefined;
  const checks: GateCheck[] = [];
  const add = (id: CheckId, critical: boolean, pass: boolean, rule: string, note?: string) =>
    checks.push({ id, critical, pass, rule, ...(pass ? {} : { note }) });

  add("C1_correct_fix", true, claims ? claims.must.some((re) => gives(re, reply)) : false,
    "Says the correct fix for the diagnosed issue (any listed phrasing, not negated). Fails when no issue is given.",
    claims ? `Doesn't give the correct fix. A correct reply says: ${claims.say}.` : "No customer issue given, so the correct fix is unknown.");
  const wrong = [...(claims?.mustNot ?? []), ...HARMFUL].find((re) => states(re, reply));
  add("C2_no_wrong_fix", true, !wrong, "Contains none of the known wrong fixes for this issue, and no harmful advice (delete the account, retry nonstop...).",
    `Gives a wrong or harmful fix. Correct: ${claims?.say ?? "unknown without an issue"}.`);
  const falseFact = FALSE_FACTS.find(([re]) => states(re, reply));
  add("C3_no_false_facts", true, !falseFact, "States none of the known false facts about Blotato.", falseFact?.[1]);
  add("C4_no_promises", true, !states(PROMISES, reply), "Makes no promise support can't keep (refund, guarantee, a deadline).",
    "Makes a promise support can't keep. Remove it; route money questions to billing.");

  const says = ESCALATES.test(reply);
  const needs = !!expected?.escalate;
  add("Q5_escalation", false, expected ? says === needs : true,
    "Offers escalation if and only if the issue type requires a person.",
    needs ? "This issue needs a person; say you're passing it on or escalating." : "Escalates something the customer can fix now; give the fix instead.");
  add("Q6_action", false, ACTION.test(reply), "Contains at least one action verb telling the customer what to do.",
    "No clear action for the customer (copy, move, reconnect, wait, send...).");
  add("Q7_specific", false, SPECIFIC.test(reply), "Names at least one specific field, setting, URL, number or file type.",
    "Vague: name the field, setting, link or number.");
  add("Q8_no_blame", false, !states(BLAME, reply), "Contains no blaming or talking-down words (obviously, simply, read the docs...).",
    "Blames or talks down to the customer.");
  const n = words(reply);
  add("Q9_length", false, n >= 20 && n <= 120, "Is 20 to 120 words long.", `Is ${n} words; keep it between 20 and 120.`);
  add("Q10_next_step", false, NEXT_STEP.test(lastSentence(reply)), "The last two sentences give a next step or ask a question.",
    "End with the next step or a question.");

  const score = checks.filter((c) => c.pass).length;
  const criticalFailed = checks.filter((c) => c.critical && !c.pass).map((c) => c.id);
  const knownBad = criticalFailed.some((id) => id !== "C1_correct_fix");
  const matched = input.issue && !input.expectedId ? explainError(input.issue).map((h) => h.id).filter((id) => id !== "unknown") : [];
  // A status code that the customer's own words don't back up (round 3: --status 404 + "thanks, it works now").
  const said = input.issue?.message?.trim();
  const fromWords = said && input.issue?.status !== undefined && !input.expectedId ? explainError({ message: said })[0].id : undefined;
  const disagree = !!fromWords && !!expected && fromWords !== expected.id;
  const ambiguous = matched.length > 1 || disagree;
  const safety = safetyScreen([input.issue?.message ?? "", reply].join(" "));
  const norm = (t: string) => t.replace(/\s+/g, " ").trim();
  const source: "builtin" | "draft" = expected && norm(reply) === norm(expected.customerReply) ? "builtin" : "draft";
  const clear = !!expected && !ambiguous && !knownBad && safety.length === 0;
  const autoSend = clear && source === "builtin" && score >= threshold;
  const needsJudge = clear && !autoSend;
  const holdReason = safety.length
    ? `Safety screen: ${safety.map((f) => f.reason).join(" ")}`
    : !expected
    ? "No customer issue given, so the gate can't know the right fix. Pass --issue or --status."
    : ambiguous
      ? disagree
        ? `The status code points to ${expected.id} but the customer's words point to ${fromWords}. A person checks.`
        : `The customer's words match ${matched.length} issues (${matched.join(", ")}). A person picks the right one.`
      : knownBad
        ? "Known wrong fix, false fact or promise."
        : needsJudge
          ? "Not the built-in reply with all 10 checks met: the AI judge must check it (reviewReply / --judge), or a person."
          : undefined;
  return {
    score,
    pass: autoSend,
    source,
    safety,
    needsJudge,
    ...(holdReason ? { holdReason } : {}),
    threshold,
    criticalFailed,
    expected: expected && { id: expected.id, title: expected.title, escalate: expected.escalate },
    checks,
    toFix: checks.filter((c) => !c.pass).map((c) => c.note!).filter(Boolean),
  };
}
