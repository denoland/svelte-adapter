<script lang="ts">
  import type { PageData } from "./$types";
  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Origin check</title>
</svelte:head>

<div class="text-column">
  <h1>Origin check</h1>
  <p data-origin>{data.origin}</p>
</div>
