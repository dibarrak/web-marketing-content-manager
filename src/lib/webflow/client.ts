/**
 * Thin fetch wrapper around the Webflow Data API v2.
 * Centralizes auth, base URL, error normalization, and rate-limit hints.
 */

const BASE_URL = 'https://api.webflow.com/v2';

export class WebflowApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'WebflowApiError';
  }
}

interface RequestOpts {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  /** Override URL (used for S3 upload of assets). */
  rawUrl?: string;
}

export function createWebflowClient(token: string) {
  async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
    const url = new URL(opts.rawUrl ?? `${BASE_URL}${path}`);
    if (opts.query) {
      for (const [k, v] of Object.entries(opts.query)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...opts.headers,
    };

    let body: BodyInit | undefined;
    if (opts.body !== undefined) {
      if (opts.body instanceof FormData || opts.body instanceof Blob) {
        body = opts.body as BodyInit;
      } else {
        headers['Content-Type'] ??= 'application/json';
        body = JSON.stringify(opts.body);
      }
    }

    const res = await fetch(url.toString(), { method: opts.method ?? 'GET', headers, body });

    if (res.status === 429) {
      const retry = res.headers.get('Retry-After') ?? '60';
      throw new WebflowApiError(429, 'RATE_LIMIT', `Webflow rate limit hit, retry after ${retry}s`);
    }

    if (!res.ok) {
      let details: unknown;
      try {
        details = await res.json();
      } catch {
        details = await res.text().catch(() => null);
      }
      const code =
        (details as { code?: string })?.code ??
        (details as { errorCode?: string })?.errorCode ??
        'API_ERROR';
      const message =
        (details as { message?: string })?.message ?? `Webflow API error (${res.status})`;
      throw new WebflowApiError(res.status, code, message, details);
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  return { request };
}

export type WebflowClient = ReturnType<typeof createWebflowClient>;
