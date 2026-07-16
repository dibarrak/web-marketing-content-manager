/**
 * Config registry for CSV-backed content modules — distinct from the Webflow
 * CMS collections in `sites.ts`. These don't call any external API: the user
 * uploads a CSV (normally hosted in an S3 bucket we don't have write access
 * to), edits the parsed rows locally, and downloads the regenerated CSV to
 * upload back to S3 by hand. See CsvCollectionPage for the shared engine.
 */

export type CsvCollectionKey = 'adBanners';

export interface CsvCollectionConfig {
  key: CsvCollectionKey;
  displayName: string;
  singularName: string;
}

export const CSV_COLLECTIONS: Record<CsvCollectionKey, CsvCollectionConfig> = {
  adBanners: {
    key: 'adBanners',
    displayName: 'Ad Banners',
    singularName: 'Ad Banner',
  },
};

export function findCsvCollectionByKey(key: string): CsvCollectionConfig | undefined {
  return (CSV_COLLECTIONS as Record<string, CsvCollectionConfig>)[key];
}
