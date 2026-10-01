import { describe, expect, it } from 'vitest';
import { computeFeaturedDiff, F, type ExistingItem } from './sync';

// Header as in the real export: A is blank, G carries a line break.
const HEADER = [
  '',
  'Slug',
  'Merchant ID',
  'Nombre del Comercio',
  'Nombre del comercio (webflow)',
  'Categoria',
  '(-) \nCategoría guía',
  'Tipo de Comercio',
  '(-) \nDivisión ',
];

const item = (id: string, fieldData: Record<string, unknown>): ExistingItem => ({ id, fieldData });

const merchantsById = new Map<string, ExistingItem>([
  ['111', item('m-111', { 'merchant-id': '111', name: 'Merchant Uno' })],
  ['222', item('m-222', { 'merchant-id': '222', name: 'Merchant Dos' })],
  ['333', item('m-333', { 'merchant-id': '333', name: 'Merchant Tres' })],
]);

const categoriesBySlug = new Map<string, ExistingItem>([
  ['auto', item('c-auto', { slug: 'auto', name: 'Auto' })],
  ['hogar-y-muebles', item('c-hogar', { slug: 'hogar-y-muebles', name: 'Hogar y Muebles' })],
]);

/** Builds a data row: [orden, slug, merchantId, _, _, F(legacy), G(guía), H(tipo), _]. */
const row = (orden: string, slug: string, mid: string, guia: string, tipo = 'en-linea') => [
  orden, slug, mid, '', '', 'legacy', guia, tipo, 'AM',
];

function diff(rows: string[][], existing: ExistingItem[] = [], header: string[] = HEADER) {
  return computeFeaturedDiff([header, ...rows], existing, merchantsById, categoriesBySlug);
}

describe('header validation', () => {
  it('accepts the real header, including the multi-line "Categoría guía" cell', () => {
    const report = diff([row('1', '111-a', '111', 'auto')]);
    expect(report.headerError).toBeUndefined();
    expect(report.counts.ready).toBe(1);
  });

  it('reports headerError when a column shifts', () => {
    const bad = [...HEADER];
    [bad[6], bad[7]] = [bad[7], bad[6]];
    const report = diff([row('1', '111-a', '111', 'auto')], [], bad);
    expect(report.headerError).toMatch(/G, H/);
    expect(report.rows).toHaveLength(0);
  });

  it('reports headerError on an empty CSV', () => {
    expect(computeFeaturedDiff([], [], merchantsById, categoriesBySlug).headerError).toBe(
      'El CSV está vacío.',
    );
  });
});

describe('row resolution', () => {
  it('uses column G (not F) for the category and writes resolved references', () => {
    const [r] = diff([row('1', '111-a', '111', 'hogar-y-muebles')]).rows;
    expect(r.status).toBe('ready');
    expect(r.fieldData).toMatchObject({
      name: '111',
      slug: '111-a',
      [F.comercio]: 'm-111',
      [F.categoria]: 'c-hogar',
      [F.tipo]: 'df0c640811023e03f6ceff67d507f234',
    });
  });

  it('matches "en-linea; tienda-fisica" exactly and aliases "en-linea-y-en-tienda-fisica"', () => {
    const report = diff([
      row('1', 'a', '111', 'auto', 'en-linea; tienda-fisica'),
      row('2', 'b', '222', 'auto', 'en-linea-y-en-tienda-fisica'),
    ]);
    const ids = report.rows.map((r) => r.fieldData?.[F.tipo]);
    expect(ids).toEqual(['d78cf16f0b7983a0f205cdee5382194d', 'd78cf16f0b7983a0f205cdee5382194d']);
  });

  it('blocks unknown merchant, category and tipo', () => {
    const [m, c, t] = diff([
      row('1', 'a', '999', 'auto'),
      row('2', 'b', '111', 'nope'),
      row('3', 'c', '111', 'auto', 'raro'),
    ]).rows;
    expect(m.errors?.[0]).toMatch(/Merchants/);
    expect(c.errors?.[0]).toMatch(/categoría/);
    expect(t.errors?.[0]).toMatch(/Tipo de Comercio/);
  });

  it('blocks a slug repeated inside the file', () => {
    const report = diff([row('1', 'dup', '111', 'auto'), row('2', 'dup', '222', 'auto')]);
    expect(report.rows[1].errors?.[0]).toMatch(/fila 2/);
  });

  it('skips fully blank rows', () => {
    expect(diff([['', '', '', '', '', '', '', '', '']]).rows).toHaveLength(0);
  });
});

describe('orden re-numbering', () => {
  it('renumbers 1..N per category following column A, ignoring gaps and error rows', () => {
    const report = diff([
      row('8', 'a', '111', 'auto'),
      row('1', 'b', '222', 'hogar-y-muebles'),
      row('3', 'x', '999', 'auto'), // error row — must not take a number
      row('13', 'c', '333', 'auto'),
      row('2', 'd', '222', 'auto'),
    ]);
    const ordenOf = (slug: string) => report.rows.find((r) => r.slug === slug)?.fieldData?.[F.orden];
    expect(ordenOf('d')).toBe(1); // CSV 2
    expect(ordenOf('a')).toBe(2); // CSV 8
    expect(ordenOf('c')).toBe(3); // CSV 13
    expect(ordenOf('b')).toBe(1); // other category restarts
    expect(report.rows.find((r) => r.slug === 'x')?.orden).toBeNull();
  });
});

describe('warnings and deletion list', () => {
  it('warns (without blocking) when a Merchant ID repeats', () => {
    const report = diff([row('1', 'a', '111', 'auto'), row('1', 'b', '111', 'hogar-y-muebles')]);
    expect(report.counts).toEqual({ ready: 2, error: 0 });
    expect(report.warningCount).toBe(2);
    expect(report.rows[0].warnings?.[0]).toMatch(/fila 3/);
  });

  it('lists every existing item for deletion', () => {
    const report = diff([row('1', 'a', '111', 'auto')], [item('old', { name: '555' })]);
    expect(report.toDelete).toEqual([{ id: 'old', name: '555' }]);
  });
});
