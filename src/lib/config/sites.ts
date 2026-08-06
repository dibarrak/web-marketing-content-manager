/**
 * Static mapping of CMS collection IDs to their Webflow site IDs.
 * Collections live in different sites (mixed distribution confirmed with stakeholder).
 * Update siteId values before deploying.
 */

export type CollectionKey =
  | 'coupons'
  | 'couponFilterList'
  | 'heroBanners'
  | 'blogPosts'
  | 'featuredMerchants';

/**
 * Which Webflow workspace a collection lives in. Each workspace has its own API
 * token (see `getWebflow`): 'default' → WEBFLOW_TOKEN, 'cash' → WEBFLOW_TOKEN_CASH.
 */
export type Workspace = 'default' | 'cash';

export interface CollectionConfig {
  key: CollectionKey;
  collectionId: string;
  siteId: string;
  displayName: string;
  singularName: string;
  /** Workspace that owns this collection. Defaults to 'default' when omitted. */
  workspace: Workspace;
}

export const COLLECTIONS: Record<CollectionKey, CollectionConfig> = {
  coupons: {
    key: 'coupons',
    collectionId: '695bfb101cc1337da4ec00af',
    siteId: '614d688b383096276930acef',
    displayName: 'Landing promotion coupons',
    singularName: 'Landing promotion coupon',
    workspace: 'default',
  },
  couponFilterList: {
    key: 'couponFilterList',
    collectionId: '6961886320253700c1e5baf5',
    siteId: '614d688b383096276930acef',
    displayName: 'Coupon Filter Lists',
    singularName: 'Coupon Filter List',
    workspace: 'default',
  },
  heroBanners: {
    key: 'heroBanners',
    collectionId: '69865d518920fb1ddd9007f3',
    siteId: '614d688b383096276930acef',
    displayName: 'Automatized Hero Banners',
    singularName: 'Automatized Hero Banner',
    workspace: 'default',
  },
  blogPosts: {
    key: 'blogPosts',
    collectionId: '680047a242ec07b1b8f10f55',
    siteId: '642533e2943fc871d1dc670d',
    displayName: 'Blog | Posts',
    singularName: 'Blog | Post',
    workspace: 'cash',
  },
  featuredMerchants: {
    key: 'featuredMerchants',
    collectionId: '65f10880b89cfcd9e583e7e0',
    siteId: '614d688b383096276930acef',
    // Webflow's own singularName is "Comercios destacados por categorium" (a
    // broken auto-pluralization). Using a readable one for the UI labels.
    displayName: 'Comercios destacados por categoría',
    singularName: 'Comercio destacado',
    workspace: 'default',
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

/**
 * "Benefit x merchants (Landing)" collection. Managed through the Google Sheets
 * sync flow (preview → apply), NOT the standard per-item CRUD, so it is kept
 * out of COLLECTIONS to avoid the form/filter/option-map machinery. Access is
 * gated to admin+ like publishing and the audit log.
 */
export const BENEFITS_COLLECTION = {
  collectionId: '6903cb0fce2f16ce3863227c',
  siteId: '614d688b383096276930acef',
  displayName: 'Benefit x merchants (Landing)',
} as const;

/** Workspace that owns a collection, resolved by collection id. */
export function workspaceForCollection(collectionId: string): Workspace {
  return findCollectionById(collectionId)?.workspace ?? 'default';
}

/** Workspace that owns a Webflow site, resolved by site id. */
export function workspaceForSite(siteId: string): Workspace {
  return Object.values(COLLECTIONS).find((c) => c.siteId === siteId)?.workspace ?? 'default';
}

/* ------------------------------------------------------------------ *
 * Reference fields — the collections that Reference/MultiReference form
 * fields list to populate their pickers.
 *
 * Registering a referenced collection here is what allows the
 * `/api/collections/:id/reference-items` endpoint to list it: the route is an
 * allowlist, not a generic proxy. The owning collection determines both the
 * access check and which workspace token is used.
 * ------------------------------------------------------------------ */

/** A collection referenced by a field of a managed collection. */
export interface CollectionReference {
  /** The owning collection's field slug that points here. */
  fieldSlug: string;
  /** The referenced collection id (same workspace as the owner). */
  collectionId: string;
  /** Label shown above the picker. */
  label: string;
  /** MultiReference (array of ids) vs single Reference. */
  multiple: boolean;
}

/**
 * Blog | Posts links to six sibling collections, all in the "Cash" workspace
 * and reachable with WEBFLOW_TOKEN_CASH. Schemas captured during onboarding.
 */
export const BLOG_REFERENCES: CollectionReference[] = [
  { fieldSlug: 'post-category', collectionId: '68003ff43f483a200f911121', label: 'Categoría', multiple: false },
  { fieldSlug: 'post-subcategory', collectionId: '68003ff43f483a200f911121', label: 'Subcategoría', multiple: false },
  { fieldSlug: 'post-author-reviewer', collectionId: '68003b8f2c21c30e23bb24e0', label: 'Autor y revisor', multiple: false },
  { fieldSlug: 'post-disclaimer', collectionId: '68003eff3a82336c2b256426', label: 'Disclaimer', multiple: true },
  { fieldSlug: 'post-breadcrumbs', collectionId: '6800423159334f1ae9812ce4', label: 'Breadcrumbs', multiple: true },
  { fieldSlug: 'post-featured-reviews', collectionId: '680041fa26bc9f7147d0bac8', label: 'Featured reviews', multiple: true },
  { fieldSlug: 'post-cta', collectionId: '68003f9342ec07b1b8eb5538', label: 'CTA', multiple: true },
];

/**
 * "Comercios destacados por categoría" links to the Merchants and Merchant
 * Categories collections — both in the same site/workspace as the owner.
 */
export const FEATURED_MERCHANT_REFERENCES: CollectionReference[] = [
  {
    fieldSlug: 'nombre-del-comercio',
    collectionId: '65f10880b89cfcd9e583e557',
    label: 'Nombre del comercio',
    multiple: false,
  },
  {
    fieldSlug: 'categoria',
    collectionId: '65f10880b89cfcd9e583e5da',
    label: 'Categoría',
    multiple: false,
  },
];

/** Reference fields per managed collection. */
export const COLLECTION_REFERENCES: Partial<Record<CollectionKey, CollectionReference[]>> = {
  blogPosts: BLOG_REFERENCES,
  featuredMerchants: FEATURED_MERCHANT_REFERENCES,
};

/**
 * Referenced collection id → the managed collections that reference it. Listing
 * a referenced collection is allowed when the user can access at least one
 * owner; the Webflow token comes from the first owner (a referenced collection
 * always lives in its owners' workspace).
 */
export const REFERENCE_OWNERS: ReadonlyMap<string, CollectionKey[]> = (() => {
  const owners = new Map<string, CollectionKey[]>();
  for (const [key, refs] of Object.entries(COLLECTION_REFERENCES) as [
    CollectionKey,
    CollectionReference[],
  ][]) {
    for (const ref of refs) {
      const list = owners.get(ref.collectionId) ?? [];
      if (!list.includes(key)) list.push(key);
      owners.set(ref.collectionId, list);
    }
  }
  return owners;
})();

/**
 * Referenced collection id for one of a collection's reference fields. Throws
 * on an unregistered slug — a missing entry is a wiring bug, not a runtime
 * condition to handle.
 */
export function referenceCollectionId(
  collectionKey: CollectionKey,
  fieldSlug: string,
): string {
  const ref = COLLECTION_REFERENCES[collectionKey]?.find((r) => r.fieldSlug === fieldSlug);
  if (!ref) {
    throw new Error(`No reference registered for ${collectionKey}.${fieldSlug}`);
  }
  return ref.collectionId;
}

/**
 * Default field values applied when creating a new Blog Post. Reference
 * defaults are stored as the referenced item id (resolved during onboarding).
 */
export const BLOG_POST_DEFAULTS = {
  /** Disclaimer item "Default". */
  'post-disclaimer': ['68003f144ec3177b50a6ace1'],
  /** Author item "Staff Kueski". */
  'post-author-reviewer': '68003be9e93343e34535030e',
  'post-featured': false,
  'post-featured-category': false,
  'post-highlighted-blog-index-2': false,
  /** Option "Date Visibility" → the single available option "Only Published On". */
  'post-date-visbility': '6079a0b139525f652f925e6577877002',
} as const;
