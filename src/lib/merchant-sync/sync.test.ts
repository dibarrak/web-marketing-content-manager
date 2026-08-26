import { describe, expect, it } from 'vitest';
import { computeMerchantDiff, F, type ExistingItem, type SlugOption } from './sync';

const merchant = (id: string, fields: Record<string, unknown> = {}): ExistingItem => ({
  id: `merchant-${id}`,
  isDraft: false,
  lastPublished: '2026-01-01T00:00:00.000Z',
  fieldData: { [F.merchantId]: id, name: `M${id}`, slug: id, ...fields },
});

const tienda = (id: string, itemId: string): ExistingItem => ({
  id: itemId,
  isDraft: false,
  lastPublished: '2026-01-01T00:00:00.000Z',
  fieldData: { [F.merchantId]: id, name: `Tienda ${id}`, slug: `tienda-${id}` },
});

const categoryBySlug = new Map<string, SlugOption>([
  ['moda-y-accesorios', { id: 'cat-moda', name: 'Moda y accesorios' }],
  ['electronica', { id: 'cat-electronica', name: 'Electrónica' }],
]);
const channelBySlug = new Map<string, SlugOption>([
  ['en-linea', { id: 'chan-online', name: 'En línea' }],
  ['tienda-fisica', { id: 'chan-fisica', name: 'Tienda física' }],
]);

// Header row exactly as it appears in the real export (hidden in the Sheet,
// but always present in the CSV — confirmed by the stakeholder).
const HEADER = ['papp', 'Merchant_Name', 'Category', 'Tipo de tienda', 'Sitio Web', 'Mapa', 'Tipo'];

function diff(
  rows: string[][],
  merchants: ExistingItem[] = [],
  tiendas: ExistingItem[] = [],
  header: string[] = HEADER,
) {
  const merchantsMap = new Map(merchants.map((m) => [String(m.fieldData[F.merchantId]), m]));
  const tiendasMap = new Map<string, ExistingItem[]>();
  for (const t of tiendas) {
    const id = String(t.fieldData[F.merchantId]);
    tiendasMap.set(id, [...(tiendasMap.get(id) ?? []), t]);
  }
  return computeMerchantDiff([header, ...rows], merchantsMap, tiendasMap, categoryBySlug, channelBySlug);
}

describe('computeMerchantDiff — header resolution', () => {
  it('resolves columns by name, not position', () => {
    // Same 7 columns, deliberately reordered — a name-based parser must still
    // read the right value out of each cell.
    const reordered = ['Tipo', 'papp', 'Sitio Web', 'Merchant_Name', 'Category', 'Tipo de tienda', 'Mapa'];
    const rows = [['Alta', '1', 'https://x.mx/', 'X', 'electronica', 'en-linea', '']];
    const report = diff(rows, [], [], reordered);
    expect(report.counts.create).toBe(1);
    const e = report.entries[0];
    expect(e.merchantId).toBe('1');
    expect(e.name).toBe('X');
    expect(e.fieldData[F.category]).toBe('cat-electronica');
    expect(e.fieldData[F.website]).toBe('https://x.mx/');
  });

  it('reports headerError when an expected column is missing, instead of misreading data', () => {
    const badHeader = ['papp', 'Merchant_Name', 'Category', 'Sitio Web', 'Mapa', 'Tipo'];
    const report = diff([['1', 'X', 'electronica', 'https://x.mx/', '', 'Alta']], [], [], badHeader);
    expect(report.headerError).toMatch(/Tipo de tienda/);
    expect(report.entries).toHaveLength(0);
  });
});

describe('computeMerchantDiff — row parsing', () => {
  it('silently skips a weekly date-marker row', () => {
    const report = diff([['4 marzo 2024', '', '', '', '', '', '']]);
    expect(report.entries).toHaveLength(0);
  });

  it('silently skips a date-marker row even in the numeric dd/mm/yyyy form used in the real export', () => {
    const report = diff([['01/07/2026', '', '', '', '', '', '']]);
    expect(report.entries).toHaveLength(0);
  });

  it('skips a date-marker row as a marker, not an invalid merchant_id error, even with stray content', () => {
    // The "Solicitud abierta" tag sometimes lands in a trailing column not
    // mapped by the sync — must not turn the date row into an error.
    const report = diff([['01/07/2026', '', '', '', '', '', '', '', '', 'Solicitud abierta']]);
    expect(report.entries).toHaveLength(0);
  });

  it('errors on a row with content but no numeric merchant_id', () => {
    const report = diff([['', 'Some Merchant', '', '', 'https://x.mx/', '', 'Actualización']]);
    expect(report.counts.error).toBe(1);
    expect(report.entries[0].errors?.[0]).toMatch(/merchant_id/);
  });

  it('errors on an unrecognized action', () => {
    const report = diff([['1', 'X', 'electronica', 'en-linea', '', '', 'Cancelar']]);
    expect(report.counts.error).toBe(1);
    expect(report.entries[0].errors?.[0]).toMatch(/no reconocida/);
  });

  it('errors on a duplicate merchant_id within the same upload', () => {
    const rows = [
      ['1', 'X', 'electronica', 'en-linea', 'https://x.mx', '', 'Alta'],
      ['1', 'X', 'electronica', 'en-linea', 'https://x.mx', '', 'Alta'],
    ];
    const report = diff(rows);
    expect(report.counts.error).toBe(2);
    expect(report.entries.every((e) => /aparece más de una vez/.test(e.errors?.[0] ?? ''))).toBe(true);
  });
});

describe('computeMerchantDiff — Alta', () => {
  it('creates a full payload, mapping both channel slugs when both are given', () => {
    const rows = [['992611113934423', 'BOMBAVISTA', 'moda-y-accesorios', 'en-linea; tienda-fisica', 'https://bombavista.mx/', 'https://maps.example/', 'Alta']];
    const report = diff(rows);
    expect(report.counts.create).toBe(1);
    const e = report.entries[0];
    expect(e.fieldData[F.merchantId]).toBe('992611113934423');
    expect(e.fieldData.slug).toBe('992611113934423');
    expect(e.fieldData[F.category]).toBe('cat-moda');
    expect(e.fieldData[F.channel]).toEqual(['chan-online', 'chan-fisica']);
    expect(e.fieldData[F.website]).toBe('https://bombavista.mx/');
    expect(e.fieldData[F.mapsLink]).toBe('https://maps.example/');
  });

  it('errors when the merchant_id already exists', () => {
    const rows = [['1', 'X', 'electronica', 'en-linea', '', '', 'Alta']];
    const report = diff(rows, [merchant('1')]);
    expect(report.counts.error).toBe(1);
    expect(report.entries[0].errors?.[0]).toMatch(/ya existe/);
  });

  it('errors on a missing or unknown category/channel slug', () => {
    const rows = [['1', 'X', '', 'no-existe', '', '', 'Alta']];
    const report = diff(rows);
    expect(report.counts.error).toBe(1);
    expect(report.entries[0].errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/categoría/i), expect.stringMatching(/tipo de tienda/i)]),
    );
  });
});

describe('computeMerchantDiff — Actualización', () => {
  it('builds a partial patch with only the fields that changed', () => {
    const existing = merchant('1', { [F.category]: 'cat-electronica', [F.channel]: ['chan-online'] });
    const rows = [['1', 'M1', 'moda-y-accesorios', '', '', '', 'Actualización']];
    const report = diff(rows, [existing]);
    expect(report.counts.update).toBe(1);
    const e = report.entries[0];
    expect(e.itemId).toBe(existing.id);
    expect(e.fieldData).toEqual({ [F.category]: 'cat-moda' });
    expect(e.changes.map((c) => c.field)).toEqual([F.category]);
  });

  it('treats blank columns as "no change", never as "clear this field"', () => {
    const existing = merchant('1', { [F.category]: 'cat-electronica', [F.website]: 'https://old.mx' });
    const rows = [['1', '', '', '', '', '', 'Actualización']];
    const report = diff(rows, [existing]);
    expect(report.entries[0].fieldData).toEqual({});
  });

  it('errors when the merchant_id does not exist', () => {
    const rows = [['1', 'X', '', '', '', '', 'Actualización']];
    const report = diff(rows);
    expect(report.counts.error).toBe(1);
    expect(report.entries[0].errors?.[0]).toMatch(/no existe/);
  });
});

describe('computeMerchantDiff — Baja', () => {
  it('resolves zero, one, and multiple Tiendas items to cascade-delete', () => {
    const rows = [
      ['1', 'Sin landing', '', '', '', '', 'Baja'],
      ['2', 'Una landing', '', '', '', '', 'Baja'],
      ['3', 'Dos landings', '', '', '', '', 'Baja'],
    ];
    const merchants = [merchant('1'), merchant('2'), merchant('3')];
    const tiendas = [tienda('2', 't-2a'), tienda('3', 't-3a'), tienda('3', 't-3b')];
    const report = diff(rows, merchants, tiendas);
    expect(report.counts.delete).toBe(3);
    const byId = new Map(report.entries.map((e) => [e.merchantId, e]));
    expect(byId.get('1')!.tiendaItemIds).toEqual([]);
    expect(byId.get('2')!.tiendaItemIds).toEqual(['t-2a']);
    expect(byId.get('3')!.tiendaItemIds).toEqual(['t-3a', 't-3b']);
    expect(byId.get('3')!.warnings?.[0]).toMatch(/2 landing pages/);
  });

  it('errors when the merchant_id does not exist', () => {
    const rows = [['1', 'X', '', '', '', '', 'Baja']];
    const report = diff(rows);
    expect(report.counts.error).toBe(1);
    expect(report.entries[0].errors?.[0]).toMatch(/no existe/);
  });
});
