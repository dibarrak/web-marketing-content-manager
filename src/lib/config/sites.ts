/**
 * Static mapping of CMS collection IDs to their Webflow site IDs.
 * Collections live in different sites (mixed distribution confirmed with stakeholder).
 * Update siteId values before deploying.
 */

export type CollectionKey = 'coupons' | 'couponFilterList' | 'heroBanners';

export interface CollectionConfig {
  key: CollectionKey;
  collectionId: string;
  siteId: string;
  displayName: string;
  singularName: string;
}

export const COLLECTIONS: Record<CollectionKey, CollectionConfig> = {
  coupons: {
    key: 'coupons',
    collectionId: '695bfb101cc1337da4ec00af',
    siteId: '614d688b383096276930acef',
    displayName: 'Landing promotion coupons',
    singularName: 'Landing promotion coupon',
  },
  couponFilterList: {
    key: 'couponFilterList',
    collectionId: '6961886320253700c1e5baf5',
    siteId: '614d688b383096276930acef',
    displayName: 'Coupon Filter Lists',
    singularName: 'Coupon Filter List',
  },
  heroBanners: {
    key: 'heroBanners',
    collectionId: '69865d518920fb1ddd9007f3',
    siteId: '614d688b383096276930acef',
    displayName: 'Automatized Hero Banners',
    singularName: 'Automatized Hero Banner',
  },
};

export function findCollectionById(collectionId: string): CollectionConfig | undefined {
  return Object.values(COLLECTIONS).find((c) => c.collectionId === collectionId);
}

/** Every Webflow site id referenced by a known collection. */
export const KNOWN_SITE_IDS: ReadonlySet<string> = new Set(
  Object.values(COLLECTIONS).map((c) => c.siteId),
);

export function isKnownSiteId(siteId: string): boolean {
  return KNOWN_SITE_IDS.has(siteId);
}

/**
 * Default site for uploads that aren't tied to a specific collection (e.g.
 * merchant logos). All collections currently live on the same site.
 */
export const DEFAULT_SITE_ID = COLLECTIONS.coupons.siteId;
