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

/**
 * Closed set of layouts accepted by home-bff — confirmed against
 * `hero_banners_schema.json` (the CSV consumer's source of truth). Each
 * template exposes a "no CTA" and a "CTA" variant, each with its own exact
 * set of content fields — see `TEMPLATES` below.
 */
export const TEMPLATE_IDS = [
  'template_1',
  'template_2',
  'template_3',
  'template_4',
  'template_5',
  'template_6',
  'template_7',
] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export const TEMPLATE_LABELS: Record<TemplateId, string> = {
  template_1: 'Template 1 — Título + caption + logo',
  template_2: 'Template 2 — Logo + descuento/cashback',
  template_3: 'Template 3 — Título + descuento/cashback',
  template_4: 'Template 4 — Título + subtítulo + caption + logo',
  template_5: 'Template 5 — Título + subtítulo + logo',
  template_6: 'Template 6 — Título + subtítulo (simple)',
  template_7: 'Template 7 — Título + subtítulo + cupón + descuento %',
};

/** Every content field the CSV schema knows about — anything outside this
 * list (campaign_id, dates, segments, etc.) is a "global" field, always
 * shown regardless of template. */
export const CONTENT_FIELDS_CATALOG = [
  'title',
  'subtitle',
  'caption',
  'discount_amount',
  'discount_percentage',
  'cashback_amount',
  'cashback_percentage',
  'coupon',
  'coupon_caption',
  'logo_url',
  'cta',
  'click_url',
] as const;
export type ContentField = (typeof CONTENT_FIELDS_CATALOG)[number];

interface TemplateVariant {
  fields: readonly ContentField[];
  /** Present in `fields` but allowed to be left blank — currently only
   * template_6's `subtitle` (no-CTA variant). */
  optionalFields?: readonly ContentField[];
}

/** Source of truth: `hero_banners_schema.json` → `templates`. Field lists
 * must stay in sync with that file — it's what home-bff actually parses. */
export const TEMPLATES: Record<TemplateId, { no_cta: TemplateVariant; cta: TemplateVariant }> = {
  template_1: {
    no_cta: { fields: ['title', 'caption', 'logo_url'] },
    cta: { fields: ['title', 'caption', 'cta', 'click_url'] },
  },
  template_2: {
    no_cta: { fields: ['logo_url', 'title', 'discount_amount', 'cashback_percentage'] },
    cta: { fields: ['logo_url', 'discount_amount', 'cashback_percentage', 'cta', 'click_url'] },
  },
  template_3: {
    no_cta: { fields: ['logo_url', 'title', 'discount_amount', 'cashback_percentage'] },
    cta: { fields: ['title', 'discount_amount', 'cashback_percentage', 'cta', 'click_url'] },
  },
  template_4: {
    no_cta: { fields: ['logo_url', 'title', 'subtitle', 'caption'] },
    cta: { fields: ['cta', 'click_url', 'title', 'subtitle', 'caption', 'logo_url'] },
  },
  template_5: {
    no_cta: { fields: ['logo_url', 'title', 'subtitle'] },
    cta: { fields: ['cta', 'click_url', 'title', 'subtitle', 'logo_url'] },
  },
  template_6: {
    no_cta: { fields: ['title', 'subtitle'], optionalFields: ['subtitle'] },
    cta: { fields: ['title', 'subtitle', 'cta', 'click_url'] },
  },
  template_7: {
    no_cta: { fields: ['title', 'subtitle', 'discount_percentage', 'coupon', 'coupon_caption', 'caption'] },
    cta: {
      fields: ['title', 'subtitle', 'discount_percentage', 'coupon', 'coupon_caption', 'caption', 'cta', 'click_url'],
    },
  },
};

/** Which variant of `templateId` (if any) is an exact match for the content
 * fields the user has actually filled in — used both to validate the
 * current selection and to suggest a better one. `null` = no exact match. */
export function templateVariantFor(templateId: TemplateId, hasCta: boolean): TemplateVariant {
  return hasCta ? TEMPLATES[templateId].cta : TEMPLATES[templateId].no_cta;
}

/** Scans every template+variant for one whose required-field set exactly
 * matches the currently filled-in content fields — used to power the
 * "¿quisiste decir template X?" suggestion. Returns null if none match
 * (including when the current template already matches, or when the filled
 * set doesn't correspond to any template). */
export function suggestTemplate(
  filledFields: ReadonlySet<ContentField>,
  hasCta: boolean,
): TemplateId | null {
  for (const id of TEMPLATE_IDS) {
    const variant = templateVariantFor(id, hasCta);
    const required = new Set(variant.fields.filter((f) => !variant.optionalFields?.includes(f)));
    if (required.size === filledFields.size && [...required].every((f) => filledFields.has(f))) {
      return id;
    }
  }
  return null;
}

function isValidUrl(v: string): boolean {
  try {
    new URL(v);
    return true;
  } catch {
    return false;
  }
}

/** http(s) URL or an app deep link (e.g. kueskios://cash_zero_rate). */
function isValidClickUrl(v: string): boolean {
  return /^https?:\/\//.test(v) || /^[a-z][a-z0-9+.-]*:\/\//i.test(v);
}

const optionalNumberString = z
  .string()
  .trim()
  .refine((v) => v === '' || /^\d+(\.\d+)?$/.test(v), 'Debe ser un número o vacío');

/** campaign_id is NOT a uniqueness constraint — duplicates are common in practice. */
export const homeHeroBannerSchema = z
  .object({
    campaign_id: z.string().trim().min(1, 'Requerido'),
    title: z.string().trim(),
    subtitle: z.string().trim(),
    caption: z.string().trim(),
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
    click_url: z.string().trim().refine((v) => v === '' || isValidClickUrl(v), 'URL o deep link inválido'),
    cta: z.string().trim(),
    merchant_id: z.string().trim(),
    user_segment: z
      .array(z.enum(HOME_HERO_USER_SEGMENTS))
      .min(1, 'Selecciona al menos un segmento'),
    start_date: z.string().min(1, 'Requerido'),
    end_date: z.string().min(1, 'Requerido'),
    template_id: z.enum(TEMPLATE_IDS),
    // Form-only toggle — not a CSV column. Derived from cta/click_url
    // presence when loading an existing row (see csvRowToHomeHeroBanner).
    has_cta: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (new Date(data.end_date) < new Date(data.start_date)) {
      ctx.addIssue({
        code: 'custom',
        message: 'No puede ser anterior a la fecha de inicio',
        path: ['end_date'],
      });
    }

    const variant = templateVariantFor(data.template_id, data.has_cta);
    const required = new Set(variant.fields.filter((f) => !variant.optionalFields?.includes(f)));
    const allowed = new Set(variant.fields);
    const templateLabel = `${TEMPLATE_LABELS[data.template_id]} (${data.has_cta ? 'con CTA' : 'sin CTA'})`;

    for (const field of CONTENT_FIELDS_CATALOG) {
      const isEmpty = data[field].trim() === '';
      if (required.has(field) && isEmpty) {
        ctx.addIssue({ code: 'custom', message: `Requerido para ${templateLabel}`, path: [field] });
      } else if (!allowed.has(field) && !isEmpty) {
        ctx.addIssue({
          code: 'custom',
          message: `Este campo no aplica a ${templateLabel} — bórralo o cambia de template`,
          path: [field],
        });
      }
    }
  });

export type HomeHeroBannerFields = z.infer<typeof homeHeroBannerSchema>;

/** Raw CSV row (all strings) → typed row for the form/edit UI. */
export function csvRowToHomeHeroBanner(raw: Record<string, string>): HomeHeroBannerFields {
  const cta = raw.cta ?? '';
  const templateId = raw.template_id ?? '';
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
    cta,
    merchant_id: raw.merchant_id ?? '',
    user_segment: (raw.user_segment ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s): s is HomeHeroUserSegment =>
        (HOME_HERO_USER_SEGMENTS as readonly string[]).includes(s),
      ),
    start_date: (raw.start_date ?? '').trim(),
    end_date: (raw.end_date ?? '').trim(),
    // Falls back to template_1 for legacy/unrecognized values so the form
    // still opens for editing instead of crashing on an invalid enum value.
    template_id: (TEMPLATE_IDS as readonly string[]).includes(templateId)
      ? (templateId as TemplateId)
      : 'template_1',
    has_cta: cta.trim() !== '',
  };
}

/** Typed row → raw CSV row (all strings), ready for unparseCsv.
 *
 * Content fields that don't belong to the selected template+variant are
 * forced blank so a stale value left over from a previous template (or a
 * duplicated row) never leaks into the exported file. */
export function homeHeroBannerToCsvRow(item: HomeHeroBannerFields): Record<string, string> {
  const allowed = new Set(templateVariantFor(item.template_id, item.has_cta).fields);
  const content = (field: ContentField) => (allowed.has(field) ? item[field] : '');
  return {
    campaign_id: item.campaign_id,
    title: content('title'),
    subtitle: content('subtitle'),
    caption: content('caption'),
    discount_amount: content('discount_amount'),
    discount_percentage: content('discount_percentage'),
    cashback_amount: content('cashback_amount'),
    cashback_percentage: content('cashback_percentage'),
    coupon: content('coupon'),
    coupon_caption: content('coupon_caption'),
    background_url: item.background_url,
    logo_url: content('logo_url'),
    click_url: content('click_url'),
    cta: content('cta'),
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

/** Non-blocking hint — merchant_id is usually numeric but not enforced as such. */
export function isMerchantIdLikelyValid(merchantId: string): boolean {
  return merchantId.trim() === '' || /^\d+$/.test(merchantId.trim());
}

/** Non-blocking hint — a duplicate campaign_id is often valid (recurring BAU
 * campaigns split across date ranges), just worth surfacing for review. */
export function hasDuplicateCampaignId(campaignId: string, otherCampaignIds: readonly string[]): boolean {
  const trimmed = campaignId.trim();
  return trimmed !== '' && otherCampaignIds.some((id) => id.trim() === trimmed);
}
