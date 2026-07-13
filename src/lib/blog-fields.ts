/**
 * Adapters between the Blog Post form shape and Webflow's field encoding.
 *
 * Two blog fields need reshaping (the rest — references, multi-references,
 * switches, plain text — round-trip unchanged):
 *   - `post-image` (Image): Webflow returns `{ url, alt, fileId }` but the form
 *     works with a plain hosted-URL string, and writes expect `{ url }`.
 *   - `post-published-on` (DateTime): Webflow uses ISO 8601; the datetime-local
 *     input uses `YYYY-MM-DDTHH:mm`.
 */

/** Webflow item fieldData → form values (for editing / duplicating). */
export function blogFieldsFromWebflow(
  fieldData: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...fieldData };

  const img = out['post-image'];
  if (img && typeof img === 'object' && 'url' in img) {
    out['post-image'] = (img as { url?: string }).url ?? '';
  }

  const pub = out['post-published-on'];
  if (typeof pub === 'string' && pub) {
    out['post-published-on'] = pub.slice(0, 16); // ISO → datetime-local
  }

  return out;
}

/**
 * Form values → Webflow write payload. Only reshapes keys actually present in
 * the input, so it is safe to run on a partial update diff (a field left out of
 * the diff is never touched, and thus never cleared).
 */
export function blogFieldsToWebflow(
  fields: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...fields };

  if ('post-image' in out) {
    const img = out['post-image'];
    out['post-image'] = typeof img === 'string' && img ? { url: img } : null;
  }

  if ('post-published-on' in out) {
    const pub = out['post-published-on'];
    out['post-published-on'] =
      typeof pub === 'string' && pub ? new Date(pub).toISOString() : null;
  }

  // Link field: Webflow validates the value as a URL, so send null (not '')
  // when empty to avoid a spurious validation error.
  if ('post-audio-link' in out) {
    const link = out['post-audio-link'];
    out['post-audio-link'] = typeof link === 'string' && link.trim() ? link : null;
  }

  return out;
}
