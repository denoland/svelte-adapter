import type { PageServerLoad } from "./$types";

export const load = (({ url }) => {
  return { origin: url.origin };
}) satisfies PageServerLoad;
