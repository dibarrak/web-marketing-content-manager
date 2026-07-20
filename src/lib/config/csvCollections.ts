/**
 * Config registry for CSV-backed content modules — distinct from the Webflow
 * CMS collections in `sites.ts`. These don't call any external API: the user
 * uploads a CSV (normally hosted in an S3 bucket we don't have write access
 * to), edits the parsed rows locally, and downloads the regenerated CSV to
 * upload back to S3 by hand. See CsvCollectionPage for the shared engine.
 */

export type CsvCollectionKey = 'adBanners' | 'offerwallBanners' | 'homeHeroBanners';

export interface CsvCollectionConfig {
  key: CsvCollectionKey;
  displayName: string;
  singularName: string;
  /**
   * Filename always used on download, regardless of what the uploaded file
   * was named — the consuming S3/app logic expects this exact name.
   * Offerwall and Home Hero Banners intentionally share the same filename
   * (confirmed with stakeholder: both feed the same downstream path).
   */
  downloadFileName: string;
}

export const CSV_COLLECTIONS: Record<CsvCollectionKey, CsvCollectionConfig> = {
  adBanners: {
    key: 'adBanners',
    displayName: 'Ad Banners',
    singularName: 'Ad Banner',
    downloadFileName: 'ads.csv',
  },
  offerwallBanners: {
    key: 'offerwallBanners',
    displayName: 'Offerwall (Pestaña Explorar)',
    singularName: 'Offerwall Banner',
    downloadFileName: 'hero_banners.csv',
  },
  homeHeroBanners: {
    key: 'homeHeroBanners',
    displayName: 'Hero Banners (Pestaña inicio)',
    singularName: 'Hero Banner (Inicio)',
    downloadFileName: 'hero_banners.csv',
  },
};

export function findCsvCollectionByKey(key: string): CsvCollectionConfig | undefined {
  return (CSV_COLLECTIONS as Record<string, CsvCollectionConfig>)[key];
}
