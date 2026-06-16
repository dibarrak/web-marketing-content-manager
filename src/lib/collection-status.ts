import type { CollectionKey } from './config/sites';

export type StatusKey = 'active' | 'inactive' | 'hidden';

export const STATUS_LABELS: Record<StatusKey, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  hidden: 'Oculto',
};

export function getStatus(display: string | undefined): StatusKey {
  if (!display || display === 'hidden') return 'hidden';
  const m = /^\[(\d{2})\/(\d{2})\/(\d{4})\] - \[(\d{2})\/(\d{2})\/(\d{4})\]$/.exec(display);
  if (!m) return 'inactive';
  const [, d1, mo1, y1, d2, mo2, y2] = m;
  const start = new Date(+y1, +mo1 - 1, +d1);
  const end = new Date(+y2, +mo2 - 1, +d2, 23, 59, 59, 999);
  const now = new Date();
  return now >= start && now <= end ? 'active' : 'inactive';
}

export function getDisplayField(
  collectionKey: CollectionKey,
  fieldData: Record<string, unknown>,
): string | undefined {
  const raw =
    collectionKey === 'heroBanners'
      ? fieldData['fechas-despliegue']
      : fieldData['coupon-display'];
  return typeof raw === 'string' ? raw : undefined;
}
