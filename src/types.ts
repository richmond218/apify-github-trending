import { z } from "zod";

export const ToolNameSchema = z.enum([
  "trending_repos",
  "repo_details",
  "user_repos",
  "search_repos",
]);
export type ToolName = z.infer<typeof ToolNameSchema>;

export const InputSchema = z
  .object({
    tool: ToolNameSchema,
    args: z.record(z.unknown()).default({}),
  })
  .strict();
export type Input = z.infer<typeof InputSchema>;

export const TrendingArgsSchema = z.object({
  language: z.string().min(1).max(40).optional(),
  since: z.enum(["daily", "weekly", "monthly"]).default("daily"),
  spoken_language: z.string().min(2).max(7).optional(),
  limit: z.number().int().min(1).max(25).default(25),
});
export type TrendingArgs = z.infer<typeof TrendingArgsSchema>;

export const RepoDetailsArgsSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  include_languages: z.boolean().default(false),
  include_top_contributors: z.boolean().default(false),
  top_contributors_limit: z.number().int().min(1).max(30).default(10),
});
export type RepoDetailsArgs = z.infer<typeof RepoDetailsArgsSchema>;

export const UserReposArgsSchema = z.object({
  username: z.string().min(1),
  sort: z.enum(["created", "updated", "pushed", "full_name"]).default("updated"),
  direction: z.enum(["asc", "desc"]).default("desc"),
  type: z.enum(["all", "owner", "member"]).default("owner"),
  limit: z.number().int().min(1).max(100).default(30),
});
export type UserReposArgs = z.infer<typeof UserReposArgsSchema>;

export const SearchReposArgsSchema = z.object({
  query: z.string().min(1),
  sort: z.enum(["stars", "forks", "help-wanted-issues", "updated", "best-match"]).default("best-match"),
  order: z.enum(["asc", "desc"]).default("desc"),
  limit: z.number().int().min(1).max(100).default(30),
});
export type SearchReposArgs = z.infer<typeof SearchReposArgsSchema>;

// ---------- Raw GitHub API shapes ----------

export const GhRepoRawSchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  owner: z.object({ login: z.string(), html_url: z.string().optional() }).passthrough().optional(),
  html_url: z.string(),
  description: z.string().nullable().optional(),
  fork: z.boolean().optional(),
  language: z.string().nullable().optional(),
  stargazers_count: z.number().optional(),
  watchers_count: z.number().optional(),
  forks_count: z.number().optional(),
  open_issues_count: z.number().optional(),
  default_branch: z.string().optional(),
  topics: z.array(z.string()).optional(),
  license: z.object({ spdx_id: z.string().nullable().optional() }).nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  pushed_at: z.string().optional(),
  archived: z.boolean().optional(),
  size: z.number().optional(),
}).passthrough();
export type GhRepoRaw = z.infer<typeof GhRepoRawSchema>;

// ---------- Public outputs ----------

export const TrendingRepoOutputSchema = z.object({
  rank: z.number().int(),
  owner: z.string(),
  repo: z.string(),
  full_name: z.string(),
  url: z.string(),
  description: z.string().optional(),
  language: z.string().optional(),
  total_stars: z.number().int().optional(),
  total_forks: z.number().int().optional(),
  stars_in_period: z.number().int().optional(),
  built_by: z.array(z.string()).optional(),
});
export type TrendingRepoOutput = z.infer<typeof TrendingRepoOutputSchema>;

export const RepoOutputSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  full_name: z.string(),
  url: z.string(),
  description: z.string().optional(),
  language: z.string().optional(),
  topics: z.array(z.string()).optional(),
  stars: z.number().int().optional(),
  forks: z.number().int().optional(),
  open_issues: z.number().int().optional(),
  default_branch: z.string().optional(),
  license: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  pushed_at: z.string().optional(),
  is_fork: z.boolean().optional(),
  is_archived: z.boolean().optional(),
  size_kb: z.number().int().optional(),
  languages: z.record(z.number()).optional(),
  top_contributors: z.array(z.object({
    username: z.string(),
    contributions: z.number().int(),
    profile_url: z.string().optional(),
  })).optional(),
});
export type RepoOutput = z.infer<typeof RepoOutputSchema>;
