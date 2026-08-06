/**
 * Whether a CMS item is live in Webflow, as opposed to still a draft.
 *
 * This is one of THREE distinct "is it visible?" notions in this app, which are
 * deliberately not conflated:
 *
 *  1. Publish state (here) — the item itself is live in the Webflow CMS.
 *  2. Date-range status (`@lib/collection-status`) — a content field says the
 *     item should display during a given window.
 *  3. Site publish status (`SitePublishStatus`) — whether the site has been
 *     republished since the item changed, i.e. whether a visitor sees it yet.
 *
 * Webflow only returns `isDraft`/`lastPublished` from the staged items endpoint,
 * which is the one the API wrapper uses, so both fields are always present.
 */

export type PublishState = 'published' | 'draft';

export const PUBLISH_STATE_LABELS: Record<PublishState, string> = {
  published: 'Publicado',
  draft: 'Borrador',
};

export function getPublishState(item: {
  isDraft?: boolean;
  lastPublished?: string | null;
}): PublishState {
  return !item.isDraft && !!item.lastPublished ? 'published' : 'draft';
}
