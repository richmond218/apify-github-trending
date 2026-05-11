import { describe, it, expect, vi } from "vitest";
import {
  GithubClient,
  GithubApiError,
  parseTrendingHtml,
  transformRepo,
} from "../src/github-client.js";
import {
  TRENDING_HTML,
  REPO_RAW,
  REPO_LANGUAGES,
  REPO_CONTRIBUTORS,
  USER_REPOS,
  SEARCH_REPOS,
} from "./fixtures.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
}
function htmlResponse(body: string): Response {
  return new Response(body, { status: 200, headers: { "Content-Type": "text/html" } });
}

describe("parseTrendingHtml", () => {
  it("extracts trending entries with rank, stars, language, builders", () => {
    const repos = parseTrendingHtml(TRENDING_HTML, 25);
    expect(repos).toHaveLength(2);
    expect(repos[0]).toMatchObject({
      rank: 1,
      owner: "sample-org",
      repo: "cool-repo",
      full_name: "sample-org/cool-repo",
      url: "https://github.com/sample-org/cool-repo",
      description: "A really cool repo doing cool things.",
      language: "TypeScript",
      total_stars: 12345,
      total_forks: 678,
      stars_in_period: 1234,
    });
    expect(repos[0]?.built_by).toEqual(["octocat", "torvalds"]);
    expect(repos[1]?.stars_in_period).toBe(500);
  });

  it("respects the limit parameter", () => {
    const repos = parseTrendingHtml(TRENDING_HTML, 1);
    expect(repos).toHaveLength(1);
  });
});

describe("GithubClient.trendingHtml", () => {
  it("hits /trending/<lang>?since=X", async () => {
    const fetchImpl = vi.fn(async () => htmlResponse(TRENDING_HTML)) as unknown as typeof fetch;
    const client = new GithubClient({ fetchImpl });
    await client.trendingHtml({ language: "TypeScript", since: "weekly" });
    const url = String((fetchImpl as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]![0]);
    expect(url).toContain("/trending/typescript");
    expect(url).toContain("since=weekly");
  });

  it("hits /trending root when no language", async () => {
    const fetchImpl = vi.fn(async () => htmlResponse(TRENDING_HTML)) as unknown as typeof fetch;
    const client = new GithubClient({ fetchImpl });
    await client.trendingHtml({ since: "daily" });
    const url = String((fetchImpl as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]![0]);
    expect(url).toMatch(/\/trending\?since=daily/);
  });
});

describe("GithubClient.getRepo", () => {
  it("fetches and validates a repo", async () => {
    const fetchImpl = (async () => jsonResponse(REPO_RAW)) as unknown as typeof fetch;
    const client = new GithubClient({ fetchImpl });
    const repo = await client.getRepo("sample-org", "cool-repo");
    expect(repo?.full_name).toBe("sample-org/cool-repo");
    expect(repo?.stargazers_count).toBe(12345);
  });

  it("returns null on 404", async () => {
    const fetchImpl = (async () => new Response("", { status: 404 })) as unknown as typeof fetch;
    const client = new GithubClient({ fetchImpl, maxRetries: 0 });
    expect(await client.getRepo("nope", "nope")).toBeNull();
  });
});

describe("GithubClient.getRepoLanguages / getRepoContributors", () => {
  it("returns languages map", async () => {
    const fetchImpl = (async () => jsonResponse(REPO_LANGUAGES)) as unknown as typeof fetch;
    const client = new GithubClient({ fetchImpl });
    const langs = await client.getRepoLanguages("sample-org", "cool-repo");
    expect(langs.TypeScript).toBe(80000);
  });

  it("returns contributors with login + contributions", async () => {
    const fetchImpl = (async () => jsonResponse(REPO_CONTRIBUTORS)) as unknown as typeof fetch;
    const client = new GithubClient({ fetchImpl });
    const contribs = await client.getRepoContributors("sample-org", "cool-repo", 10);
    expect(contribs).toHaveLength(2);
    expect(contribs[0]?.login).toBe("octocat");
  });
});

describe("GithubClient.listUserRepos / searchRepos", () => {
  it("lists user repos", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(USER_REPOS)) as unknown as typeof fetch;
    const client = new GithubClient({ fetchImpl });
    const repos = await client.listUserRepos("sample-org", { limit: 10, sort: "updated" });
    expect(repos).toHaveLength(2);
    const url = String((fetchImpl as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]![0]);
    expect(url).toContain("/users/sample-org/repos");
    expect(url).toContain("sort=updated");
    expect(url).toContain("per_page=10");
  });

  it("searches repos", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(SEARCH_REPOS)) as unknown as typeof fetch;
    const client = new GithubClient({ fetchImpl });
    const repos = await client.searchRepos("language:typescript stars:>1000", { sort: "stars", limit: 10 });
    expect(repos).toHaveLength(2);
    const url = String((fetchImpl as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]![0]);
    expect(url).toContain("/search/repositories");
    expect(url).toContain("sort=stars");
  });
});

describe("GithubClient — auth + retries", () => {
  it("attaches Authorization header when token provided", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(REPO_RAW)) as unknown as typeof fetch;
    const client = new GithubClient({ fetchImpl, token: "ghp_TESTTOKEN" });
    await client.getRepo("sample-org", "cool-repo");
    const init = (fetchImpl as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]![1] as
      | { headers: Record<string, string> }
      | undefined;
    expect(init?.headers.Authorization).toBe("Bearer ghp_TESTTOKEN");
  });

  it("retries on 503", async () => {
    let call = 0;
    const fetchImpl = (async () => {
      call++;
      if (call === 1) return new Response("down", { status: 503 });
      return jsonResponse(REPO_RAW);
    }) as unknown as typeof fetch;
    const client = new GithubClient({ fetchImpl, maxRetries: 2 });
    const repo = await client.getRepo("a", "b");
    expect(repo?.full_name).toBe("sample-org/cool-repo");
    expect(call).toBe(2);
  });

  it("throws on persistent 503", async () => {
    const fetchImpl = (async () => new Response("", { status: 503 })) as unknown as typeof fetch;
    const client = new GithubClient({ fetchImpl, maxRetries: 1 });
    await expect(client.getRepo("a", "b")).rejects.toBeInstanceOf(GithubApiError);
  });
});

describe("transformRepo", () => {
  it("maps GitHub repo to RepoOutput", () => {
    const out = transformRepo({
      ...REPO_RAW,
      stargazers_count: 12345,
    } as Parameters<typeof transformRepo>[0]);
    expect(out.owner).toBe("sample-org");
    expect(out.repo).toBe("cool-repo");
    expect(out.stars).toBe(12345);
    expect(out.license).toBe("MIT");
    expect(out.topics).toEqual(["typescript", "actor", "mcp"]);
  });
});
