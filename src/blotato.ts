// Thin Blotato REST client. Docs: https://help.blotato.com/rest-api-reference/api-reference.md
// Base URL is https://backend.blotato.com/v2 (api.blotato.com is not valid).

export const DEFAULT_BASE_URL = "https://backend.blotato.com/v2";

export interface ApiResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T | null;
  /** Raw error body when the call failed, kept so the explainer can read it. */
  errorBody: unknown;
  /** Seconds the server asked us to wait, parsed from a 429. */
  retryAfterSeconds?: number;
  method: string;
  path: string;
}

export interface ClientOptions {
  apiKey: string;
  baseUrl?: string;
  /** How many times to retry a 429 before giving up. Default 2. */
  max429Retries?: number;
  /** Injected for tests so retries don't actually sleep. */
  sleep?: (ms: number) => Promise<void>;
  fetchImpl?: typeof fetch;
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Blotato's 429 body says "Rate limit exceeded, retry in 49 seconds". */
export function parseRetrySeconds(body: unknown, header?: string | null): number | undefined {
  if (header && /^\d+$/.test(header.trim())) return Number(header.trim());
  const msg = typeof body === "object" && body !== null ? String((body as any).message ?? "") : String(body ?? "");
  const m = msg.match(/retry in (\d+)\s*second/i);
  return m ? Number(m[1]) : undefined;
}

export class BlotatoClient {
  private apiKey: string;
  private baseUrl: string;
  private max429Retries: number;
  private sleep: (ms: number) => Promise<void>;
  private fetchImpl: typeof fetch;

  constructor(opts: ClientOptions) {
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? process.env.BLOTATO_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.max429Retries = opts.max429Retries ?? 2;
    this.sleep = opts.sleep ?? realSleep;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async request<T = unknown>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
    let attempt = 0;
    for (;;) {
      const res = await this.fetchImpl(this.baseUrl + path, {
        method,
        headers: {
          "blotato-api-key": this.apiKey,
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      let parsed: unknown = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = text;
      }
      if (res.status === 429 && attempt < this.max429Retries) {
        const wait = parseRetrySeconds(parsed, res.headers.get("retry-after")) ?? 10;
        attempt++;
        await this.sleep(wait * 1000);
        continue;
      }
      const result: ApiResult<T> = {
        ok: res.ok,
        status: res.status,
        data: res.ok ? (parsed as T) : null,
        errorBody: res.ok ? null : parsed,
        method,
        path,
      };
      if (res.status === 429) result.retryAfterSeconds = parseRetrySeconds(parsed, res.headers.get("retry-after"));
      return result;
    }
  }

  me() {
    return this.request("GET", "/users/me");
  }
  accounts(platform?: string) {
    const q = platform ? `?platform=${encodeURIComponent(platform)}` : "";
    return this.request<{ items: Account[] }>("GET", `/users/me/accounts${q}`);
  }
  subaccounts(accountId: string) {
    return this.request<{ items: SubAccount[] }>("GET", `/users/me/accounts/${encodeURIComponent(accountId)}/subaccounts`);
  }
  createPost(body: unknown) {
    return this.request<{ postSubmissionId: string; scheduledTime?: string }>("POST", "/posts", body);
  }
  postStatus(postSubmissionId: string) {
    return this.request<PostStatus>("GET", `/posts/${encodeURIComponent(postSubmissionId)}`);
  }
}

export interface Account {
  id: string;
  platform: string;
  fullname?: string;
  username?: string;
}
export interface SubAccount {
  id: string;
  accountId: string;
  name?: string;
}
export interface PostStatus {
  postSubmissionId: string;
  status: "in-progress" | "scheduled" | "published" | "failed";
  publicUrl?: string;
  errorMessage?: string;
  scheduledTime?: string;
}
