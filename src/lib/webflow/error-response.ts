import { WebflowApiError } from './client';

/**
 * Normalizes Webflow API errors into JSON responses we can surface to the UI.
 * Details from v2 look like:
 *   { code, message, details: [{ param, message, ... }] }
 */
export function webflowErrorResponse(err: unknown): Response {
  if (err instanceof WebflowApiError) {
    console.error('[Webflow]', err.status, err.code, err.message, err.details);
    return Response.json(
      {
        error: err.message,
        code: err.code,
        details: err.details ?? null,
      },
      { status: err.status },
    );
  }
  console.error('[Webflow] non-API error', err);
  return Response.json(
    { error: err instanceof Error ? err.message : 'Unexpected error' },
    { status: 500 },
  );
}
