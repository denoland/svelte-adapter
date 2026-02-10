import { expect } from "expect";
import { parseHTML } from "linkedom";
import path from "node:path";

const cwd = path.join(import.meta.dirname!, "fixture");

async function removeIfExists(dir: string) {
  try {
    await Deno.remove(dir, { recursive: true });
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) throw e;
  }
}

Deno.test.beforeAll(async () => {
  await new Deno.Command("npm", {
    args: ["run", "build"],
    cwd: Deno.cwd(),
  })
    .output();
  await new Deno.Command("npm", {
    args: ["run", "fixture-deps"],
    cwd: Deno.cwd(),
  })
    .output();
});

Deno.test.afterAll(async () => {
  await removeIfExists(path.join(cwd, "node_modules"));
});

Deno.test.beforeEach(async () => {
  await new Deno.Command("npm", {
    args: ["run", "build"],
    cwd,
  }).output();
});

Deno.test.afterEach(async () => {
  await Promise.all(
    [".deno-deploy", ".svelte-kit"].map((dir) =>
      removeIfExists(path.join(cwd, dir))
    ),
  );
});

async function withServer(fn: (origin: string) => Promise<void>) {
  // Intentionally confuse type checker so that it ignores this import
  const file = "handler.ts";
  const specifier = `./fixture/.deno-deploy/${file}`;
  const mod = await import(specifier);
  const svelteData = await import("./fixture/.deno-deploy/svelte.json", {
    with: { type: "json" },
  });
  const deployConfig = await import("./fixture/.deno-deploy/deploy.json", {
    with: { type: "json" },
  });
  const handler = mod.prepareServer(
    svelteData.default,
    deployConfig.default,
    cwd,
  );

  // const server = new FakeServer(handler);
  const inst = await new Promise<
    { server: () => Deno.HttpServer<Deno.NetAddr>; addr: Deno.NetAddr }
  >((resolve) => {
    const server = Deno.serve({
      port: 0,
      onListen: (addr) => {
        resolve({ server: () => server, addr });
      },
    }, handler);
  });

  const origin = `http://${inst.addr.hostname}:${inst.addr.port}`;
  try {
    await fn(origin);
  } finally {
    await inst.server().shutdown();
  }
}

function toDom(input: string): Document {
  // deno-lint-ignore no-explicit-any
  return (parseHTML(input) as any).document as Document;
}

Deno.test("Adapter - starts", async () => {
  await withServer(async (origin) => {
    const res = await fetch(`${origin}/`);
    expect(res.status).toEqual(200);
    expect(await res.text()).toMatch(/to learn about SvelteKit/);
  });
});

Deno.test("Adapter - /about", async () => {
  await withServer(async (origin) => {
    const res = await fetch(`${origin}/about`);
    expect(res.status).toEqual(200);
    expect(await res.text()).toMatch(/npx sv create/);
  });
});

Deno.test("Adapter - redirects /about/ -> /about", async () => {
  await withServer(async (origin) => {
    const res = await fetch(`${origin}/about/`, { redirect: "manual" });
    await res.body?.cancel();
    expect(res.status).toEqual(308);
  });
});

Deno.test("Adapter - serve static files from root", async () => {
  await withServer(async (origin) => {
    const res = await fetch(`${origin}/robots.txt`);

    expect(res.status).toEqual(200);
    expect(res.headers.get("Content-Type")).toEqual("text/plain");
    expect(await res.text()).toContain(
      "https://www.robotstxt.org/robotstxt.html",
    );
  });
});

Deno.test("Adapter - serve static files with cache headers", async () => {
  const immutableDir = path.join(
    cwd,
    ".deno-deploy",
    "static",
    "_app",
    "immutable",
    "assets",
  );
  const immutable = Array.from(Deno.readDirSync(immutableDir));

  const css = immutable.find((item) => item.name.endsWith(".css"))!.name;

  await withServer(async (origin) => {
    const res = await fetch(`${origin}/_app/immutable/assets/${css}`);
    await res.body?.cancel();

    expect(res.status).toEqual(200);
    expect(res.headers.get("Content-Type")).toEqual("text/css; charset=utf-8");
    expect(res.headers.get("Cache-Control")).toEqual(
      "public, immutable, max-age=31536000",
    );
  });
});

Deno.test("Adapter - ISR return cached", async () => {
  await withServer(async (origin) => {
    let renderTime = "";
    {
      const res = await fetch(`${origin}/isr`);
      const document = toDom(await res.text());
      renderTime = document.querySelector("p")!.textContent!;

      expect(res.status).toEqual(200);
      expect(renderTime).toMatch(/Rendered on:/);
    }

    // Fetch again should return cached page
    {
      const res = await fetch(`${origin}/isr`);
      const document = toDom(await res.text());
      const newTime = document.querySelector("p")!.textContent;

      expect(newTime).toEqual(renderTime);
    }
  });
});

Deno.test("Adapter - ISR bypass cache header", async () => {
  await withServer(async (origin) => {
    let renderTime = "";
    {
      const res = await fetch(`${origin}/isr`);
      const document = toDom(await res.text());
      renderTime = document.querySelector("p")!.textContent!;

      expect(res.status).toEqual(200);
      expect(renderTime).toMatch(/Rendered on:/);
    }

    // Adding token header should bypass cache
    {
      const res = await fetch(`${origin}/isr`, {
        headers: {
          "x-prerender-revalidate": "BYPASS",
        },
      });
      const document = toDom(await res.text());
      const newTime = document.querySelector("p")!.textContent;

      expect(newTime).not.toEqual(renderTime);
    }
  });
});

Deno.test("Adapter - ISR bypass cache cookie", async () => {
  await withServer(async (origin) => {
    let renderTime = "";
    {
      const res = await fetch(`${origin}/isr`);
      const document = toDom(await res.text());
      renderTime = document.querySelector("p")!.textContent!;

      expect(res.status).toEqual(200);
      expect(renderTime).toMatch(/Rendered on:/);
    }

    // Adding token cookie should bypass cache
    {
      const res = await fetch(`${origin}/isr`, {
        headers: {
          "Set-Cookie": "__prerender_bypass=BYPASS",
        },
      });
      const document = toDom(await res.text());
      const newTime = document.querySelector("p")!.textContent;

      expect(newTime).not.toEqual(renderTime);
    }
  });
});

Deno.test("Adapter - ISR only specific search params", async () => {
  await withServer(async (origin) => {
    let renderTime = "";
    {
      const res = await fetch(`${origin}/isr?foo=1`);
      const document = toDom(await res.text());
      renderTime = document.querySelector("p")!.textContent!;

      expect(res.status).toEqual(200);
      expect(renderTime).toMatch(/Rendered on:/);
    }

    // "bar" param should be dropped
    {
      const res = await fetch(`${origin}/isr?foo=1&bar=2`);
      const document = toDom(await res.text());
      const newTime = document.querySelector("p")!.textContent;

      expect(newTime).toEqual(renderTime);
    }

    // Different foo value triggers cache
    {
      const res = await fetch(`${origin}/isr?foo=2&bar=2`);
      const document = toDom(await res.text());
      const newTime = document.querySelector("p")!.textContent;

      expect(newTime).not.toEqual(renderTime);
    }
  });
});

Deno.test("Adapter - remote functions", async () => {
  const chunksDir = path.join(
    cwd,
    ".deno-deploy",
    "server",
    "chunks",
  );
  const chunks = Array.from(Deno.readDirSync(chunksDir));

  const remoteFunctionFileName =
    chunks.find((item) => item.name.startsWith("remote-"))!.name;
  const hash = remoteFunctionFileName.split("remote-")[1].split(".js")[0];
  const remoteFunctionName = Object.keys(
    (await import(path.join(chunksDir, remoteFunctionFileName))).default,
  )[0];

  await withServer(async (origin) => {
    const res = await fetch(
      `${origin}/_app/remote/${hash}/${remoteFunctionName}`,
    );
    expect(res.status).toEqual(200);
    const data = await res.json();
    expect(data).toEqual({
      "type": "result",
      "result": '["Hello from remote function!"]',
    });
  });
});

Deno.test("Adapter - instrumentation is included when available", () => {
  const files = Array.from(Deno.readDirSync(
    path.join(cwd, ".deno-deploy", "server"),
  ));

  expect(files).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: "instrumentation.server.js",
        isFile: true,
      }),
      expect.objectContaining({
        name: "start.js",
        isFile: true,
      }),
    ]),
  );

  const instrumentationFile = Deno.readTextFileSync(path.join(
    cwd,
    ".deno-deploy",
    "server",
    "instrumentation.server.js",
  ));
  expect(instrumentationFile.length).toBeGreaterThan(0);
  expect(instrumentationFile).toContain("DENO_SVELTE_ADAPTER_INSTRUMENTATION");
});

Deno.test("Adapter - instrumentation is not included when not available", async () => {
  const instPath = path.join(cwd, "src", "instrumentation.server.ts");
  const content = Deno.readTextFileSync(instPath);
  try {
    await removeIfExists(instPath);
    await new Deno.Command("npm", {
      args: ["run", "build"],
      cwd,
    }).output();

    const files = Array.from(
      Deno.readDirSync(path.join(cwd, ".deno-deploy", "server")),
    );

    ["instrumentation.server.js", "start.js"].map((name) => {
      expect(files).not.toContainEqual(
        expect.objectContaining({ name, isFile: true }),
      );
    });
  } finally {
    Deno.writeTextFileSync(instPath, content);
  }
});

Deno.test("Adapter - instrumentation runs before app", () => {
  const content = Deno.readTextFileSync(
    path.join(cwd, ".deno-deploy", "server", "index.js"),
  );
  expect(content).toContain("./instrumentation.server.js");
  expect(content).toContain("./start.js");
  expect(content.indexOf("./instrumentation.server.js")).toBeLessThan(
    content.indexOf("./start.js"),
  );
});
