// BASE_URL is '/' locally and '/web-marketing-content-manager' (no trailing
// slash) on Webflow Cloud. Normalize so callers always get exactly one slash.
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Prefix an app-relative path with the deployment base path. */
export function withBase(path: string): string {
  return `${BASE}/${path.replace(/^\//, '')}`;
}

export { BASE };
