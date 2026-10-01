import { describe, expect, it } from 'vitest';
import { computeLongtailDiff, F, type ExistingItem } from './sync';

// Header exactly as it appears in the real export — column A's cell is a
// stray "|" (the Sheet's own row-number column), so it's never validated by
// name, only B/C/E are.
const HEADER = [
  '|',
  'Slug',
  'Merchant ID',
  'Nombre del Comercio',
  'Selector de slider',
  'AM',
  'CUPON',
  'Logo',
  'Cover',
  'Notas',
];

const merchant = (id: string, name: string): ExistingItem => ({
  id: `item-${id}`,
  fieldData: { 'merchant-id': id, name, slug: id },
});

const merchantsById = new Map<string, ExistingItem>(
  [merchant('111', 'Merchant Uno'), merchant('222', 'Merchant Dos')].map((m) => [
    String(m.fieldData['merchant-id']),
    m,
  ]),
);

function diff(rows: string[][], existing: ExistingItem[] = [], header: string[] = HEADER) {
  return computeLongtailDiff([header, ...rows], existing, merchantsById);
}

describe('computeLongtailDiff — header validation', () => {
  it('accepts the real export header, including the stray "|" in column A', () => {
    const report = diff([['1', '111-0001', '111', 'Merchant Uno', 'Exclusivos']]);
    expect(report.headerError).toBeUndefined();
    expect(report.counts.ready).toBe(1);
  });

  it('reports headerError when column C shifts position, instead of misreading data', () => {
    const badHeader = ['|', 'Merchant ID', 'Slug', 'Nombre del Comercio', 'Selector de slider'];
    const report = diff([['1', '111', '111-0001', 'Merchant Uno', 'Exclusivos']], [], badHeader);
    expect(report.headerError).toMatch(/columna/);
    expect(report.rows).toHaveLength(0);
  });

  it('reports headerError on an empty CSV', () => {
    const report = computeLongtailDiff([], [], merchantsById);
    expect(report.headerError).toBe('El CSV está vacío.');
  });
});

describe('computeLongtailDiff — row parsing', () => {
  it('skips a fully blank row', () => {
    const report = diff([['', '', '', '', '']]);
    expect(report.rows).toHaveLength(0);
  });

  it('builds the create payload from columns A/C/E plus the resolved merchant reference', () => {
    const report = diff([['3', '111-0001', '111', 'Merchant Uno', 'Exclusivos']]);
    const row = report.rows[0];
    expect(row.status).toBe('ready');
    expect(row.fieldData).toEqual({
      name: '111',
      slug: '111-0001',
      [F.orden]: 3,
      [F.comercio]: 'item-111',
      [F.selector]: '563fc2197dc26e7765233d831c465cab',
    });
  });

  it('blocks a row whose Merchant ID has no match in the Merchants collection', () => {
    const report = diff([['1', '999-0001', '999', 'Desconocido', 'Exclusivos']]);
    expect(report.rows[0].status).toBe('error');
    expect(report.rows[0].errors?.[0]).toMatch(/999.*no existe/);
  });

  it('blocks a row with an unrecognized Selector de slider value', () => {
    const report = diff([['1', '111-0001', '111', 'Merchant Uno', 'Categoría inventada']]);
    expect(report.rows[0].status).toBe('error');
    expect(report.rows[0].errors?.[0]).toMatch(/no existe en Webflow/);
  });

  it('resolves a known Sheet typo ("Accesosios") to its canonical option', () => {
    const report = diff([['1', '111-0001', '111', 'Merchant Uno', 'Moda y Accesosios']]);
    expect(report.rows[0].status).toBe('ready');
    expect(report.rows[0].selectorResolved).toBe('Moda y accesorios');
  });

  it('matches selector values ignoring accents/case drift', () => {
    const report = diff([['1', '111-0001', '111', 'Merchant Uno', 'ELECTRÓNICOS']]);
    expect(report.rows[0].status).toBe('ready');
    expect(report.rows[0].selectorResolved).toBe('Electronicos');
  });

  it('falls back to merchantId-orden when column B (Slug) is blank', () => {
    const report = diff([['5', '', '111', 'Merchant Uno', 'Exclusivos']]);
    expect(report.rows[0].status).toBe('ready');
    expect(report.rows[0].slug).toBe('111-5');
  });

  it('blocks the second row when two rows resolve to the same slug', () => {
    const report = diff([
      ['1', '111-0001', '111', 'Merchant Uno', 'Exclusivos'],
      ['2', '111-0001', '222', 'Merchant Dos', 'Exclusivos'],
    ]);
    expect(report.rows[0].status).toBe('ready');
    expect(report.rows[1].status).toBe('error');
    expect(report.rows[1].errors?.[0]).toMatch(/ya se usó en la fila 2/);
  });

  it('rejects a non-integer Orden', () => {
    const report = diff([['uno', '111-0001', '111', 'Merchant Uno', 'Exclusivos']]);
    expect(report.rows[0].status).toBe('error');
    expect(report.rows[0].errors?.[0]).toMatch(/Orden inválido/);
  });
});

describe('computeLongtailDiff — toDelete', () => {
  it('lists every existing item unconditionally, regardless of what the CSV contains', () => {
    const existing: ExistingItem[] = [
      { id: 'old-1', fieldData: { name: '111', slug: '111-old' } },
      { id: 'old-2', fieldData: { name: '222', slug: '222-old' } },
    ];
    const report = diff([['1', '111-0001', '111', 'Merchant Uno', 'Exclusivos']], existing);
    expect(report.toDelete).toEqual([
      { id: 'old-1', name: '111' },
      { id: 'old-2', name: '222' },
    ]);
  });
});
