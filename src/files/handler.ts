import { Server } from "./server/index.js";
import { manifest } from "./server/manifest.js";
import {
  applyConfig,
  DeployConfig,
  parseConfig,
} from "@deno/svelte-adapter/__internal";

interface IsrConfig {
  pattern: RegExp;
  expiration: number;
  bypassToken: string | null;
  allowQuery: string[];
}

interface SvelteData {
  isr?: Array<
    {
      pattern: {
        source: string;
        flags: string;
      };
      expiration: number;
      bypassToken: string | null;
      allowQuery: string[];
    }
  >;
}

interface ParsedSvelteData {
  isr: IsrConfig[];
}

export function prepareServer(
  rawSvelteData: SvelteData,
  rawDeployConfig: DeployConfig,
  cwd: string,
): Deno.ServeHandler {
  const svelteData: { isr: IsrConfig[] } = {
    isr: (rawSvelteData.isr ?? []).map((data) => {
      return {
        ...data,
        pattern: new RegExp(`${data.pattern.source}${data.pattern.flags}`),
      };
    }),
  };

  const deployConfig = parseConfig(rawDeployConfig, cwd);
  const server = new Server(manifest);

  const initialized = server.init({
    env: Deno.env.toObject(),
    // TODO: Svelte only supports sync
    read(filePath) {
      const file = Deno.openSync(filePath, { read: true });
      return file.readable;
    },
  });

  const hasIsr = svelteData.isr.length > 0;

  const initCache = hasIsr
    ? caches.open("svelte-isr") // TODO: Are caches global?
    : Promise.resolve(null);

  const handler: Deno.ServeHandler = async (req, info) => {
    await initialized;

    const url = new URL(req.url);

    // Retrieve ISR cache if set for this route
    const cache = await initCache;
    let isr: IsrConfig | null = null;
    if (hasIsr && cache !== null) {
      isr = getIsrConfig(svelteData, req, url);

      if (isr !== null) {
        const key = toCacheKey(url, isr);
        const cached = await cache.match(key);
        if (cached !== undefined) return cached;
      }
    }

    const responded = await applyConfig(deployConfig, url, cwd);
    if (responded !== null) {
      return responded;
    }

    const res = await server.respond(req, {
      getClientAddress() {
        if ("hostname" in info.remoteAddr) {
          return info.remoteAddr.hostname;
        }

        // TODO: What to do for unix sockets?
        return "127.0.0.1";
      },
    });

    // Store ISR cache
    if (isr !== null && cache !== null) {
      const key = toCacheKey(url, isr);
      const clone = res.clone();
      clone.headers.set("Cache-Control", `max-age=${isr.expiration}`);
      await cache.put(key, clone);
    }

    return res;
  };

  return handler;
}

function getIsrConfig(
  svelteData: ParsedSvelteData,
  req: Request,
  url: URL,
): IsrConfig | null {
  for (let i = 0; i < svelteData.isr.length; i++) {
    const data = svelteData.isr[i];
    if (data.pattern.test(url.pathname)) {
      let bypass: string | null = null;

      // Check for bypass token in http headers
      if (req.method === "GET" || req.method === "HEAD") {
        bypass = req.headers.get("x-prerender-revalidate");
        if (bypass !== null && bypass === data.bypassToken) {
          return null;
        }
      }

      // Check for bypass token in Cookie
      const cookies = req.headers.getSetCookie();
      for (let i = 0; i < cookies.length; i++) {
        const [key, value] = cookies[i].split("=");
        if (key === "__prerender_bypass" && value === data.bypassToken) {
          return null;
        }
      }

      return data;
    }
  }

  return null;
}

function toCacheKey(url: URL, config: IsrConfig): Request {
  const newUrl = new URL("http://c");
  newUrl.pathname = url.pathname;

  for (let i = 0; i < config.allowQuery.length; i++) {
    const q = config.allowQuery[i];
    const param = url.searchParams.get(q);
    if (param !== null) {
      newUrl.searchParams.append(q, param);
    }
  }

  return new Request(newUrl);
}
