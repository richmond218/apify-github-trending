export const TRENDING_HTML = `
<html><body>
<main>
<article class="Box-row">
  <h2 class="h3"><a href="/sample-org/cool-repo">sample-org / cool-repo</a></h2>
  <p class="col-9 color-fg-muted my-1 pr-4">A really cool repo doing cool things.</p>
  <span itemprop="programmingLanguage">TypeScript</span>
  <a href="/sample-org/cool-repo/stargazers" class="Link--muted">12,345</a>
  <a href="/sample-org/cool-repo/forks" class="Link--muted">678</a>
  <span class="d-inline-block float-sm-right">1,234 stars this week</span>
  <a class="d-inline-block" href="/octocat"><img src="x" /></a>
  <a class="d-inline-block" href="/torvalds"><img src="y" /></a>
</article>
<article class="Box-row">
  <h2 class="h3"><a href="/another-user/another-repo">another-user / another-repo</a></h2>
  <p class="col-9 color-fg-muted my-1 pr-4">Yet another fine project.</p>
  <span itemprop="programmingLanguage">Rust</span>
  <a href="/another-user/another-repo/stargazers" class="Link--muted">9,000</a>
  <a href="/another-user/another-repo/forks" class="Link--muted">42</a>
  <span>500 stars today</span>
</article>
</main>
</body></html>
`;

export const REPO_RAW = {
  id: 1,
  name: "cool-repo",
  full_name: "sample-org/cool-repo",
  owner: { login: "sample-org", html_url: "https://github.com/sample-org" },
  html_url: "https://github.com/sample-org/cool-repo",
  description: "A really cool repo",
  fork: false,
  language: "TypeScript",
  stargazers_count: 12345,
  watchers_count: 12345,
  forks_count: 678,
  open_issues_count: 42,
  default_branch: "main",
  topics: ["typescript", "actor", "mcp"],
  license: { spdx_id: "MIT" },
  created_at: "2023-01-01T00:00:00Z",
  updated_at: "2026-05-01T00:00:00Z",
  pushed_at: "2026-05-09T00:00:00Z",
  archived: false,
  size: 1234,
};

export const REPO_LANGUAGES = { TypeScript: 80000, JavaScript: 4000, CSS: 1500 };

export const REPO_CONTRIBUTORS = [
  { login: "octocat", contributions: 500, html_url: "https://github.com/octocat" },
  { login: "torvalds", contributions: 12, html_url: "https://github.com/torvalds" },
];

export const USER_REPOS = [REPO_RAW, { ...REPO_RAW, id: 2, name: "second-repo", full_name: "sample-org/second-repo", html_url: "https://github.com/sample-org/second-repo" }];

export const SEARCH_REPOS = { total_count: 2, items: USER_REPOS };
