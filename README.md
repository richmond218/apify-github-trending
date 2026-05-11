# Apify GitHub Trending Tool Server (MCP-style)

An Apify Actor that exposes GitHub trending + repo metadata as a small set of tools an LLM agent can call — one Actor run = one tool call. Anonymous calls work (60/h rate limit); set `GITHUB_TOKEN` to raise the limit to 5,000/h.

## Tools

| Tool | Purpose |
|---|---|
| `trending_repos` | Daily / weekly / monthly trending repos, optionally per language |
| `repo_details` | Repo metadata, languages, and top contributors |
| `user_repos` | A user's public repos |
| `search_repos` | Full GitHub repo search (supports the standard query syntax) |

## Input

```json
{
  "tool": "trending_repos",
  "args": { "language": "typescript", "since": "daily", "limit": 25 }
}
```

`trending_repos` parses GitHub's `/trending` HTML (the API doesn't expose this directly). The other three tools use the REST API and accept a `GITHUB_TOKEN` env var for higher rate limits.

## Example: `repo_details` with extras

```json
{
  "tool": "repo_details",
  "args": {
    "owner": "anthropics",
    "repo": "anthropic-sdk-typescript",
    "include_languages": true,
    "include_top_contributors": true,
    "top_contributors_limit": 10
  }
}
```

Returns:

```json
{
  "owner": "anthropics",
  "repo": "anthropic-sdk-typescript",
  "full_name": "anthropics/anthropic-sdk-typescript",
  "url": "https://github.com/anthropics/anthropic-sdk-typescript",
  "stars": 1234,
  "forks": 56,
  "language": "TypeScript",
  "topics": ["sdk", "anthropic", "claude"],
  "languages": { "TypeScript": 80000, "JavaScript": 1500 },
  "top_contributors": [
    { "username": "octocat", "contributions": 500 }
  ]
}
```

## Why "one run = one tool call"

Each MCP-style invocation is one billable event (PAY_PER_EVENT-compatible). The 4 tools map cleanly to what LLM agents actually want from GitHub (discovery via trending/search, deep dive on a specific repo, profile a user) — easy to pick, easy to bill, easy to cache.

## Run locally

```
npm install
npm run build
apify run --input-file=./examples/trending.json
```

## Tests

```
npm test
```

21 tests across `test/client.test.ts` (HTTP + HTML parser + auth + retry) and `test/tools.test.ts` (the four tools end-to-end with a mocked fetch).

## Architecture

```
src/
  main.ts             Apify entry — reads input, optional GITHUB_TOKEN
  tools/index.ts      Single dispatcher; one async runner per tool
  github-client.ts    REST API + trending HTML parser; retry + auth + UA
  types.ts            Zod schemas for input + outputs
test/
  fixtures.ts         Realistic trending HTML + REST API fixtures
  client.test.ts      14 tests on the HTTP/parsing layer
  tools.test.ts       7 tests on the dispatcher
```

## License

MIT
