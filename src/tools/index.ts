import {
  RepoDetailsArgsSchema,
  SearchReposArgsSchema,
  TrendingArgsSchema,
  UserReposArgsSchema,
  type ToolName,
} from "../types.js";
import { GithubClient, parseTrendingHtml, transformRepo } from "../github-client.js";

export async function runTool(
  tool: ToolName,
  args: unknown,
  client: GithubClient,
): Promise<unknown> {
  switch (tool) {
    case "trending_repos":
      return runTrending(args, client);
    case "repo_details":
      return runRepoDetails(args, client);
    case "user_repos":
      return runUserRepos(args, client);
    case "search_repos":
      return runSearchRepos(args, client);
  }
}

async function runTrending(rawArgs: unknown, client: GithubClient) {
  const args = TrendingArgsSchema.parse(rawArgs);
  const trendingArgs: Parameters<GithubClient["trendingHtml"]>[0] = { since: args.since };
  if (args.language !== undefined) trendingArgs.language = args.language;
  if (args.spoken_language !== undefined) trendingArgs.spoken_language = args.spoken_language;
  const html = await client.trendingHtml(trendingArgs);
  const repos = parseTrendingHtml(html, args.limit);
  return {
    since: args.since,
    language: args.language,
    spoken_language: args.spoken_language,
    returned: repos.length,
    repos,
  };
}

async function runRepoDetails(rawArgs: unknown, client: GithubClient) {
  const args = RepoDetailsArgsSchema.parse(rawArgs);
  const raw = await client.getRepo(args.owner, args.repo);
  if (!raw) return { owner: args.owner, repo: args.repo, not_found: true };
  const out = transformRepo(raw);
  if (args.include_languages) {
    out.languages = await client.getRepoLanguages(args.owner, args.repo);
  }
  if (args.include_top_contributors) {
    const contribs = await client.getRepoContributors(args.owner, args.repo, args.top_contributors_limit);
    out.top_contributors = contribs.map((c) => ({
      username: c.login,
      contributions: c.contributions,
      ...(c.html_url ? { profile_url: c.html_url } : {}),
    }));
  }
  return out;
}

async function runUserRepos(rawArgs: unknown, client: GithubClient) {
  const args = UserReposArgsSchema.parse(rawArgs);
  const raws = await client.listUserRepos(args.username, {
    sort: args.sort,
    direction: args.direction,
    type: args.type,
    limit: args.limit,
  });
  return {
    username: args.username,
    returned: raws.length,
    repos: raws.map(transformRepo),
  };
}

async function runSearchRepos(rawArgs: unknown, client: GithubClient) {
  const args = SearchReposArgsSchema.parse(rawArgs);
  const raws = await client.searchRepos(args.query, {
    sort: args.sort,
    order: args.order,
    limit: args.limit,
  });
  return {
    query: args.query,
    returned: raws.length,
    repos: raws.map(transformRepo),
  };
}
