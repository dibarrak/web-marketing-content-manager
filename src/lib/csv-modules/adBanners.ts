/**
 * "Ad Banners" CSV module — feeds ad banner elements in the mobile app.
 * The CSV lives in an S3 bucket we can't write to directly: the user uploads
 * it here, edits the parsed rows, and downloads the regenerated file to
 * re-upload by hand.
 */
import { z } from 'zod';
import { isoToMxDatetimeLocal, mxDatetimeLocalToIso } from '@lib/datetime';

/** Column order for the CSV file — also the required header set. */
export const AD_BANNER_CSV_HEADERS = [
  'id',
  'click_url',
  'image_url',
  'merchant_id',
  'start_date',
  'end_date',
  'user_segment',
] as const;

/** Closed set — confirmed with stakeholder, not expected to grow. */
export const USER_SEGMENTS = ['anonymous', 'first_time', 'lead', 'recurrent'] as const;
export type UserSegment = (typeof USER_SEGMENTS)[number];

export const SEGMENT_LABELS: Record<UserSegment, string> = {
  anonymous: 'Anónimo',
  first_time: 'Primera vez',
  lead: 'Lead',
  recurrent: 'Recurrente',
};

/**
 * `id` is NOT a uniqueness constraint in this dataset — duplicate ids across
 * rows are valid/expected (e.g. the same campaign split across two date
 * windows). The form still suggests the next free integer as a default when
 * creating a new row, but never enforces or blocks a duplicate.
 */
export const adBannerSchema = z
  .object({
    id: z.number().int(),
    click_url: z.string().trim().url('URL inválida'),
    image_url: z.string().trim().url('URL inválida'),
    // Merchant directory only covers some merchants — free text is allowed
    // when there's no catalog match, so this is intentionally not an enum.
    merchant_id: z.string().trim().min(1, 'Requerido'),
    // `datetime-local` form value; converted to/from ISO at the CSV boundary.
    start_date: z.string().min(1, 'Requerido'),
    end_date: z.string().min(1, 'Requerido'),
    user_segment: z.array(z.enum(USER_SEGMENTS)).min(1, 'Selecciona al menos un segmento'),
  })
  .refine((data) => new Date(data.end_date) >= new Date(data.start_date), {
    message: 'No puede ser anterior a la fecha de inicio',
    path: ['end_date'],
  });

export type AdBannerFields = z.infer<typeof adBannerSchema>;

/** Raw CSV row (all strings) → typed row for the form/edit UI. */
export function csvRowToAdBanner(raw: Record<string, string>): AdBannerFields {
  return {
    id: Number(raw.id),
    click_url: raw.click_url ?? '',
    image_url: raw.image_url ?? '',
    merchant_id: raw.merchant_id ?? '',
    start_date: isoToMxDatetimeLocal(raw.start_date ?? ''),
    end_date: isoToMxDatetimeLocal(raw.end_date ?? ''),
    user_segment: (raw.user_segment ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s): s is UserSegment => (USER_SEGMENTS as readonly string[]).includes(s)),
  };
}

/** Typed row → raw CSV row (all strings), ready for unparseCsv. */
export function adBannerToCsvRow(item: AdBannerFields): Record<string, string> {
  return {
    id: String(item.id),
    click_url: item.click_url,
    image_url: item.image_url,
    merchant_id: item.merchant_id,
    start_date: mxDatetimeLocalToIso(item.start_date),
    end_date: mxDatetimeLocalToIso(item.end_date),
    user_segment: item.user_segment.join(','),
  };
}

/** Next free id to suggest when creating a new row (never enforced). */
export function nextAdBannerId(rows: AdBannerFields[]): number {
  if (rows.length === 0) return 1;
  return Math.max(...rows.map((r) => r.id)) + 1;
}

/** Whether `now` falls within the banner's vigencia window. */
export function isAdBannerActive(item: AdBannerFields, now: Date = new Date()): boolean {
  return new Date(item.start_date) <= now && now <= new Date(item.end_date);
}
