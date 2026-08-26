/**
 * Merchant sync — pure diff engine.
 *
 * Each CSV row already carries its intended action (Alta/Actualización/Baja),
 * so unlike the Benefits sync this never infers create-vs-update — it only
 * validates the row against the current Webflow state and builds the
 * create/patch payload, or resolves which "Tiendas" landing page(s) must be
 * deleted before the Merchant item itself on a Baja.
 *
 * Design rules (confirmed with stakeholder):
 *  - Match by `merchant-id` (both Merchants and Tiendas carry this field).
 *  - Alta on an id that already exists, or Actualización/Baja on an id that
 *    doesn't — blocked as an error, never auto-corrected.
 *  - Channel "ambos" (en-linea; tienda-fisica) → both MultiReference items,
 *    never the combined "en-linea-y-en-tienda-fisica" item.
 *  - The sync only ever writes the fields it owns (name, category, channel,
 *    website, maps link) — everything else on a Merchant item (promos,
 *    destacados, etc.) is left untouched, same partial-PATCH contract as
 *    Benefits sync.
 */

/** Webflow field slugs owned by the sync. */
export const F = {
  merchantId: 'merchant-id',
  category: 'category-2',
  channel: 'tipo-de-tienda',
  website: 'link-to-store',
  mapsLink: 'mapa-de-tiendas-fisicas',
} as const;

const FIELD_LABELS: Record<string, string> = {
  name: 'Nombre',
  [F.category]: 'Categoría',
  [F.channel]: 'Tipo de tienda',
  [F.website]: 'Sitio web',
  [F.mapsLink]: 'Mapa',
};

export type RowAction = 'create' | 'update' | 'delete';
export type EntryStatus = RowAction | 'error';

export interface FieldChange {
  field: string;
  label: string;
  before: unknown;
  after: unknown;
}

/** Webflow collection item, the subset the sync reads. */
export interface ExistingItem {
  id: string;
  isDraft?: boolean;
  lastPublished?: string | null;
  fieldData: Record<string, unknown>;
}

/** A resolvable Reference option (category or channel taxonomy item). */
export interface SlugOption {
  id: string;
  name: string;
}

export interface MerchantEntry {
  /** 1-based row number as it appears in the spreadsheet (row 1 is the header). */
  row: number;
  merchantId: string;
  name: string;
  status: EntryStatus;
  /** Merchant item id in Webflow — present for update / delete. */
  itemId?: string;
  changes: FieldChange[];
  /** Full create payload, or partial update patch. Empty for delete/error. */
  fieldData: Record<string, unknown>;
  /** Tiendas item ids that must be deleted before the Merchant (delete only). */
  tiendaItemIds?: string[];
  errors?: string[];
  warnings?: string[];
}

export interface MerchantDiffReport {
  entries: MerchantEntry[];
  counts: Record<EntryStatus, number>;
  /** Set when the header row is missing an expected column — entries is empty. */
  headerError?: string;
}

// ---- helpers ----

export function normalize(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim();
}

function normalizeUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return v;
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`;
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function normalizeAction(raw: string): RowAction | null {
  const s = stripAccents(raw.trim().toLowerCase());
  if (s === 'alta') return 'create';
  if (s === 'actualizacion') return 'update';
  if (s === 'baja') return 'delete';
  return null;
}

function sameIdSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  return b.every((x) => sa.has(x));
}

function idsToNames(value: unknown, byId: Map<string, string>): string {
  const arr = Array.isArray(value) ? value : value ? [value] : [];
  const names = arr.map((id) => byId.get(String(id)) ?? String(id));
  return names.length ? names.join(', ') : '—';
}

const SPANISH_MONTHS =
  'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre';
/** "01/07/2026", "4/9/2024" or "4 marzo 2024" — the Sheet's weekly section markers. */
const DATE_MARKER_PATTERNS = [
  /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/,
  new RegExp(`^\\d{1,2}\\s+(${SPANISH_MONTHS})\\s+\\d{4}$`, 'i'),
];

function looksLikeDateMarker(value: string): boolean {
  const v = value.trim();
  return v !== '' && DATE_MARKER_PATTERNS.some((re) => re.test(v));
}

// ---- header resolution ----

interface ColumnIndices {
  merchantId: number;
  name: number;
  category: number;
  channel: number;
  website: number;
  maps: number;
  action: number;
}

/** Header text as it appears in the real export (`solicitudes.csv`). */
const EXPECTED_HEADERS: Record<keyof ColumnIndices, string> = {
  merchantId: 'papp',
  name: 'Merchant_Name',
  category: 'Category',
  channel: 'Tipo de tienda',
  website: 'Sitio Web',
  maps: 'Mapa',
  action: 'Tipo',
};

function resolveColumns(headerRow: string[]): { columns: ColumnIndices } | { error: string } {
  const norm = (s: string) => normalize(s).toLowerCase();
  const missing: string[] = [];
  const columns = {} as ColumnIndices;

  for (const [key, label] of Object.entries(EXPECTED_HEADERS) as [
    keyof ColumnIndices,
    string,
  ][]) {
    const idx = headerRow.findIndex((h) => norm(h) === norm(label));
    if (idx === -1) missing.push(label);
    else columns[key] = idx;
  }

  if (missing.length > 0) {
    return { error: `Faltan columnas en el CSV: ${missing.join(', ')}.` };
  }
  return { columns };
}

// ---- row parsing ----

interface ParsedRow {
  row: number;
  merchantId: string;
  name: string;
  categorySlug: string;
  channelSlugs: string[];
  website: string;
  mapsLink: string;
  action: RowAction;
}

interface RowParseError {
  row: number;
  merchantId: string;
  name: string;
  error: string;
}

/**
 * Parses one CSV data row using the columns resolved from the header row.
 *
 * Returns `null` for a weekly date-marker row (e.g. "01/07/2026" — the Sheet
 * uses these as visual section headers, even in an export of only the
 * pending batch) or a blank/separator row (every mapped column empty), a
 * `RowParseError` for a row with content but no usable merchant_id/action,
 * or the parsed row otherwise.
 */
function parseMerchantCsvRow(
  cells: string[],
  row: number,
  columns: ColumnIndices,
): ParsedRow | RowParseError | null {
  const get = (i: number) => normalize(cells[i]);
  const merchantId = get(columns.merchantId);

  // Checked before anything else: a date marker is recognized by its own
  // shape regardless of what (if anything) ended up in the other columns.
  if (looksLikeDateMarker(merchantId)) return null;

  const mappedFields = [
    columns.name,
    columns.category,
    columns.channel,
    columns.website,
    columns.maps,
    columns.action,
  ];
  const hasContent = mappedFields.some((i) => get(i) !== '');
  if (!hasContent) return null;

  const rawAction = get(columns.action);
  const action = normalizeAction(rawAction);
  const name = get(columns.name);

  if (!merchantId || !/^\d+$/.test(merchantId)) {
    return {
      row,
      merchantId,
      name,
      error: `Fila ${row}: falta el merchant_id o no es numérico ("${get(columns.merchantId)}").`,
    };
  }
  if (!action) {
    return {
      row,
      merchantId,
      name,
      error: `Fila ${row}: acción "${rawAction}" no reconocida — debe ser Alta, Actualización o Baja.`,
    };
  }

  return {
    row,
    merchantId,
    name,
    categorySlug: get(columns.category).toLowerCase(),
    channelSlugs: get(columns.channel)
      .split(';')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    website: get(columns.website),
    mapsLink: get(columns.maps),
    action,
  };
}

function errorEntry(
  row: Pick<ParsedRow, 'row' | 'merchantId' | 'name'>,
  errors: string[],
  warnings?: string[],
): MerchantEntry {
  return {
    row: row.row,
    merchantId: row.merchantId,
    name: row.name,
    status: 'error',
    changes: [],
    fieldData: {},
    errors,
    warnings,
  };
}

function buildEntry(
  row: ParsedRow,
  existingMerchants: Map<string, ExistingItem>,
  existingTiendas: Map<string, ExistingItem[]>,
  categoryBySlug: Map<string, SlugOption>,
  channelBySlug: Map<string, SlugOption>,
  categoryById: Map<string, string>,
  channelById: Map<string, string>,
): MerchantEntry {
  const existing = existingMerchants.get(row.merchantId);

  if (row.action === 'create') {
    const errors: string[] = [];
    if (existing) {
      errors.push(
        `El merchant_id ${row.merchantId} ya existe en Webflow — cámbialo a Actualización o Baja.`,
      );
    }
    if (!row.categorySlug) errors.push('Falta la categoría.');
    if (row.channelSlugs.length === 0) errors.push('Falta el tipo de tienda.');

    const category = row.categorySlug ? categoryBySlug.get(row.categorySlug) : undefined;
    if (row.categorySlug && !category) {
      errors.push(`La categoría "${row.categorySlug}" no existe en Webflow.`);
    }
    const channels = row.channelSlugs.map((s) => channelBySlug.get(s));
    row.channelSlugs.forEach((s, i) => {
      if (!channels[i]) errors.push(`El tipo de tienda "${s}" no existe en Webflow.`);
    });

    if (errors.length > 0) return errorEntry(row, errors);

    const channelIds = channels.map((c) => c!.id);
    const fieldData: Record<string, unknown> = {
      [F.merchantId]: row.merchantId,
      name: row.name,
      slug: row.merchantId,
      [F.category]: category!.id,
      [F.channel]: channelIds,
    };
    const changes: FieldChange[] = [
      { field: 'name', label: FIELD_LABELS.name, before: undefined, after: row.name },
      { field: F.category, label: FIELD_LABELS[F.category], before: undefined, after: category!.name },
      {
        field: F.channel,
        label: FIELD_LABELS[F.channel],
        before: undefined,
        after: channels.map((c) => c!.name).join(', '),
      },
    ];
    if (row.website) {
      const url = normalizeUrl(row.website);
      fieldData[F.website] = url;
      changes.push({ field: F.website, label: FIELD_LABELS[F.website], before: undefined, after: url });
    }
    if (row.mapsLink) {
      fieldData[F.mapsLink] = row.mapsLink;
      changes.push({
        field: F.mapsLink,
        label: FIELD_LABELS[F.mapsLink],
        before: undefined,
        after: row.mapsLink,
      });
    }

    return {
      row: row.row,
      merchantId: row.merchantId,
      name: row.name,
      status: 'create',
      changes,
      fieldData,
    };
  }

  if (row.action === 'update') {
    if (!existing) {
      return errorEntry(row, [
        `El merchant_id ${row.merchantId} no existe en Webflow — cámbialo a Alta.`,
      ]);
    }

    const errors: string[] = [];
    const changes: FieldChange[] = [];
    const patch: Record<string, unknown> = {};

    if (row.name && row.name !== normalize(existing.fieldData.name)) {
      changes.push({
        field: 'name',
        label: FIELD_LABELS.name,
        before: existing.fieldData.name,
        after: row.name,
      });
      patch.name = row.name;
    }

    if (row.categorySlug) {
      const category = categoryBySlug.get(row.categorySlug);
      if (!category) {
        errors.push(`La categoría "${row.categorySlug}" no existe en Webflow.`);
      } else if (category.id !== existing.fieldData[F.category]) {
        changes.push({
          field: F.category,
          label: FIELD_LABELS[F.category],
          before: idsToNames(existing.fieldData[F.category], categoryById),
          after: category.name,
        });
        patch[F.category] = category.id;
      }
    }

    if (row.channelSlugs.length > 0) {
      const channels = row.channelSlugs.map((s) => channelBySlug.get(s));
      row.channelSlugs.forEach((s, i) => {
        if (!channels[i]) errors.push(`El tipo de tienda "${s}" no existe en Webflow.`);
      });
      if (channels.every(Boolean)) {
        const ids = channels.map((c) => c!.id);
        const currentIds = Array.isArray(existing.fieldData[F.channel])
          ? (existing.fieldData[F.channel] as string[])
          : [];
        if (!sameIdSet(ids, currentIds)) {
          changes.push({
            field: F.channel,
            label: FIELD_LABELS[F.channel],
            before: idsToNames(currentIds, channelById),
            after: channels.map((c) => c!.name).join(', '),
          });
          patch[F.channel] = ids;
        }
      }
    }

    if (row.website) {
      const url = normalizeUrl(row.website);
      if (url !== normalize(existing.fieldData[F.website])) {
        changes.push({
          field: F.website,
          label: FIELD_LABELS[F.website],
          before: existing.fieldData[F.website],
          after: url,
        });
        patch[F.website] = url;
      }
    }

    if (row.mapsLink && row.mapsLink !== normalize(existing.fieldData[F.mapsLink])) {
      changes.push({
        field: F.mapsLink,
        label: FIELD_LABELS[F.mapsLink],
        before: existing.fieldData[F.mapsLink],
        after: row.mapsLink,
      });
      patch[F.mapsLink] = row.mapsLink;
    }

    if (errors.length > 0) return errorEntry(row, errors);

    return {
      row: row.row,
      merchantId: row.merchantId,
      name: row.name || normalize(existing.fieldData.name),
      status: 'update',
      itemId: existing.id,
      changes,
      fieldData: patch,
    };
  }

  // action === 'delete'
  if (!existing) {
    return errorEntry(row, [
      `El merchant_id ${row.merchantId} no existe en Webflow — no hay nada que borrar.`,
    ]);
  }
  const tiendas = existingTiendas.get(row.merchantId) ?? [];
  const warnings =
    tiendas.length > 1
      ? [`${tiendas.length} landing pages en Tiendas para este merchant — se borrarán todas.`]
      : undefined;

  return {
    row: row.row,
    merchantId: row.merchantId,
    name: row.name || normalize(existing.fieldData.name),
    status: 'delete',
    itemId: existing.id,
    changes: [],
    fieldData: {},
    tiendaItemIds: tiendas.map((t) => t.id),
    warnings,
  };
}

const EMPTY_COUNTS: Record<EntryStatus, number> = { create: 0, update: 0, delete: 0, error: 0 };

/**
 * Build the full diff report between the uploaded CSV rows and Webflow.
 *
 * `rawRows[0]` must be the header row — the Sheet's export always includes
 * it (it's merely hidden, not deleted), so columns are resolved by name
 * rather than by fixed position. This survives future column reorders and
 * fails loudly (via `headerError`) instead of silently misreading data when
 * an expected column is missing.
 */
export function computeMerchantDiff(
  rawRows: string[][],
  existingMerchants: Map<string, ExistingItem>,
  existingTiendas: Map<string, ExistingItem[]>,
  categoryBySlug: Map<string, SlugOption>,
  channelBySlug: Map<string, SlugOption>,
): MerchantDiffReport {
  const [headerRow, ...dataRows] = rawRows;
  if (!headerRow) {
    return { entries: [], counts: EMPTY_COUNTS, headerError: 'El CSV está vacío.' };
  }
  const resolved = resolveColumns(headerRow);
  if ('error' in resolved) {
    return { entries: [], counts: EMPTY_COUNTS, headerError: resolved.error };
  }
  const columns = resolved.columns;

  const categoryById = new Map<string, string>();
  for (const o of categoryBySlug.values()) categoryById.set(o.id, o.name);
  const channelById = new Map<string, string>();
  for (const o of channelBySlug.values()) channelById.set(o.id, o.name);

  const parsed: ParsedRow[] = [];
  const entries: MerchantEntry[] = [];

  // Row 1 is the header, so the first data row is spreadsheet row 2.
  dataRows.forEach((cells, i) => {
    const result = parseMerchantCsvRow(cells, i + 2, columns);
    if (result === null) return;
    if ('error' in result) {
      entries.push(errorEntry(result, [result.error]));
      return;
    }
    parsed.push(result);
  });

  const countsById = new Map<string, number>();
  for (const r of parsed) countsById.set(r.merchantId, (countsById.get(r.merchantId) ?? 0) + 1);

  for (const row of parsed) {
    if ((countsById.get(row.merchantId) ?? 0) > 1) {
      entries.push(
        errorEntry(row, [`El merchant_id ${row.merchantId} aparece más de una vez en este CSV.`]),
      );
      continue;
    }
    entries.push(
      buildEntry(
        row,
        existingMerchants,
        existingTiendas,
        categoryBySlug,
        channelBySlug,
        categoryById,
        channelById,
      ),
    );
  }

  const counts: Record<EntryStatus, number> = { create: 0, update: 0, delete: 0, error: 0 };
  for (const e of entries) counts[e.status]++;

  return { entries, counts };
}
