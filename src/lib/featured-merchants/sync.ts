/**
 * Comercios destacados por categoría sync — pure parse/validate engine.
 *
 * Every sync fully REPLACES the collection: the apply route deletes every
 * existing item before creating the ones parsed here. This module only turns
 * the uploaded CSV into valid item payloads or blocking row errors.
 *
 * Column layout (fixed position — matches the Sheet export):
 *   A (0) Orden (only used to sort within a category — see below)
 *   B (1) Slug · C (2) Merchant ID
 *   G (6) "Categoría guía" — the category source of truth (column F is a
 *         legacy value that sometimes disagrees and is ignored)
 *   H (7) Tipo de Comercio
 * Column A's header is blank in the real export, so headers are validated by
 * position for B/C/G/H only.
 *
 * Design rules (confirmed with stakeholder):
 *  - `orden` is re-numbered 1..N per category, following the CSV's own
 *    order (column A, ties broken by file position), over the rows that will
 *    actually be created — so errors never leave gaps.
 *  - `name` holds the Merchant ID (the CMS labels it "Merchant ID").
 *  - `nombre-del-comercio` is resolved from the Merchants collection by
 *    Merchant ID; `categoria` from the Categories collection by slug.
 *    Either missing blocks the row.
 *  - `tipo-de-comercio` is a fixed Webflow Option list; matched ignoring
 *    case/spacing around ";", plus TIPO_ALIASES for known Sheet drift.
 *  - A Merchant ID that appears in more than one row is valid (a merchant can
 *    be featured in several categories) but flagged with a warning.
 */

/** Webflow field slugs owned by the sync (schema verified 2026-09-30). */
export const F = {
  orden: 'orden',
  name: 'name',
  slug: 'slug',
  comercio: 'nombre-del-comercio',
  categoria: 'categoria',
  tipo: 'tipo-de-comercio',
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
    .replace(/\s*;\s*/g, '; ')
    .replace(/\s+/g, ' ');
}

interface TipoOption {
  id: string;
  label: string;
}

/** Every option Webflow has configured for `tipo-de-comercio`. If a new
 * option is added in Webflow, append it here. */
const TIPO_OPTIONS: Record<string, TipoOption> = {};
[
  ['en-linea', 'df0c640811023e03f6ceff67d507f234'],
  ['tienda-fisica', 'c794f73a63e3c4c1931dc0cffca34351'],
  ['en-linea; tienda-fisica', 'd78cf16f0b7983a0f205cdee5382194d'],
].forEach(([label, id]) => {
  TIPO_OPTIONS[normalizeLabel(label)] = { id, label };
});

/** Known Sheet format drift → canonical (normalized) option label. */
const TIPO_ALIASES: Record<string, string> = {
  [normalizeLabel('en-linea-y-en-tienda-fisica')]: normalizeLabel('en-linea; tienda-fisica'),
};

function resolveTipo(raw: string): TipoOption | undefined {
  const norm = normalizeLabel(raw);
  return TIPO_OPTIONS[TIPO_ALIASES[norm] ?? norm];
}

/** Webflow collection item, the subset the sync reads. */
export interface ExistingItem {
  id: string;
  isDraft?: boolean;
  lastPublished?: string | null;
  fieldData: Record<string, unknown>;
}

export type RowStatus = 'ready' | 'error';

export interface FeaturedRow {
  /** 1-based spreadsheet row as it appears in the CSV (row 1 is the header). */
  row: number;
  /** Final `orden` written to Webflow (re-numbered). Null on error rows. */
  orden: number | null;
  /** Value of column A as it came in the CSV, for reference. */
  ordenOriginal: string;
  merchantId: string;
  /** Merchant's real name in Webflow, for display only. */
  merchantName: string;
  categoryRaw: string;
  /** Category display name from Webflow, for display only. */
  categoryResolved?: string;
  tipoRaw: string;
  tipoResolved?: string;
  slug: string;
  status: RowStatus;
  /** Full create payload. Present only when status is 'ready'. */
  fieldData?: Record<string, unknown> & { name: string; slug: string };
  errors?: string[];
  warnings?: string[];
}

export interface FeaturedDiffReport {
  rows: FeaturedRow[];
  /** Every item currently in the collection — ALL of these are deleted on apply. */
  toDelete: { id: string; name: string }[];
  counts: Record<RowStatus, number>;
  warningCount: number;
  /** Set when the CSV's column layout doesn't match what's expected — rows is empty. */
  headerError?: string;
}

/** Header cell (normalized) check expected at each fixed column position. */
const EXPECTED_HEADER_CELLS: [number, (cell: string) => boolean][] = [
  [1, (c) => c === normalizeLabel('Slug')],
  [2, (c) => c === normalizeLabel('Merchant ID')],
  // Real header is "(-)\nCategoría guía".
  [6, (c) => c.endsWith('categoria guia')],
  [7, (c) => c === normalizeLabel('Tipo de Comercio')],
];

const EMPTY_COUNTS: Record<RowStatus, number> = { ready: 0, error: 0 };

export function computeFeaturedDiff(
  rawRows: string[][],
  existingItems: ExistingItem[],
  merchantsById: Map<string, ExistingItem>,
  categoriesBySlug: Map<string, ExistingItem>,
): FeaturedDiffReport {
  const toDelete = existingItems.map((it) => ({
    id: it.id,
    name: normalize(it.fieldData.name) || it.id,
  }));
  const empty = { rows: [], toDelete, counts: EMPTY_COUNTS, warningCount: 0 };

  const [headerRow, ...dataRows] = rawRows;
  if (!headerRow) return { ...empty, headerError: 'El CSV está vacío.' };

  const missing = EXPECTED_HEADER_CELLS.filter(
    ([pos, ok]) => !ok(normalizeLabel(headerRow[pos] ?? '')),
  );
  if (missing.length > 0) {
    const cols = missing.map(([pos]) => String.fromCharCode(65 + pos)).join(', ');
    return { ...empty, headerError: `El formato del CSV cambió — revisa la(s) columna(s) ${cols}.` };
  }

  const categories = new Map<string, ExistingItem>();
  for (const [slug, item] of categoriesBySlug) categories.set(normalizeLabel(slug), item);

  const rows: FeaturedRow[] = [];
  const firstRowForSlug = new Map<string, number>();
  /** Per-row sort key (original column A) for the re-numbering pass. */
  const sortKey = new Map<FeaturedRow, number>();

  dataRows.forEach((cells, i) => {
    const row = i + 2; // row 1 is the header
    const ordenRaw = normalize(cells[0]);
    const slugRaw = normalize(cells[1]);
    const merchantId = normalize(cells[2]);
    const categoryRaw = normalize(cells[6]);
    const tipoRaw = normalize(cells[7]);

    if (!slugRaw && !merchantId && !categoryRaw && !tipoRaw) return; // blank/separator row

    const errors: string[] = [];

    if (!merchantId) errors.push('Falta el Merchant ID (columna C).');
    const merchant = merchantId ? merchantsById.get(merchantId) : undefined;
    if (merchantId && !merchant) {
      errors.push(`El Merchant ID ${merchantId} no existe en la colección Merchants.`);
    }

    if (!categoryRaw) errors.push('Falta la Categoría guía (columna G).');
    const category = categoryRaw ? categories.get(normalizeLabel(categoryRaw)) : undefined;
    if (categoryRaw && !category) {
      errors.push(`La categoría "${categoryRaw}" no existe en la colección de categorías.`);
    }

    if (!tipoRaw) errors.push('Falta el Tipo de Comercio (columna H).');
    const tipo = tipoRaw ? resolveTipo(tipoRaw) : undefined;
    if (tipoRaw && !tipo) {
      errors.push(`El Tipo de Comercio "${tipoRaw}" no existe en Webflow.`);
    }

    const slug = slugRaw || (merchantId && categoryRaw ? `${merchantId}-${categoryRaw}` : '');
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
      orden: null,
      ordenOriginal: ordenRaw,
      merchantId,
      merchantName: merchant ? normalize(merchant.fieldData.name) : '',
      categoryRaw,
      tipoRaw,
      slug,
    };

    if (errors.length > 0) {
      rows.push({ ...base, status: 'error', errors });
      return;
    }

    const entry: FeaturedRow = {
      ...base,
      status: 'ready',
      categoryResolved: normalize(category!.fieldData.name) || categoryRaw,
      tipoResolved: tipo!.label,
      fieldData: {
        name: merchantId,
        slug,
        [F.comercio]: merchant!.id,
        [F.categoria]: category!.id,
        [F.tipo]: tipo!.id,
      },
    };
    rows.push(entry);
    sortKey.set(entry, /^\d+$/.test(ordenRaw) ? Number(ordenRaw) : Number.POSITIVE_INFINITY);
  });

  // ---- re-number `orden` 1..N per category over the rows that will be created ----
  const byCategory = new Map<string, FeaturedRow[]>();
  for (const r of rows) {
    if (r.status !== 'ready') continue;
    const key = String(r.fieldData![F.categoria]);
    byCategory.set(key, [...(byCategory.get(key) ?? []), r]);
  }
  for (const group of byCategory.values()) {
    // Array.sort is stable, so equal keys keep their file order.
    group
      .sort((a, b) => sortKey.get(a)! - sortKey.get(b)!)
      .forEach((r, idx) => {
        r.orden = idx + 1;
        r.fieldData![F.orden] = idx + 1;
      });
  }

  // ---- warn (never block) about a Merchant ID repeated across rows ----
  const rowsByMerchant = new Map<string, FeaturedRow[]>();
  for (const r of rows) {
    if (r.status !== 'ready') continue;
    rowsByMerchant.set(r.merchantId, [...(rowsByMerchant.get(r.merchantId) ?? []), r]);
  }
  let warningCount = 0;
  for (const group of rowsByMerchant.values()) {
    if (group.length < 2) continue;
    for (const r of group) {
      const others = group.filter((o) => o !== r);
      r.warnings = [
        `El Merchant ID aparece también en ${others
          .map((o) => `la fila ${o.row} (${o.categoryResolved})`)
          .join(', ')}.`,
      ];
      warningCount++;
    }
  }

  const counts: Record<RowStatus, number> = { ready: 0, error: 0 };
  for (const r of rows) counts[r.status]++;

  return { rows, toDelete, counts, warningCount };
}
