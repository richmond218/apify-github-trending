import {
  GhRepoRawSchema,
  type GhRepoRaw,
  type RepoOutput,
  type TrendingRepoOutput,
} from "./types.js";

const GITHUB_API = "https://api.github.com";
const TRENDING_BASE = "https://github.com/trending";
const DEFAULT_UA = "apify-github-trending/0.1";

export interface GithubClientOptions {
  fetchImpl?: typeof fetch;
  userAgent?: string;
  token?: string;
  maxRetries?: number;
}

export class GithubApiError extends Error {
  override name = "GithubApiError";
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

export class GithubClient {
  private readonly fetchImpl: typeof fetch;
  private readonly userAgent: string;
  private readonly token?: string;
  private readonly maxRetries: number;

  constructor(opts: GithubClientOptions = {}) {
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch;
    this.userAgent = opts.userAgent ?? DEFAULT_UA;
    if (opts.token !== undefined) this.token = opts.token;
    this.maxRetries = opts.maxRetries ?? 3;
  }

  async trendingHtml(args: {
    language?: string;
    since: "daily" | "weekly" | "monthly";
    spoken_language?: string;
  }): Promise<string> {
    const params = new URLSearchParams();
    params.set("since", args.since);
    if (args.spoken_language) params.set("spoken_language_code", args.spoken_language);
    const path = args.language ? `/${encodeURIComponent(args.language.toLowerCase())}` : "";
    const url = `${TRENDING_BASE}${path}?${params}`;
    return this.getText(url);
  }

  async getRepo(owner: string, repo: string): Promise<GhRepoRaw | null> {
    const body = await this.getJson<unknown>(`${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
    if (!body) return null;
    const parsed = GhRepoRawSchema.safeParse(body);
    return parsed.success ? parsed.data : null;
  }

  async getRepoLanguages(owner: string, repo: string): Promise<Record<string, number>> {
    const body = await this.getJson<Record<string, number>>(`${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/languages`);
    return body ?? {};
  }

  async getRepoContributors(
    owner: string,
    repo: string,
    limit: number,
  ): Promise<Array<{ login: string; contributions: number; html_url?: string }>> {
    const body = await this.getJson<Array<{ login: string; contributions: number; html_url?: string }>>(
      `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contributors?per_page=${limit}`,
    );
    return body ?? [];
  }

  async listUserRepos(
    username: string,
    opts: { sort?: string; direction?: string; type?: string; limit?: number } = {},
  ): Promise<GhRepoRaw[]> {
    const params = new URLSearchParams();
    if (opts.sort) params.set("sort", opts.sort);
    if (opts.direction) params.set("direction", opts.direction);
    if (opts.type) params.set("type", opts.type);
    params.set("per_page", String(Math.min(100, Math.max(1, opts.limit ?? 30))));
    const url = `${GITHUB_API}/users/${encodeURIComponent(username)}/repos?${params}`;
    const body = await this.getJson<unknown[]>(url);
    if (!Array.isArray(body)) return [];
    return body
      .map((r) => GhRepoRawSchema.safeParse(r))
      .filter((p): p is { success: true; data: GhRepoRaw } => p.success)
      .map((p) => p.data);
  }

  async searchRepos(
    query: string,
    opts: { sort?: string; order?: string; limit?: number } = {},
  ): Promise<GhRepoRaw[]> {
    const params = new URLSearchParams();
    params.set("q", query);
    if (opts.sort && opts.sort !== "best-match") params.set("sort", opts.sort);
    if (opts.order) params.set("order", opts.order);
    params.set("per_page", String(Math.min(100, Math.max(1, opts.limit ?? 30))));
    const body = await this.getJson<{ items?: unknown[] }>(`${GITHUB_API}/search/repositories?${params}`);
    if (!body?.items) return [];
    return body.items
      .map((r) => GhRepoRawSchema.safeParse(r))
      .filter((p): p is { success: true; data: GhRepoRaw } => p.success)
      .map((p) => p.data);
  }

  private buildHeaders(jsonAccept: boolean): Record<string, string> {
    const h: Record<string, string> = {
      "User-Agent": this.userAgent,
      Accept: jsonAccept ? "application/vnd.github+json" : "text/html,application/xhtml+xml",
    };
    if (jsonAccept) h["X-GitHub-Api-Version"] = "2022-11-28";
    if (this.token) h.Authorization = `Bearer ${this.token}`;
    return h;
  }

  private async getJson<T>(url: string): Promise<T | null> {
    return this.request<T>(url, true);
  }

  private async getText(url: string): Promise<string> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const res = await this.fetchImpl(url, { headers: this.buildHeaders(false) });
        if (res.status === 429 || res.status >= 500) {
          if (attempt < this.maxRetries) {
            await sleep(exponentialBackoff(attempt));
            continue;
          }
          throw new GithubApiError(`GitHub ${url} -> ${res.status} after ${attempt + 1} attempts`, res.status);
        }
        if (!res.ok) throw new GithubApiError(`GitHub ${url} -> ${res.status}`, res.status);
        return await res.text();
      } catch (err) {
        lastError = err as Error;
        if (err instanceof GithubApiError && err.status !== undefined && err.status < 500 && err.status !== 429) {
          throw err;
        }
        if (attempt >= this.maxRetries) throw lastError;
        await sleep(exponentialBackoff(attempt));
      }
    }
    throw lastError ?? new Error("Unreachable retry loop");
  }

  private async request<T>(url: string, jsonAccept: boolean): Promise<T | null> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const res = await this.fetchImpl(url, { headers: this.buildHeaders(jsonAccept) });
        if (res.status === 429 || res.status >= 500) {
          if (attempt < this.maxRetries) {
            await sleep(exponentialBackoff(attempt));
            continue;
          }
          throw new GithubApiError(`GitHub ${url} -> ${res.status} after ${attempt + 1} attempts`, res.status);
        }
        if (res.status === 404) return null;
        if (!res.ok) throw new GithubApiError(`GitHub ${url} -> ${res.status}`, res.status);
        const text = await res.text();
        if (!text) return null;
        return JSON.parse(text) as T;
      } catch (err) {
        lastError = err as Error;
        if (err instanceof GithubApiError && err.status !== undefined && err.status < 500 && err.status !== 429) {
          throw err;
        }
        if (attempt >= this.maxRetries) throw lastError;
        await sleep(exponentialBackoff(attempt));
      }
    }
    throw lastError ?? new Error("Unreachable retry loop");
  }
}

export function parseTrendingHtml(html: string, limit: number): TrendingRepoOutput[] {
  const out: TrendingRepoOutput[] = [];
  const articleRegex = /<article class="Box-row">([\s\S]*?)<\/article>/g;
  let rank = 0;
  for (const match of html.matchAll(articleRegex)) {
    if (out.length >= limit) break;
    const block = match[1] ?? "";
    rank++;
    const repoLink = /<h2[^>]*>\s*<a href="\/([^"/]+)\/([^"]+)"/.exec(block);
    if (!repoLink) continue;
    const owner = decode(repoLink[1] ?? "");
    const repo = decode(repoLink[2] ?? "");
    if (!owner || !repo) continue;

    const item: TrendingRepoOutput = {
      rank,
      owner,
      repo,
      full_name: `${owner}/${repo}`,
      url: `https://github.com/${owner}/${repo}`,
    };

    const descMatch = /<p class="col-9[^"]*"[^>]*>([\s\S]*?)<\/p>/.exec(block);
    if (descMatch?.[1]) {
      const desc = stripTags(descMatch[1]).trim();
      if (desc) item.description = desc;
    }
    const langMatch = /<span itemprop="programmingLanguage">([\s\S]*?)<\/span>/.exec(block);
    if (langMatch?.[1]) item.language = decode(stripTags(langMatch[1]).trim());

    const starsMatch = /\/stargazers"[^>]*>\s*([\d,]+)/.exec(block);
    if (starsMatch?.[1]) item.total_stars = parseIntComma(starsMatch[1]);
    const forksMatch = /\/forks"[^>]*>\s*([\d,]+)/.exec(block);
    if (forksMatch?.[1]) item.total_forks = parseIntComma(forksMatch[1]);

    const periodMatch = /([\d,]+)\s+stars\s+(this\s+\w+|today)/i.exec(block);
    if (periodMatch?.[1]) item.stars_in_period = parseIntComma(periodMatch[1]);

    const builtByMatches = [...block.matchAll(/<a class="d-inline-block"[^>]*href="\/([^"]+)"/g)];
    const builtBy = builtByMatches
      .map((m) => decode(m[1] ?? ""))
      .filter((u) => u && !u.includes("/"));
    if (builtBy.length) item.built_by = builtBy;

    out.push(item);
  }
  return out;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

function decode(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function parseIntComma(s: string): number {
  return parseInt(s.replace(/,/g, ""), 10);
}

export function transformRepo(raw: GhRepoRaw): RepoOutput {
  const [owner, repo] = raw.full_name.split("/");
  const out: RepoOutput = {
    owner: owner ?? raw.owner?.login ?? "",
    repo: repo ?? raw.name,
    full_name: raw.full_name,
    url: raw.html_url,
  };
  if (raw.description) out.description = raw.description;
  if (raw.language) out.language = raw.language;
  if (raw.topics?.length) out.topics = raw.topics;
  if (raw.stargazers_count !== undefined) out.stars = raw.stargazers_count;
  if (raw.forks_count !== undefined) out.forks = raw.forks_count;
  if (raw.open_issues_count !== undefined) out.open_issues = raw.open_issues_count;
  if (raw.default_branch) out.default_branch = raw.default_branch;
  if (raw.license?.spdx_id) out.license = raw.license.spdx_id;
  if (raw.created_at) out.created_at = raw.created_at;
  if (raw.updated_at) out.updated_at = raw.updated_at;
  if (raw.pushed_at) out.pushed_at = raw.pushed_at;
  if (raw.fork !== undefined) out.is_fork = raw.fork;
  if (raw.archived !== undefined) out.is_archived = raw.archived;
  if (raw.size !== undefined) out.size_kb = raw.size;
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function exponentialBackoff(attempt: number): number {
  return Math.min(8000, 500 * 2 ** attempt) + Math.floor(Math.random() * 250);
}
