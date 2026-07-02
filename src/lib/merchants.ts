/**
 * Merchants directory — shared types and validation.
 *
 * The merchant record lives in D1 (see schema.merchants); its logo is a Webflow
 * asset (we store the hosted URL + asset id). Coupons reference a merchant's
 * logo as an immutable snapshot ({url, alt}), so this directory only feeds the
 * pickers — it never owns coupon data.
 */
import { z } from 'zod';

export interface Merchant {
  id: string;
  merchantId: string;
  name: string;
  logoUrl: string;
  logoAssetId: string | null;
  createdAt: string; // serialized Date
  updatedAt: string; // serialized Date
}

/** Minimal shape returned to the coupon picker (read-only). */
export interface MerchantOption {
  id: string;
  merchantId: string;
  name: string;
  logoUrl: string;
}

/** Synthetic collection key used for audit-log rows about merchants. */
export const MERCHANTS_AUDIT_COLLECTION = 'merchants';

export const merchantInputSchema = z.object({
  merchantId: z
    .string()
    .trim()
    .min(1, 'El ID de comercio es requerido.')
    .max(128, 'Máximo 128 caracteres.'),
  name: z.string().trim().min(1, 'El nombre es requerido.').max(256, 'Máximo 256 caracteres.'),
  logoUrl: z.string().url('URL de logo inválida.'),
  logoAssetId: z.string().trim().min(1).nullish(),
});

export type MerchantInput = z.infer<typeof merchantInputSchema>;
