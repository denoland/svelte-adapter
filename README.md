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

## License

MIT, see the [LICENSE](./LICENSE) file.
