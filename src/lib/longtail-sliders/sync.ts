/**
 * Longtail Sliders sync — pure parse/validate engine.
 *
 * Every sync fully REPLACES the collection: the apply route deletes every
 * existing item before creating the ones parsed here. Unlike Merchant/Benefits
 * sync, there is no create-vs-update distinction and no matching against what
 * currently exists in Webflow — this module only turns the uploaded CSV into
 * either a valid item payload or a blocking row error.
 *
 * Column layout (fixed position — matches the weekly Sheet export):
 *   A (0) Orden · B (1) Slug · C (2) Merchant ID · D (3) Nombre del Comercio
 *   (display-only in the sheet, never written) · E (4) Selector de slider
 * Column A's header cell is a stray "|" in the real export, so headers are
 * validated by position for B/C/E only, not by name for every column.
 *
 * Design rules (confirmed with stakeholder):
 *  - A row whose Merchant ID (column C) has no match in the Merchants
 *    collection is blocked — never created without the `nombre-del-comercio`
 *    reference.
 *  - `selector-de-slider` is matched against Webflow's fixed Option list
 *    ignoring accents/case, plus SELECTOR_ALIASES for known Sheet typos
 *    (e.g. "Accesosios"). A value that still doesn't match blocks the row.
 *  - `slug` reuses column B as-is (already unique per row in practice,
 *    format `merchantId-suffix`); falls back to `merchantId-orden` when
 *    column B is blank. A slug that repeats within the same file blocks the
 *    later row.
 */

/** Webflow field slugs owned by the sync (schema captured 2026-09-29). */
export const F = {
  orden: 'orden',
  name: 'name',
  slug: 'slug',
  comercio: 'nombre-del-comercio',
  selector: 'selector-de-slider',
} as const;

export function normalize(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim();
}

/** Accent/case/whitespace-insensitive comparison key. */
export function normalizeLabel(s: string): string {
  return normalize(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

interface SelectorOption {
  id: string;
  label: string;
}

/** Every option Webflow has configured for `selector-de-slider`. Mirrored
 * from the CMS schema — if a new option is added in Webflow, append it here. */
const SELECTOR_OPTIONS: Record<string, SelectorOption> = {};
function registerOption(label: string, id: string): void {
  SELECTOR_OPTIONS[normalizeLabel(label)] = { id, label };
}
[
  ['Moda y accesorios', '1994f9ebefb60683ff78fbf897b65076'],
  ['Hogar y muebles', '577e5854a4fd72c40cbf21628b478401'],
  ['Belleza y bienestar', 'ed6eedad00e4216953d9b9d493c4ef04'],
  ['Marketplaces / retail', '4666022d1e74f5efda1ac893dca599d3'],
  ['Electronicos', 'cb02f867deab3467dcfc9bfd20af61ff'],
  ['Juguetes y juegos', '8218eb39ebac48116c07f4b9a5be3fc4'],
  ['Salud y estado fisico', 'abac9b2cf5388de22aca050db753c411'],
  ['Joyeria', '58ec717a87f4f50c41c3d4404f6b1442'],
  ['Viajes OTA', 'bdf8ad5e02804166ecbae3bf3ee5a361'],
  ['Alimentos y bebidas', '01b0d3228830796f981048e93f6a2172'],
  ['Auto', 'b37beff2de077f2ed45fb9dafa714281'],
  ['Mascotas', '30cd9e84522864a014158ccdcdf1d9fd'],
  ['Educacion y cultura', '5ac8b2023c6d76bfb5a960badf438853'],
  ['Transporte', '160f3225149dac68ad51798eaae010f0'],
  ['Servicios en linea y streaming', '07e97a76be4f436c039529c11facdfd2'],
  ['Otros', 'b5c0df28ac4ea5786b7f1f3fa476b7c8'],
  ['Exclusivos', '563fc2197dc26e7765233d831c465cab'],
  ['Promociones especiales', '90be6deb31df8d9d64538ee31bea4c78'],
].forEach(([label, id]) => registerOption(label, id));

/** Known Sheet typos/format drift → canonical (normalized) option label. */
const SELECTOR_ALIASES: Record<string, string> = {
  [normalizeLabel('Moda y Accesosios')]: normalizeLabel('Moda y accesorios'),
};

function resolveSelector(raw: string): SelectorOption | undefined {
  const norm = normalizeLabel(raw);
  return SELECTOR_OPTIONS[SELECTOR_ALIASES[norm] ?? norm];
}

/** Webflow collection item, the subset the sync reads. */
export interface ExistingItem {
  id: string;
  isDraft?: boolean;
  lastPublished?: string | null;
  fieldData: Record<string, unknown>;
}

export type RowStatus = 'ready' | 'error';

export interface LongtailRow {
  /** 1-based spreadsheet row as it appears in the CSV (row 1 is the header). */
  row: number;
  orden: number | null;
  merchantId: string;
  /** Merchant's real name in Webflow, for display only — never written. */
  merchantName: string;
  selectorRaw: string;
  /** Canonical Webflow option label the row resolved to, for display only. */
  selectorResolved?: string;
  slug: string;
  status: RowStatus;
  /** Full create payload. Present only when status is 'ready'. */
  fieldData?: Record<string, unknown> & { name: string; slug: string };
  errors?: string[];
}

export interface LongtailDiffReport {
  rows: LongtailRow[];
  /** Every item currently in the collection — ALL of these are deleted on apply. */
  toDelete: { id: string; name: string }[];
  counts: Record<RowStatus, number>;
  /** Set when the CSV's column layout doesn't match what's expected — rows is empty. */
  headerError?: string;
}

/** Header cell (normalized) expected at each fixed column position. */
const EXPECTED_HEADER_CELLS: [number, string][] = [
  [1, normalizeLabel('Slug')],
  [2, normalizeLabel('Merchant ID')],
  [4, normalizeLabel('Selector de slider')],
];

const EMPTY_COUNTS: Record<RowStatus, number> = { ready: 0, error: 0 };

/**
 * Build the full diff report between the uploaded CSV and the current state:
 * every row of the CSV becomes a `ready` (creatable) or `error` (blocked)
 * entry, and every existing Webflow item is listed in `toDelete` — the apply
 * route wipes the collection unconditionally, regardless of what's in the CSV.
 */
export function computeLongtailDiff(
  rawRows: string[][],
  existingItems: ExistingItem[],
  merchantsById: Map<string, ExistingItem>,
): LongtailDiffReport {
  const toDelete = existingItems.map((it) => ({
    id: it.id,
    name: normalize(it.fieldData.name) || it.id,
  }));

  const [headerRow, ...dataRows] = rawRows;
  if (!headerRow) {
    return { rows: [], toDelete, counts: EMPTY_COUNTS, headerError: 'El CSV está vacío.' };
  }

  const missing = EXPECTED_HEADER_CELLS.filter(
    ([pos, expected]) => normalizeLabel(headerRow[pos] ?? '') !== expected,
  );
  if (missing.length > 0) {
    const cols = missing.map(([pos]) => String.fromCharCode(65 + pos)).join(', ');
    return {
      rows: [],
      toDelete,
      counts: EMPTY_COUNTS,
      headerError: `El formato del CSV cambió — revisa la(s) columna(s) ${cols}.`,
    };
  }

  const rows: LongtailRow[] = [];
  const firstRowForSlug = new Map<string, number>();

  dataRows.forEach((cells, i) => {
    const row = i + 2; // row 1 is the header
    const ordenRaw = normalize(cells[0]);
    const slugRaw = normalize(cells[1]);
    const merchantId = normalize(cells[2]);
    const selectorRaw = normalize(cells[4]);

    if (!ordenRaw && !slugRaw && !merchantId && !selectorRaw) return; // blank/separator row

    const errors: string[] = [];

    const orden = /^\d+$/.test(ordenRaw) ? Number(ordenRaw) : null;
    if (orden === null) errors.push(`Orden inválido ("${ordenRaw}") — debe ser un entero.`);

    if (!merchantId) errors.push('Falta el Merchant ID (columna C).');
    const merchant = merchantId ? merchantsById.get(merchantId) : undefined;
    if (merchantId && !merchant) {
      errors.push(`El Merchant ID ${merchantId} no existe en la colección Merchants.`);
    }

    if (!selectorRaw) errors.push('Falta el Selector de slider (columna E).');
    const selector = selectorRaw ? resolveSelector(selectorRaw) : undefined;
    if (selectorRaw && !selector) {
      errors.push(`El valor de Selector de slider "${selectorRaw}" no existe en Webflow.`);
    }

    const slug = slugRaw || (merchantId && orden !== null ? `${merchantId}-${orden}` : '');
    if (!slug) {
      errors.push('No se pudo determinar el slug de la fila (falta columna B y datos para generarlo).');
    } else {
      const firstRow = firstRowForSlug.get(slug);
      if (firstRow !== undefined) {
        errors.push(`El slug "${slug}" ya se usó en la fila ${firstRow} de este archivo.`);
      } else {
        firstRowForSlug.set(slug, row);
      }
    }

    const base = {
      row,
      orden,
      merchantId,
      merchantName: merchant ? normalize(merchant.fieldData.name) : '',
      selectorRaw,
      slug,
    };

    if (errors.length > 0) {
      rows.push({ ...base, status: 'error', errors });
      return;
    }

    rows.push({
      ...base,
      status: 'ready',
      selectorResolved: selector!.label,
      fieldData: {
        name: merchantId,
        slug,
        [F.orden]: orden!,
        [F.comercio]: merchant!.id,
        [F.selector]: selector!.id,
      },
    });
  });

  const counts: Record<RowStatus, number> = { ready: 0, error: 0 };
  for (const r of rows) counts[r.status]++;

  return { rows, toDelete, counts };
}
