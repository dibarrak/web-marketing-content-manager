/**
 * "Hero Banners (Pestaña inicio)" CSV module — feeds hero banner elements in
 * the mobile app's home tab. Same upload → edit → download flow as the other
 * CSV modules; the CSV lives in S3 and we don't have write access to it
 * directly.
 *
 * Not to be confused with the unrelated Webflow "Hero Banners" CMS collection
 * (`COLLECTIONS.heroBanners` in `config/sites.ts`) or the Offerwall CSV
 * module (`csv-modules/offerwallBanners.ts`) — both are separate features
 * that happen to share similar naming. Hence "HomeHeroBanner" here.
 *
 * Unlike the other two CSV modules, dates here are plain calendar dates
 * (`YYYY-MM-DD`, no time component) — there's no timezone to resolve, so
 * these map 1:1 to/from an HTML `date` input with no conversion needed.
 */
import { z } from 'zod';

/** Column order for the CSV file — also the required header set. */
export const HOME_HERO_BANNER_CSV_HEADERS = [
  'campaign_id',
  'title',
  'subtitle',
  'caption',
  'discount_amount',
  'discount_percentage',
  'cashback_amount',
  'cashback_percentage',
  'coupon',
  'coupon_caption',
  'background_url',
  'logo_url',
  'click_url',
  'cta',
  'merchant_id',
  'user_segment',
  'start_date',
  'end_date',
  'template_id',
] as const;

/** Closed set — confirmed with stakeholder. Distinct from the Ad Banners /
 * Offerwall segment vocabulary (anonymous/first_time/lead/recurrent). */
export const HOME_HERO_USER_SEGMENTS = ['VISITOR_NEW', 'CROSS_SELL_USER', 'BNPL_RECURRENT_USER'] as const;
export type HomeHeroUserSegment = (typeof HOME_HERO_USER_SEGMENTS)[number];

export const HOME_HERO_SEGMENT_LABELS: Record<HomeHeroUserSegment, string> = {
  VISITOR_NEW: 'Visitante nuevo',
  CROSS_SELL_USER: 'Cross-sell',
  BNPL_RECURRENT_USER: 'BNPL recurrente',
};

/** Values seen so far — shown as a hint only; free text, not a strict enum. */
export const KNOWN_TEMPLATE_IDS = ['template_4', 'template_6', 'template_7'] as const;

function isValidUrl(v: string): boolean {
  try {
    new URL(v);
    return true;
  } catch {
    return false;
  }
}

const optionalNumberString = z
  .string()
  .trim()
  .refine((v) => v === '' || /^\d+(\.\d+)?$/.test(v), 'Debe ser un número o vacío');

/** campaign_id is NOT a uniqueness constraint — duplicates are common in practice. */
export const homeHeroBannerSchema = z
  .object({
    campaign_id: z.string().trim().min(1, 'Requerido'),
    title: z.string().trim().min(1, 'Requerido'),
    subtitle: z.string().trim().min(1, 'Requerido'),
    caption: z.string().trim(),
    // Four independent optional display fields — no relationship enforced
    // between them (confirmed with stakeholder).
    discount_amount: optionalNumberString,
    discount_percentage: optionalNumberString,
    cashback_amount: optionalNumberString,
    cashback_percentage: optionalNumberString,
    coupon: z.string().trim(),
    coupon_caption: z.string().trim(),
    background_url: z.string().trim().url('URL inválida'),
    logo_url: z.string().trim().refine((v) => v === '' || isValidUrl(v), 'URL inválida'),
    // Sometimes a normal https URL, sometimes a custom app deep link
    // (e.g. kueskios://cash_zero_rate) — any scheme is valid; may be blank
    // for a purely informational banner with no click action.
    click_url: z.string().trim().refine((v) => v === '' || isValidUrl(v), 'URL inválida'),
    cta: z.string().trim(),
    merchant_id: z.string().trim(),
    user_segment: z
      .array(z.enum(HOME_HERO_USER_SEGMENTS))
      .min(1, 'Selecciona al menos un segmento'),
    start_date: z.string().min(1, 'Requerido'),
    end_date: z.string().min(1, 'Requerido'),
    template_id: z.string().trim().min(1, 'Requerido'),
  })
  .refine((data) => new Date(data.end_date) >= new Date(data.start_date), {
    message: 'No puede ser anterior a la fecha de inicio',
    path: ['end_date'],
  });

export type HomeHeroBannerFields = z.infer<typeof homeHeroBannerSchema>;

/** Raw CSV row (all strings) → typed row for the form/edit UI. */
export function csvRowToHomeHeroBanner(raw: Record<string, string>): HomeHeroBannerFields {
  return {
    campaign_id: raw.campaign_id ?? '',
    title: raw.title ?? '',
    subtitle: raw.subtitle ?? '',
    caption: raw.caption ?? '',
    discount_amount: raw.discount_amount ?? '',
    discount_percentage: raw.discount_percentage ?? '',
    cashback_amount: raw.cashback_amount ?? '',
    cashback_percentage: raw.cashback_percentage ?? '',
    coupon: raw.coupon ?? '',
    coupon_caption: raw.coupon_caption ?? '',
    background_url: raw.background_url ?? '',
    logo_url: raw.logo_url ?? '',
    click_url: raw.click_url ?? '',
    cta: raw.cta ?? '',
    merchant_id: raw.merchant_id ?? '',
    user_segment: (raw.user_segment ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s): s is HomeHeroUserSegment =>
        (HOME_HERO_USER_SEGMENTS as readonly string[]).includes(s),
      ),
    start_date: (raw.start_date ?? '').trim(),
    end_date: (raw.end_date ?? '').trim(),
    template_id: raw.template_id ?? '',
  };
}

/** Typed row → raw CSV row (all strings), ready for unparseCsv. */
export function homeHeroBannerToCsvRow(item: HomeHeroBannerFields): Record<string, string> {
  return {
    campaign_id: item.campaign_id,
    title: item.title,
    subtitle: item.subtitle,
    caption: item.caption,
    discount_amount: item.discount_amount,
    discount_percentage: item.discount_percentage,
    cashback_amount: item.cashback_amount,
    cashback_percentage: item.cashback_percentage,
    coupon: item.coupon,
    coupon_caption: item.coupon_caption,
    background_url: item.background_url,
    logo_url: item.logo_url,
    click_url: item.click_url,
    cta: item.cta,
    merchant_id: item.merchant_id,
    user_segment: item.user_segment.join(','),
    start_date: item.start_date,
    end_date: item.end_date,
    template_id: item.template_id,
  };
}

/** Whether `now` (a plain calendar date) falls within the banner's vigencia window. */
export function isHomeHeroBannerActive(item: HomeHeroBannerFields, now: Date = new Date()): boolean {
  const today = now.toISOString().slice(0, 10);
  return item.start_date <= today && today <= item.end_date;
}
