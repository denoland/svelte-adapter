import rawDeployConfig from "./deploy.json" with { type: "json" };
import rawSvelteData from "./svelte.json" with { type: "json" };
import { prepareServer } from "./handler.ts";

const handler = prepareServer(rawSvelteData, rawDeployConfig, Deno.cwd());

Deno.serve(handler);
