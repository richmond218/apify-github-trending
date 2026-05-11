import { Actor, log } from "apify";
import { InputSchema } from "./types.js";
import { runTool } from "./tools/index.js";
import { GithubClient } from "./github-client.js";

await Actor.init();

try {
  const rawInput = (await Actor.getInput()) ?? {};
  const parsed = InputSchema.safeParse(rawInput);
  if (!parsed.success) {
    log.error("Invalid input", { issues: parsed.error.issues });
    throw new Error(`Invalid input: ${parsed.error.message}`);
  }
  const { tool, args } = parsed.data;
  log.info(`Running tool: ${tool}`);

  const token = process.env.GITHUB_TOKEN;
  const clientOpts: ConstructorParameters<typeof GithubClient>[0] = {};
  if (token) clientOpts.token = token;
  const client = new GithubClient(clientOpts);
  const result = await runTool(tool, args, client);

  await Actor.pushData(result as Record<string, unknown>);
  await Actor.setValue("OUTPUT", result);

  try {
    if (typeof (Actor as unknown as { charge?: (event: string) => Promise<void> }).charge === "function") {
      await (Actor as unknown as { charge: (event: string) => Promise<void> }).charge("tool-call");
    }
  } catch (chargeErr) {
    log.warning("Actor.charge failed (PAY_PER_EVENT may not be enabled)", { err: String(chargeErr) });
  }
} catch (err) {
  log.error("Tool execution failed", { err: String(err) });
  await Actor.fail(String(err));
} finally {
  await Actor.exit();
}
