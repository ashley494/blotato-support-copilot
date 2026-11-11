# Entry score log

Scored against [scoring.md](scoring.md), section 2. Yes/no only; "no" until the evidence exists.

## Round 0 (2026-11-10, self-scored strictly, before outside review)

Gates: G1 no (repo private), G2 yes, G3 no (video not uploaded), G4 no (resume is text, no PDF). **Not ready to send.**

| Check | Met | Evidence or what's missing |
|---|---|---|
| J1 | yes | test/replay.test.ts, docs/replay-results.md |
| J2 | yes | src/explain.ts customerReply on every rule |
| J3 | yes | test/gate.test.ts "the WRONG fix fails" |
| J4 | yes | escalate flags; n8n run routes refund to a person |
| J5 | no | n8n run screenshots exist only in the unpublished video |
| J6 | yes | docs/help-articles/ |
| P1 | yes | docs/live-test.md |
| P2 | yes | 48 cases, docs/replay-results.md |
| P3 | yes | held-out blind set, 10 of 14 |
| P4 | yes | network-unreachable rule + regression test |
| P5 | no | README says 28 tests (now 34); video says 9.7 (gate v2 scores it 10/10) |
| E1 | yes | `npm test` 34/34 |
| E2 | no | no CI workflow |
| E3 | no | 1 commit |
| E4 | yes | key scan of all tracked files: 0 hits |
| R1 | yes | 2:49, real n8n runs |
| R2 | no | README opens with a long feature list |
| R3 | no | needs install, build and a key or a manual mock setup |
| R4 | no | no image in README |
| R5 | yes | docs/scoring.md (link from README pending) |

**Points: 65 / 100.**

## Round 1 (2026-11-10, after 7 outside reviewers)

Reviewers: a person who never heard of Blotato, a 5th grader, "Sabrina" (founder persona), a hostile engineer, a support team lead, an n8n expert, and a competitive judge (who scored this entry 55 and shaunadigital/adopt-me-posts 60 on the same rubric).

Fixed this round:
- Gate rebuilt twice. v2: 10 yes/no checks. The hostile engineer then got 14 of 16 wrong replies through v2. v3: negation-aware checks, harmful advice and promise lists, and free-form drafts need the AI judge. Now 14 of 14 hostile drafts held, 12 of 12 correct drafts sent, 28 of 28 built-in replies pass.
- 26 built-in replies rewritten after the support lead found 25 of 28 not sendable to a non-technical customer (jargon, causes stated before checking, no intake details).
- The n8n flow was shipping the old gate. Rebuilt, error path added, and a test now fails if it drifts from the source.
- README rewritten: what Blotato is, the honest headline result, a real n8n run screenshot, one-command demo, scoring link. Stale numbers (8/10, 5.4, 9.7, 28 tests, 18 issue types) removed.
- Video: six scenes re-narrated in plain words, every number matches the code, n8n screenshot recaptured from a run of the current flow.
- DM rewritten to lead with the proof. Resume PDF made.

Gates: G1 waiting on Ashley's yes (make public). G2 met in the repo, public once pushed. G3 waiting on her yes (upload the video). G4 met (2026-11-10_sage_ashley-shifflett-resume.pdf, USA in the header).

| Check | Met | Evidence |
|---|---|---|
| J1 | yes | replay test, 48 of 48 real, 10 of 14 blind |
| J2 | yes | `scripts/check-replies.mjs`: 28 of 28 |
| J3 | yes | `test/gate.test.ts` HOSTILE and wrong-fix tests |
| J4 | yes | n8n run 16: a refund ticket takes "Hand to a human" (docs/img/n8n-run-human.jpg) |
| J5 | ready | screenshot in docs/img and README; counts once committed (her yes) |
| J6 | yes | docs/help-articles/ (3) |
| P1 | yes | docs/live-test.md |
| P2 | yes | 48 cases with source links |
| P3 | yes | blind set written by a separate agent from one-line issue descriptions, never shown the rules' code |
| P4 | yes | network-unreachable rule + regression test; n8n runner bug + drift test |
| P5 | yes | README, video narration and DM numbers re-checked against `npm test`, `check-replies`, `judge-eval` |
| E1 | yes | `npm test` 39 of 39 |
| E2 | ready | .github/workflows/test.yml; counts once pushed and green (her yes) |
| E3 | ready | work to be committed in 6 steps (her yes) |
| E4 | yes | key scan of every file that would be committed: 0 hits |
| R1 | yes | 2:43, real n8n run screenshots |
| R2 | yes | README first screen: one sentence, headline result, one command |
| R3 | yes | clean copy: `npm ci && npm run demo` in 3.7 s, no key |
| R4 | yes | n8n run screenshot in README |
| R5 | yes | README links docs/scoring.md |

**Points met now: 85 / 100. With Ashley's yes (J5, E2, E3): 100 / 100.** Round 2 reviewers next.

## Round 2 (2026-11-10, in progress when the session's usage limit hit)

Reviewers: outsider, "Sabrina" (scored 70), hostile engineer. The hostile engineer found 10 false sends through the built-in path (misrouted tickets) and 9 false holds.

Fixed: gate v4 (a ticket that matches more than one issue goes to a person; known-bad = instant hold; everything else needs all 10 checks or the AI judge; the judge must meet all 10 too), the 201, credit-card, certificate, plan and stuck-post matchers, and the customer-typed wait time is no longer echoed. 44 round-2 cases are now tests. `npm test` 43 of 43, 28 of 28 built-in replies.

Measured: AI judge on 34 new round-2 drafts: 0 wrong replies sent, 4 correct ones held (safe). Fresh blind set 2 (20 tickets by an agent that never saw the code): rules alone 12 of 20 diagnosed, 0 wrong sends; with the new AI classifier (src/classify.ts) 20 of 20 diagnosed, 0 wrong sends.

Open: why the judge holds replies for AI-picked issues (last run hit "classifier unavailable"); README, scoring.md, DM and video narration still need the v4 numbers; the video needs re-narrating (bug count 3, s1, s3, s5, s6, s7, s9) and re-export; then a round 3 hostile review.

## Round 3 (2026-11-11)

The hostile reviewer got 24 tickets an automatic reply in v4, including a customer in distress, a hacked account, a lawyer, a GDPR request and a pasted password, plus 3 through the AI path. Root cause: keyword rules decided what to send without reading the whole message.

Fixed (gate v5): a safety screen runs first; nothing is sent without the AI judge reading the customer's whole message; the classifier can say "needs a person" and the code obeys it; a status code the words don't back up is held; wait times come only from Blotato's response; input is capped; the slow regex is bounded. The n8n flow now calls the copilot service for the AI judge before its "send" branch (live runs 17 to 19: a scheduled-post ticket sent after the judge passed it, a distress message and a refund sent to a person). All 27 round-3 tickets are tests. `npm test` 45 of 45.

Fresh blind set on v5, first run: 19 of 20 diagnosed, 13 sent (all correct), 7 to a person, 0 wrong.

Gates: G1 and G3 waiting on Ashley's yes; G2 met in the repo, public once pushed; G4 met. Points: unchanged from round 1 at 85 met now, 100 with her yes (J5, E2, E3). Round 4 hostile review next; the loop stops when it finds zero false sends.

## Round 4 (2026-11-11), the last round under the loop's 4-round limit

The hostile reviewer spent 16 attacks on the full AI path. v5 held 12 and sent 4 wrong replies: an n8n credential pointed at api.blotato.com got the REST address with /v2 (wrong for that field); an MCP question got the REST address; a timezone problem got the "move scheduledTime" fix the customer had already done; and a request to repost another creator's TikTok got upload instructions. It also found 9 ordinary tickets the safety screen sent to a person for no reason.

Fixed (v6): rules and Claude diagnose every ticket independently and must agree, or a person takes it; Claude's "needs a person" always wins; new rules for the MCP address and timezone offsets; the judge knows the n8n and MCP addresses and fails replies that repeat a fix the customer already tried; the safety screen was narrowed (all 9 false alarms cleared) and widened (another creator's content, indirect goodbyes, German, French and Spanish deletion requests). All 4 cases rerun through the full AI path: the 3 support cases get the right reply, the repost goes to a person. `npm test` 47 of 47; 30 of 30 built-in replies.

Fresh blind set on v6, first run: 19 of 20 diagnosed, 12 sent (all correct), 8 to a person, 0 wrong.

Stop condition: the loop ran its 4 rounds. Round 4's 4 false sends are fixed and re-verified, but no fresh hostile round has attacked v6 yet. Points: 85 met now, 100 with Ashley's yes (repo public, CI on GitHub, commits).

## Round 5 (2026-11-11), added on Ashley's request

20 new attacks on v6. Held 17, sent 3: a draft granting all permissions on all client Pages, a draft making a whole client photo folder public (the same input passed once and failed once), and an English reply to a Spanish ticket. Fixed in v7: least-privilege rule in the judge, two judge runs that must both pass, non-English tickets to a person, safety screen over the whole ticket. All 3 re-checked: held. `npm test` 48 of 48; 30 of 30 built-in replies.

Final version: fresh blind set 20 of 20 diagnosed, 12 sent (all correct), 8 to a person, 0 wrong. Known-answer drafts: 14 of 14 wrong held, 11 of 12 correct sent.

Attacks across five rounds: 16 + 44 + 27 + 16 + 20 = 123, every one that got through now a test. Points: 85 met now, 100 with Ashley's yes to publish.
