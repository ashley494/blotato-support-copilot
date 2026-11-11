// "Doctor": runs the checks a support agent would walk a customer through, in order,
// and stops at the first thing that is actually broken.

import { BlotatoClient, type Account } from "./blotato.js";
import { explainError, type Explanation } from "./explain.js";

export type CheckStatus = "pass" | "fail" | "warn" | "skip";

export interface Check {
  name: string;
  status: CheckStatus;
  detail: string;
  explanation?: Explanation;
}

export interface DoctorReport {
  checks: Check[];
  accounts: Account[];
  healthy: boolean;
}

/** Problems we can see in the key string itself, before calling the API. */
export function inspectKey(raw: string | undefined): Check {
  if (!raw) return { name: "API key present", status: "fail", detail: "No key. Set BLOTATO_API_KEY (Settings > API in Blotato)." };
  const issues: string[] = [];
  if (raw !== raw.trim()) issues.push("has spaces or a line break at the start or end");
  if (/^["'].*["']$/.test(raw.trim())) issues.push("is wrapped in quotes");
  if (/^bearer\s/i.test(raw.trim())) issues.push('starts with "Bearer " (REST wants the bare key in the blotato-api-key header)');
  if (/\s/.test(raw.trim())) issues.push("contains a space in the middle");
  if (issues.length) return { name: "API key format", status: "fail", detail: `The key ${issues.join("; ")}.` };
  return { name: "API key format", status: "pass", detail: `Looks clean (${raw.length} characters${raw.endsWith("=") ? ", ends in =" : ""}).` };
}

const NEEDS_SUBACCOUNT: Record<string, string> = {
  facebook: "Facebook posts need target.pageId",
  linkedin: "LinkedIn company pages need target.pageId (personal profiles don't)",
  youtube: "YouTube playlists are optional (target.playlistIds)",
};

export async function runDoctor(apiKey: string | undefined, opts: { baseUrl?: string; fetchImpl?: typeof fetch } = {}): Promise<DoctorReport> {
  const checks: Check[] = [];
  const keyCheck = inspectKey(apiKey);
  checks.push(keyCheck);
  if (keyCheck.status === "fail") return { checks, accounts: [], healthy: false };

  const client = new BlotatoClient({ apiKey: apiKey!, baseUrl: opts.baseUrl, fetchImpl: opts.fetchImpl, max429Retries: 1 });

  let me;
  try {
    me = await client.me();
  } catch (e: any) {
    checks.push({ name: "Reach Blotato", status: "fail", detail: String(e?.message ?? e), explanation: explainError({ message: [e?.message, e?.cause?.code, e?.cause?.hostname].filter(Boolean).join(" ") || String(e) })[0] });
    return { checks, accounts: [], healthy: false };
  }
  if (!me.ok) {
    checks.push({ name: "Key accepted (GET /users/me)", status: "fail", detail: `HTTP ${me.status}`, explanation: explainError({ status: me.status, body: me.errorBody })[0] });
    return { checks, accounts: [], healthy: false };
  }
  checks.push({ name: "Key accepted (GET /users/me)", status: "pass", detail: "Blotato recognized the key." });

  const acc = await client.accounts();
  if (!acc.ok || !acc.data) {
    checks.push({ name: "List accounts", status: "fail", detail: `HTTP ${acc.status}`, explanation: explainError({ status: acc.status, body: acc.errorBody })[0] });
    return { checks, accounts: [], healthy: false };
  }
  const accounts = acc.data.items ?? [];
  if (accounts.length === 0) {
    checks.push({ name: "Connected accounts", status: "warn", detail: "The key works but no social accounts are connected. Connect one in Blotato before posting." });
    return { checks, accounts, healthy: false };
  }
  const byPlatform = accounts.reduce<Record<string, number>>((m, a) => ((m[a.platform] = (m[a.platform] ?? 0) + 1), m), {});
  checks.push({
    name: "Connected accounts",
    status: "pass",
    detail: Object.entries(byPlatform).map(([p, n]) => `${p}: ${n}`).join(", "),
  });

  // Facebook and LinkedIn need a page; an expired connection shows up here as 422.
  for (const a of accounts.filter((x) => x.platform in NEEDS_SUBACCOUNT)) {
    const sub = await client.subaccounts(a.id);
    const label = `${a.platform} ${a.username ? "@" + a.username : a.fullname || a.id}`; // live LinkedIn accounts come back with username ""
    if (!sub.ok) {
      checks.push({ name: `Pages for ${label}`, status: "fail", detail: `HTTP ${sub.status}`, explanation: explainError({ status: sub.status, body: sub.errorBody })[0] });
      continue;
    }
    const items = sub.data?.items ?? [];
    if (a.platform === "facebook" && items.length === 0) {
      checks.push({ name: `Pages for ${label}`, status: "warn", detail: "No Facebook Pages found. Facebook posting needs a Page (target.pageId)." });
    } else {
      checks.push({
        name: `Pages for ${label}`,
        status: "pass",
        detail: items.length ? items.map((i) => `${i.name ?? "page"} (pageId ${i.id})`).join(", ") : `none (${NEEDS_SUBACCOUNT[a.platform]})`,
      });
    }
  }

  const healthy = checks.every((c) => c.status === "pass");
  return { checks, accounts, healthy };
}

export function formatReport(r: DoctorReport): string {
  const icon: Record<CheckStatus, string> = { pass: "PASS", fail: "FAIL", warn: "WARN", skip: "SKIP" };
  const lines = r.checks.map((c) => {
    let s = `[${icon[c.status]}] ${c.name}: ${c.detail}`;
    if (c.explanation) s += `\n       Why: ${c.explanation.cause}\n       Fix: ${c.explanation.fix.join(" ")}`;
    return s;
  });
  lines.push(r.healthy ? "\nAll checks passed. This account is ready to post." : "\nNot ready yet. Fix the first FAIL above, then run doctor again.");
  return lines.join("\n");
}
