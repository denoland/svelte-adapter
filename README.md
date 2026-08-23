# Deno SvelteKit adapter

Official [Deno](https://deno.com/) adapter for
[SvelteKit](https://svelte.dev/docs/kit/introduction).

## Usage

1. Install the adapter:

```sh
deno install -D npm:@deno/svelte-adapter
# or
npm install -D @deno/svelte-adapter
# or
pnpm install -D @deno/svelte-adapter
```

2. Update your `svelte.config.js` file to use the adapter:

```diff
- import adapter from '@sveltejs/adapter-auto';
+ import adapter from "@deno/svelte-adapter";
  import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

  /** @type {import('@sveltejs/kit').Config} */
  const config = {
    preprocess: vitePreprocess(),
    kit: {
      adapter: adapter(),
    }
  };

  export default config;
```

3. Run the build:

```sh
deno task build
# or
npm run build
# or
pnpm run build
```

4. Run the built server:

```sh
deno run -A ./.deno-deploy/server.ts
```

## Configuration

### `out`

Directory the build is written to, relative to the project root. Defaults to
`.deno-deploy`.

```js
kit: {
  adapter: adapter({ out: "build" }),
}
```

The server entrypoint moves with it, so step 4 above becomes
`deno run -A ./build/server.ts`.

Emptying follows Vite's
[`build.emptyOutDir`](https://vite.dev/config/build-options#build-emptyoutdir):
the directory is cleared before each build only when it sits inside the project
root. Point `out` somewhere else and the adapter still writes there, but never
clears it, and logs a warning at build time. Stale files from earlier builds
stay behind.

Deno Deploy detects SvelteKit from `@sveltejs/kit` in your dependencies, but the
entrypoint stays an explicit field you can edit during `deno deploy create` or
in the dashboard. Point it at `<out>/server.ts` and a custom `out` deploys fine.

`deno desktop` is stricter: it hardcodes `.deno-deploy/server.ts` for this
adapter with no override, so bundling a desktop app needs the default.

## License

MIT, see the [LICENSE](./LICENSE) file.
