import type { MerchantType } from '@components/forms/schemas';

/**
 * The `tipo-de-comercio` options, in the order they should be offered.
 *
 * `value` is the Webflow Option *name* (what option-maps translates ids into),
 * so it must match Webflow exactly — typing it as `MerchantType` makes the
 * compiler reject a value the zod enum doesn't know. `label` is display-only.
 */
export const MERCHANT_TYPES: readonly { value: MerchantType; label: string }[] = [
  { value: 'en-linea', label: 'En línea' },
  { value: 'tienda-fisica', label: 'Tienda física' },
  { value: 'en-linea; tienda-fisica', label: 'En línea y tienda física' },
];

export const MERCHANT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  MERCHANT_TYPES.map((t) => [t.value, t.label]),
);
