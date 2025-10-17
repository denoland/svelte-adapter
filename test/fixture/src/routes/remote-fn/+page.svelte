<script lang="ts">
  import { onMount } from 'svelte';
  import { remoteFunction } from './data.remote';

  let query = $state<ReturnType<typeof remoteFunction>>();
  onMount(() => {
    query = remoteFunction();
  })

</script>

<h1>Remote functions example</h1>
{#if query?.error}
	<p>oops!</p>
{:else if !query || query.loading}
	<p>loading...</p>
{:else}
  <p>{query.current}</p>
{/if}
