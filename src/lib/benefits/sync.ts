/**
 * Benefits sync — pure diff engine.
 *
 * Merges the two source tables (cashback + cupón) coming from the Apps Script
 * Web App by `merchant-id`, compares against the current Webflow items, and
 * classifies each merchant as new / changed / unchanged / out-of-source.
 *
 * Design rules (see project memory):
 *  - Match & idempotency by `merchant-id`.
 *  - The sync owns ONLY the cupón and cashback blocks + their switches. It
 *    never touches `mostrar-promocion`, `valor-promocion-especial*` or
 *    `referencia-landing-2` (partial PATCH preserves them).
 *  - Switches reflect presence in the source. When a block is absent we do a
 *    "soft off": switch → false, value fields left untouched.
 *  - Out-of-source merchants (in Webflow, absent from the month) get both
 *    switches turned off.
 *  - A merchant in the source with no Benefits item is only "new" when it has a
 *    landing in the Tiendas collection (matched by merchant-id). The created
 *    item copies the Tienda's name/slug and links to it; the caller then writes
 *    the back-reference on the Tienda. Without a landing → "no_landing", never
 *    created.
 */

/** Webflow field slugs owned by the sync. */
export const F = {
  merchantId: 'merchant-id',
  name: 'name',
  // cupón block
  cuponNombre: 'cupon',
  cuponValor: 'valor-cupon',
  cuponInicio: 'fecha-inicio-cupon',
  cuponFin: 'fecha-fin-cupon',
  cuponSwitch: 'activo',
  // cashback block
  cashbackValor: 'valor-descuento',
  cashbackInicio: 'fecha-inicio-descuento',
  cashbackFin: 'fecha-fin-descuento',
  cashbackSwitch: 'mostrar-descuento',
  // reference to the Tiendas landing
  landingRef: 'referencia-landing-2',
} as const;

/** Field on the Tiendas item that points back to its Benefits item. */
export const TIENDA_BENEFIT_REF = 'cupon-referenciado-unico';

/** A Tiendas landing, the subset the sync needs to link a Benefits item. */
export interface TiendaRef {
  id: string;
  merchantId: string;
  name: string;
  slug: string;
  isDraft?: boolean;
  /** Benefits item id already stored in the Tienda's back-reference, if any. */
  linkedBenefitId?: string;
}

// ---- Web App response shapes ----

export interface WebAppCashback {
  merchantId: string;
  name: string;
  valor: string;
  fechaInicio: string;
  fechaFin: string;
}

export interface WebAppCupon {
  merchantId: string;
  name: string;
  nombreCupon: string;
  valor: string;
  fechaInicio: string;
  fechaFin: string;
}

export interface WebAppResponse {
  ok: boolean;
  month?: string;
  cashback?: WebAppCashback[];
  cupon?: WebAppCupon[];
  error?: string;
}

// ---- Merged source ----

export interface MergedMerchant {
  merchantId: string;
  name: string;
  cupon?: { nombre: string; valor: string; inicio: string; fin: string };
  cashback?: { valor: string; inicio: string; fin: string };
  warnings: string[];
}

// ---- Existing Webflow item (subset we read) ----

export interface ExistingItem {
  id: string;
  isDraft?: boolean;
  fieldData: Record<string, unknown>;
}

// ---- Diff output ----

export type ChangeStatus =
  | 'new'
  | 'changed'
  | 'unchanged'
  | 'out_of_source'
  | 'draft'
  | 'no_landing';

export interface FieldChange {
  field: string;
  label: string;
  before: unknown;
  after: unknown;
}

export interface DiffEntry {
  merchantId: string;
  name: string;
  status: ChangeStatus;
  /** Existing Webflow item id (present for changed / unchanged / out_of_source). */
  itemId?: string;
  /** Tiendas landing to link (present for new). */
  tiendaId?: string;
  isCreate: boolean;
  changes: FieldChange[];
  /** Payload to send: full fieldData for create, partial for update. */
  fieldData: Record<string, unknown>;
  /** Target promo values for this merchant (what will be set), for display. */
  summary?: { cupon?: string; cashback?: string };
  warnings?: string[];
}

export interface DiffReport {
  month: string;
  entries: DiffEntry[];
  counts: Record<ChangeStatus, number>;
}

// ---- helpers ----

export function normalize(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim();
}

export function asBool(v: unknown): boolean {
  return v === true || v === 'true';
}

/** Extract the leading numeric part of a value like "15%" → 15, or null. */
export function numericValue(v: string): number | null {
  const m = v.match(/(\d+(?:[.,]\d+)?)/);
  return m ? parseFloat(m[1].replace(',', '.')) : null;
}

/**
 * True when candidate should replace the current pick because it has a higher
 * numeric value. Ties or unparseable candidates keep the current one.
 */
function higherValue(candidate: string, current: string): boolean {
  const a = numericValue(candidate);
  const b = numericValue(current);
  if (a === null) return false;
  if (b === null) return true;
  return a > b;
}

/**
 * Merge the cashback + cupón tables into one entry per merchant-id. On
 * duplicates for the same merchant, keep the promotion with the HIGHEST value.
 */
export function mergeSource(data: WebAppResponse): MergedMerchant[] {
  const map = new Map<string, MergedMerchant>();
  const ensure = (merchantId: string, name: string): MergedMerchant => {
    let m = map.get(merchantId);
    if (!m) {
      m = { merchantId, name, warnings: [] };
      map.set(merchantId, m);
    } else if (!m.name && name) {
      m.name = name;
    }
    return m;
  };

  for (const c of data.cupon ?? []) {
    const id = normalize(c.merchantId);
    if (!id) continue;
    const m = ensure(id, normalize(c.name));
    const cand = {
      nombre: normalize(c.nombreCupon),
      valor: normalize(c.valor),
      inicio: normalize(c.fechaInicio),
      fin: normalize(c.fechaFin),
    };
    if (!m.cupon) {
      m.cupon = cand;
    } else {
      if (higherValue(cand.valor, m.cupon.valor)) m.cupon = cand;
      m.warnings.push(
        `Múltiples cupones para ${id}; se conserva el de mayor valor (${m.cupon.valor}).`,
      );
    }
  }

  for (const cb of data.cashback ?? []) {
    const id = normalize(cb.merchantId);
    if (!id) continue;
    const m = ensure(id, normalize(cb.name));
    const cand = {
      valor: normalize(cb.valor),
      inicio: normalize(cb.fechaInicio),
      fin: normalize(cb.fechaFin),
    };
    if (!m.cashback) {
      m.cashback = cand;
    } else {
      if (higherValue(cand.valor, m.cashback.valor)) m.cashback = cand;
      m.warnings.push(
        `Múltiples cashback para ${id}; se conserva el de mayor valor (${m.cashback.valor}).`,
      );
    }
  }

  return [...map.values()];
}

interface Desired {
  field: string;
  label: string;
  value: string | boolean;
}

/** The set of owned fields the sync would write for a source merchant. */
function desiredFields(m: MergedMerchant): Desired[] {
  const out: Desired[] = [{ field: F.name, label: 'Name', value: m.name }];

  if (m.cupon) {
    out.push(
      { field: F.cuponNombre, label: 'Nombre cupón', value: m.cupon.nombre },
      { field: F.cuponValor, label: 'Valor cupón', value: m.cupon.valor },
      { field: F.cuponInicio, label: 'Fecha inicio cupón', value: m.cupon.inicio },
      { field: F.cuponFin, label: 'Fecha fin cupón', value: m.cupon.fin },
      { field: F.cuponSwitch, label: 'Mostrar cupón', value: true },
    );
  } else {
    out.push({ field: F.cuponSwitch, label: 'Mostrar cupón', value: false });
  }

  if (m.cashback) {
    out.push(
      { field: F.cashbackValor, label: 'Valor cashback', value: m.cashback.valor },
      { field: F.cashbackInicio, label: 'Fecha inicio cashback', value: m.cashback.inicio },
      { field: F.cashbackFin, label: 'Fecha fin cashback', value: m.cashback.fin },
      { field: F.cashbackSwitch, label: 'Mostrar cashback', value: true },
    );
  } else {
    out.push({ field: F.cashbackSwitch, label: 'Mostrar cashback', value: false });
  }

  return out;
}

function equals(desired: string | boolean, current: unknown): boolean {
  return typeof desired === 'boolean'
    ? asBool(current) === desired
    : normalize(current) === normalize(desired);
}

function diffMerchant(
  m: MergedMerchant,
  item: ExistingItem | undefined,
  tienda: TiendaRef | undefined,
  takenSlugs: Set<string>,
): DiffEntry {
  const desired = desiredFields(m);
  const warnings = m.warnings.length ? [...m.warnings] : [];
  const summary = { cupon: m.cupon?.valor, cashback: m.cashback?.valor };

  if (!item) {
    const skip = (reason: string, status: ChangeStatus): DiffEntry => ({
      merchantId: m.merchantId,
      name: m.name,
      status,
      isCreate: false,
      changes: [],
      fieldData: {},
      summary,
      warnings: [...warnings, reason],
    });
    if (!tienda) return skip('Sin landing en Tiendas: no se puede crear el item.', 'no_landing');
    if (tienda.isDraft) return skip('La landing en Tiendas está en DRAFT.', 'draft');
    if (tienda.linkedBenefitId)
      return skip('La landing ya está vinculada a otro item de Benefits.', 'no_landing');

    // Same convention as the existing items: name + slug mirror the Tienda.
    const name = tienda.name || m.name;
    let slug = tienda.slug || m.merchantId;
    if (takenSlugs.has(slug)) slug = `${slug}-${m.merchantId}`;
    takenSlugs.add(slug);

    const fieldData: Record<string, unknown> = {
      [F.merchantId]: m.merchantId,
      slug,
      [F.landingRef]: tienda.id,
    };
    for (const d of desired) fieldData[d.field] = d.field === F.name ? name : d.value;
    return {
      merchantId: m.merchantId,
      name,
      status: 'new',
      isCreate: true,
      tiendaId: tienda.id,
      changes: [
        { field: F.landingRef, label: 'Landing (Tienda)', before: undefined, after: tienda.name || tienda.slug },
        ...desired.map((d) => ({
          field: d.field,
          label: d.label,
          before: undefined,
          after: d.field === F.name ? name : d.value,
        })),
      ],
      fieldData,
      summary,
      warnings: warnings.length ? warnings : undefined,
    };
  }

  const changes: FieldChange[] = [];
  const patch: Record<string, unknown> = {};
  for (const d of desired) {
    const cur = item.fieldData[d.field];
    if (!equals(d.value, cur)) {
      changes.push({
        field: d.field,
        label: d.label,
        before: typeof d.value === 'boolean' ? asBool(cur) : normalize(cur),
        after: d.value,
      });
      patch[d.field] = d.value;
    }
  }

  return {
    merchantId: m.merchantId,
    name: m.name || normalize(item.fieldData[F.name]),
    status: changes.length ? 'changed' : 'unchanged',
    itemId: item.id,
    isCreate: false,
    changes,
    fieldData: patch,
    summary,
    warnings: warnings.length ? warnings : undefined,
  };
}

function diffOutOfSource(item: ExistingItem): DiffEntry | null {
  const changes: FieldChange[] = [];
  const patch: Record<string, unknown> = {};
  const switches: Array<[string, string]> = [
    [F.cuponSwitch, 'Mostrar cupón'],
    [F.cashbackSwitch, 'Mostrar cashback'],
  ];
  for (const [field, label] of switches) {
    if (asBool(item.fieldData[field])) {
      changes.push({ field, label, before: true, after: false });
      patch[field] = false;
    }
  }
  if (!changes.length) return null; // already off → no action needed
  return {
    merchantId: normalize(item.fieldData[F.merchantId]),
    name: normalize(item.fieldData[F.name]),
    status: 'out_of_source',
    itemId: item.id,
    isCreate: false,
    changes,
    fieldData: patch,
  };
}

/** Build the full diff report between source data and existing Webflow items. */
export function computeDiff(
  data: WebAppResponse,
  existing: ExistingItem[],
  tiendas: TiendaRef[] = [],
): DiffReport {
  const merged = mergeSource(data);

  const byMerchant = new Map<string, ExistingItem>();
  for (const it of existing) {
    const id = normalize(it.fieldData[F.merchantId]);
    if (id && !byMerchant.has(id)) byMerchant.set(id, it);
  }

  // Prefer a published landing when a merchant-id has several Tiendas.
  const tiendaByMerchant = new Map<string, TiendaRef>();
  for (const t of tiendas) {
    const cur = tiendaByMerchant.get(t.merchantId);
    if (!cur || (cur.isDraft && !t.isDraft)) tiendaByMerchant.set(t.merchantId, t);
  }
  const takenSlugs = new Set(existing.map((it) => normalize(it.fieldData.slug)).filter(Boolean));

  const sourceIds = new Set(merged.map((m) => m.merchantId));
  const entries: DiffEntry[] = [];

  for (const m of merged) {
    const item = byMerchant.get(m.merchantId);
    const entry = diffMerchant(m, item, tiendaByMerchant.get(m.merchantId), takenSlugs);
    if (item?.isDraft) {
      // DRAFT convention: the landing exists but isn't public. Never modify it;
      // show it as informational only (its changes are visible but not applied).
      entry.status = 'draft';
      entry.fieldData = {};
    }
    entries.push(entry);
  }

  for (const it of existing) {
    const id = normalize(it.fieldData[F.merchantId]);
    if (!id || sourceIds.has(id)) continue;
    if (it.isDraft) continue; // never touch drafts, even to turn switches off
    const off = diffOutOfSource(it);
    if (off) entries.push(off);
  }

  const counts: Record<ChangeStatus, number> = {
    new: 0,
    changed: 0,
    unchanged: 0,
    out_of_source: 0,
    draft: 0,
    no_landing: 0,
  };
  for (const e of entries) counts[e.status]++;

  return { month: data.month ?? '', entries, counts };
}
