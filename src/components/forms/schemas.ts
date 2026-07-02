import { z } from 'zod';
import { SLUG_PATTERN } from '@lib/slug';

const slugField = z
  .string()
  .min(1, 'Requerido')
  .max(256, 'Máximo 256 caracteres')
  .regex(SLUG_PATTERN, 'Solo minúsculas, números y guiones (sin espacios)');

const nameField = z.string().min(1, 'Requerido').max(256, 'Máximo 256 caracteres');

const couponDisplayField = z
  .string()
  .min(1, 'Requerido')
  .refine(
    (v) =>
      v === 'hidden' ||
      /^\[\d{2}\/\d{2}\/\d{4}\] - \[\d{2}\/\d{2}\/\d{4}\]$/.test(v),
    'Usa "hidden" o un rango [DD/MM/YYYY] - [DD/MM/YYYY]',
  );

const imageUrl = z.string().url('URL inválida');

// Flow 1 — Coupons. All fields required per stakeholder.
export const couponSchema = z.object({
  name: nameField,
  slug: slugField,
  'coupon-title': z.string().min(1, 'Requerido'),
  'coupon-description': z.string().min(1, 'Requerido'),
  'coupon-validity-text': z.string().min(1, 'Requerido'),
  'related-merchants': z
    // Webflow returns `alt: null` for images without alt text, so use `.nullish()`
    // (accepts null and undefined). `.optional()` would reject the null and mark
    // existing images invalid when editing.
    .array(z.object({ url: imageUrl, alt: z.string().nullish() }))
    .min(1, 'Sube al menos una imagen'),
  'coupon-display': couponDisplayField,
});
export type CouponFields = z.infer<typeof couponSchema>;

// Flow 2 — Coupon Filter Lists. All required.
export const couponFilterSchema = z.object({
  name: nameField,
  slug: slugField,
  'coupon-display': couponDisplayField,
});
export type CouponFilterFields = z.infer<typeof couponFilterSchema>;

// Flow 3 — Hero Banners. Only some required (per stakeholder).
const heroPageOption = z.enum(['Home', 'Promociones', 'Registrate Hoy', 'Amazon', 'Temu', 'Prototype']);
const buttonVariant = z.enum([
  'primary',
  'secondary',
  'primary - transparent',
  'secondary - outline',
  'beat',
  'beat - primary transparent',
  'beat - secondary transparent',
]);
const gradientVariant = z.enum([
  'Variante 1 - Naranja',
  'Variante 2 - Azul',
  'Variante 3 - Cian-Cobalto',
  'Variante 4 - Acero-Glacial',
  'Variante 5 - La vida no espera',
]);

// Rich-text emptiness: TipTap can emit `<p></p>` when blank. Require visible content.
const richTextRequired = z
  .string()
  .min(1, 'Requerido')
  .refine((v) => v.replace(/<[^>]*>/g, '').trim().length > 0, 'Requerido');

const heroDateRange = z
  .string()
  .min(1, 'Requerido')
  .refine(
    (v) =>
      v === 'hidden' ||
      /^\[\d{2}\/\d{2}\/\d{4}\] - \[\d{2}\/\d{2}\/\d{4}\]$/.test(v),
    'Usa "hidden" o un rango [DD/MM/YYYY] - [DD/MM/YYYY]',
  );

const alternateColor = z
  .string()
  .nullish()
  .refine(
    (v) =>
      !v ||
      /^#[0-9a-fA-F]{6}$/.test(v) ||
      /^\{(?:(?:h1|h2|h3|p|all)(?:\|(?:h1|h2|h3|p|all))*),\s*#[0-9a-fA-F]{6}\}$/.test(v),
    'Formato no válido. Usa "#RRGGBB" o "{h1|h2, #RRGGBB}".',
  );

export const heroBannerSchema = z.object({
  name: nameField,
  slug: slugField,
  // Required:
  titulo: richTextRequired,
  descripcion: richTextRequired,
  'imagen-2': imageUrl,
  'fechas-despliegue': heroDateRange,
  'pagina-despliegue': heroPageOption,
  // Optional. Webflow returns `null` (not `undefined`) for empty fields, so use
  // `.nullish()` (accepts both null and undefined) rather than `.optional()`.
  'imagen-cabecera': z
    .string()
    .nullish()
    .refine(
      (v) => !v || /^\{\s*\S[^,}]*,\s*(?:\d+|auto)\s*\}$/.test(v),
      'Formato inválido. Usa "{url, 150}" o "{url, auto}".',
    ),
  'texto-descripcion-auxiliar': z.string().nullish(),
  'texto-copy-auxiliar': z.string().nullish(),
  'texto-disclaimer': z.string().nullish(),
  'mostrar-boton-creacion-cuenta': z.boolean().nullish(),
  'copy-personalizado-boton-creacion-cuenta': z.string().nullish(),
  'url-personalizada-boton-creacion-cuenta': z.string().nullish(),
  'variante-boton-creacion-cuenta': buttonVariant.nullish(),
  'copy-boton-extra': z.string().nullish(),
  'url-boton-extra': z.string().nullish(),
  'variante-boton-extra': buttonVariant.nullish(),
  'color-fondo-2': z.string().nullish(),
  'color-texto-alterno': alternateColor,
  'imagen-mobile': z.string().nullish(),
  'slide-order': z.number().int().min(0).nullish(),
  'logo-de-merchant': z.string().nullish(),
  'texto-alterno-logo-merchant': z.string().nullish(),
  'variante-de-gradiente': gradientVariant.nullish(),
});
export type HeroBannerFields = z.infer<typeof heroBannerSchema>;

export const schemas = {
  coupons: couponSchema,
  couponFilterList: couponFilterSchema,
  heroBanners: heroBannerSchema,
} as const;
