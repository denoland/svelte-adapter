import { query } from '$app/server';

export const remoteFunction = query(async () => {
  return 'Hello from remote function!';
});