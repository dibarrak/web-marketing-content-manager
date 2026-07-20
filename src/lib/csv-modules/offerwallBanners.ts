/**
 * "Offerwall (Pestaña Explorar)" CSV module — feeds hero/offerwall banner
 * elements in the mobile app's Explorar tab. Same upload → edit → download
 * flow as Ad Banners (see adBanners.ts); the CSV lives in S3 and we don't
 * have write access to it directly.
 *
 * Not to be confused with the unrelated Webflow "Hero Banners" CMS collection
 * (`COLLECTIONS.heroBanners` in `config/sites.ts`) — hence "Offerwall" here
 * instead of "HeroBanner", even though the source file is `hero_banners.csv`.
 */
import { z } from 'zod';
import { isoToMxDatetimeLocal, mxDatetimeLocalToIso } from '@lib/datetime';
import { SEGMENT_LABELS, USER_SEGMENTS, type UserSegment } from './adBanners';

export { SEGMENT_LABELS, USER_SEGMENTS };
export type { UserSegment };

/** Column order for the CSV file — also the required header set. */
export const OFFERWALL_BANNER_CSV_HEADERS = [
  'banner_id',
  'merchant_ids',
  'background_image',
  'title',
  'description',
  'cta_text',
  'action',
  'url',
  'external_browser',
  'screen_path',
  'filter',
  'start_date',
  'end_date',
  'user_segment',
] as const;

/** Closed set — confirmed with stakeholder, not expected to grow. */
export const OFFERWALL_ACTIONS = ['redirect-to-screen', 'redirect-to-url', 'simulate-click'] as const;
export type OfferwallAction = (typeof OFFERWALL_ACTIONS)[number];

export const OFFERWALL_ACTION_LABELS: Record<OfferwallAction, string> = {
  'redirect-to-screen': 'Redirigir a pantalla',
  'redirect-to-url': 'Redirigir a URL externa',
  'simulate-click': 'Simular click (sin navegación)',
};

/**
 * Known `filter` tags so far — confirmed as a catalog, but the stakeholder
 * suspects it's incomplete/undocumented, so (like merchant_id) a value not
 * in this list is still accepted as free text.
 */
export const OFFERWALL_FILTER_CATALOG = ['welcome_cashback'] as const;

export const MAX_OFFERWALL_MERCHANTS = 3;

/** banner_id is NOT a uniqueness constraint — duplicates are common in practice. */
export const offerwallBannerSchema = z
  .object({
    banner_id: z.string().trim().min(1, 'Requerido'),
    merchant_ids: z
      .array(z.string().trim().min(1))
      .min(1, 'Selecciona al menos un merchant')
      .max(MAX_OFFERWALL_MERCHANTS, `Máximo ${MAX_OFFERWALL_MERCHANTS} merchants`),
    background_image: z.string().trim().url('URL inválida'),
    title: z.string().trim().min(1, 'Requerido'),
    description: z.string().trim().min(1, 'Requerido'),
    cta_text: z.string().trim().min(1, 'Requerido'),
    action: z.enum(OFFERWALL_ACTIONS),
    // Conditionally required depending on `action` — validated in superRefine below.
    url: z.string().trim(),
    external_browser: z.boolean(),
    screen_path: z.string().trim(),
    // Closed catalog + free text, like merchant_id — not a strict enum.
    filter: z.array(z.string().trim().min(1)),
    start_date: z.string().min(1, 'Requerido'),
    end_date: z.string().min(1, 'Requerido'),
    user_segment: z.array(z.enum(USER_SEGMENTS)).min(1, 'Selecciona al menos un segmento'),
  })
  .superRefine((data, ctx) => {
    if (new Date(data.end_date) < new Date(data.start_date)) {
      ctx.addIssue({
        code: 'custom',
        message: 'No puede ser anterior a la fecha de inicio',
        path: ['end_date'],
      });
    }
    if (data.action === 'redirect-to-url') {
      if (!data.url) {
        ctx.addIssue({
          code: 'custom',
          message: 'Requerido cuando la acción es "Redirigir a URL externa"',
          path: ['url'],
        });
      } else if (!/^https?:\/\//.test(data.url)) {
        ctx.addIssue({ code: 'custom', message: 'URL inválida', path: ['url'] });
      }
    }
    if (data.action === 'redirect-to-screen' && !data.screen_path) {
      ctx.addIssue({
        code: 'custom',
        message: 'Requerido cuando la acción es "Redirigir a pantalla"',
        path: ['screen_path'],
      });
    }
  });

export type OfferwallBannerFields = z.infer<typeof offerwallBannerSchema>;

function splitList(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Raw CSV row (all strings) → typed row for the form/edit UI. */
export function csvRowToOfferwallBanner(raw: Record<string, string>): OfferwallBannerFields {
  return {
    banner_id: raw.banner_id ?? '',
    merchant_ids: splitList(raw.merchant_ids ?? ''),
    background_image: raw.background_image ?? '',
    title: raw.title ?? '',
    description: raw.description ?? '',
    cta_text: raw.cta_text ?? '',
    action: (raw.action ?? '') as OfferwallAction,
    url: raw.url ?? '',
    external_browser: (raw.external_browser ?? '').trim().toUpperCase() === 'TRUE',
    screen_path: raw.screen_path ?? '',
    filter: splitList(raw.filter ?? ''),
    start_date: isoToMxDatetimeLocal(raw.start_date ?? ''),
    end_date: isoToMxDatetimeLocal(raw.end_date ?? ''),
    user_segment: splitList(raw.user_segment ?? '').filter((s): s is UserSegment =>
      (USER_SEGMENTS as readonly string[]).includes(s),
    ),
  };
}

/** Typed row → raw CSV row (all strings), ready for unparseCsv.
 *
 * `url`/`external_browser` and `screen_path` only apply to their matching
 * `action` — forced blank otherwise so a stale value left over from a
 * previous action (e.g. after editing or duplicating a row) never leaks into
 * the exported file, even if the in-memory form state still holds it. */
export function offerwallBannerToCsvRow(item: OfferwallBannerFields): Record<string, string> {
  const isRedirectToUrl = item.action === 'redirect-to-url';
  return {
    banner_id: item.banner_id,
    merchant_ids: item.merchant_ids.join(','),
    background_image: item.background_image,
    title: item.title,
    description: item.description,
    cta_text: item.cta_text,
    action: item.action,
    url: isRedirectToUrl ? item.url : '',
    external_browser: isRedirectToUrl && item.external_browser ? 'TRUE' : '',
    screen_path: item.action === 'redirect-to-screen' ? item.screen_path : '',
    filter: item.filter.join(','),
    start_date: mxDatetimeLocalToIso(item.start_date),
    end_date: mxDatetimeLocalToIso(item.end_date),
    user_segment: item.user_segment.join(','),
  };
}

/** Whether `now` falls within the banner's vigencia window. */
export function isOfferwallBannerActive(item: OfferwallBannerFields, now: Date = new Date()): boolean {
  return new Date(item.start_date) <= now && now <= new Date(item.end_date);
}
