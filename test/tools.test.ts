import { describe, it, expect } from "vitest";
import { GithubClient } from "../src/github-client.js";
import { runTool } from "../src/tools/index.js";
import {
  TRENDING_HTML,
  REPO_RAW,
  REPO_LANGUAGES,
  REPO_CONTRIBUTORS,
  USER_REPOS,
  SEARCH_REPOS,
} from "./fixtures.js";

function makeMockClient(): GithubClient {
  const fetchImpl = (async (input: string | URL) => {
    const url = String(input);
    if (url.includes("github.com/trending")) {
      return new Response(TRENDING_HTML, { status: 200, headers: { "Content-Type": "text/html" } });
    }
    if (url.includes("/repos/sample-org/cool-repo/languages")) {
      return new Response(JSON.stringify(REPO_LANGUAGES));
    }
    if (url.includes("/repos/sample-org/cool-repo/contributors")) {
      return new Response(JSON.stringify(REPO_CONTRIBUTORS));
    }
    if (url.includes("/repos/sample-org/cool-repo")) {
      return new Response(JSON.stringify(REPO_RAW));
    }
    if (url.includes("/repos/nope/nope")) {
      return new Response("", { status: 404 });
    }
    if (url.includes("/users/sample-org/repos")) {
      return new Response(JSON.stringify(USER_REPOS));
    }
    if (url.includes("/search/repositories")) {
      return new Response(JSON.stringify(SEARCH_REPOS));
    }
    return new Response("", { status: 404 });
  }) as unknown as typeof fetch;
  return new GithubClient({ fetchImpl, maxRetries: 0 });
}

describe("runTool('trending_repos')", () => {
  it("returns parsed trending repos", async () => {
    const result = (await runTool(
      "trending_repos",
      { language: "TypeScript", since: "daily", limit: 25 },
      makeMockClient(),
    )) as { since: string; repos: Array<{ owner: string; repo: string }> };
    expect(result.since).toBe("daily");
    expect(result.repos.length).toBe(2);
    expect(result.repos[0]?.owner).toBe("sample-org");
  });

  it("applies the limit", async () => {
    const result = (await runTool(
      "trending_repos",
      { since: "weekly", limit: 1 },
      makeMockClient(),
    )) as { repos: unknown[] };
    expect(result.repos).toHaveLength(1);
  });
});

describe("runTool('repo_details')", () => {
  it("returns repo metadata", async () => {
    const result = (await runTool(
      "repo_details",
      { owner: "sample-org", repo: "cool-repo" },
      makeMockClient(),
    )) as { stars?: number; languages?: Record<string, number>; top_contributors?: unknown[] };
    expect(result.stars).toBe(12345);
    expect(result.languages).toBeUndefined();
    expect(result.top_contributors).toBeUndefined();
  });

  it("includes languages + top contributors when requested", async () => {
    const result = (await runTool(
      "repo_details",
      { owner: "sample-org", repo: "cool-repo", include_languages: true, include_top_contributors: true },
      makeMockClient(),
    )) as {
      languages?: Record<string, number>;
      top_contributors?: Array<{ username: string; contributions: number }>;
    };
    expect(result.languages?.TypeScript).toBe(80000);
    expect(result.top_contributors?.[0]?.username).toBe("octocat");
  });

  it("returns not_found when repo missing", async () => {
    const result = (await runTool(
      "repo_details",
      { owner: "nope", repo: "nope" },
      makeMockClient(),
    )) as { not_found: boolean };
    expect(result.not_found).toBe(true);
  });
});

describe("runTool('user_repos')", () => {
  it("returns user's repos", async () => {
    const result = (await runTool(
      "user_repos",
      { username: "sample-org", limit: 10, sort: "updated" },
      makeMockClient(),
    )) as { username: string; repos: Array<{ full_name: string }> };
    expect(result.username).toBe("sample-org");
    expect(result.repos.length).toBe(2);
  });
});

describe("runTool('search_repos')", () => {
  it("returns search results", async () => {
    const result = (await runTool(
      "search_repos",
      { query: "language:typescript stars:>1000", sort: "stars", limit: 10 },
      makeMockClient(),
    )) as { query: string; repos: unknown[] };
    expect(result.query).toContain("typescript");
    expect(result.repos.length).toBeGreaterThan(0);
  });
});
