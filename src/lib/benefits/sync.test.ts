import { describe, expect, it } from 'vitest';
import { computeDiff, mergeSource, F, type ExistingItem, type WebAppResponse } from './sync';

const item = (id: string, fields: Record<string, unknown>): ExistingItem => ({
  id,
  fieldData: { [F.merchantId]: id, name: `M${id}`, ...fields },
});

describe('mergeSource', () => {
  it('merges cupón + cashback of the same merchant into one entry', () => {
    const data: WebAppResponse = {
      ok: true,
      cupon: [{ merchantId: '1', name: 'Amazon', nombreCupon: 'A10', valor: '10%', fechaInicio: '01/07/2026', fechaFin: '31/07/2026' }],
      cashback: [{ merchantId: '1', name: 'Amazon', valor: '5%', fechaInicio: '01/07/2026', fechaFin: '31/07/2026' }],
    };
    const merged = mergeSource(data);
    expect(merged).toHaveLength(1);
    expect(merged[0].cupon?.nombre).toBe('A10');
    expect(merged[0].cashback?.valor).toBe('5%');
  });

  it('warns on duplicate coupon rows and keeps the highest value', () => {
    const data: WebAppResponse = {
      ok: true,
      cupon: [
        { merchantId: '1', name: 'A', nombreCupon: 'FIRST', valor: '10%', fechaInicio: 'x', fechaFin: 'y' },
        { merchantId: '1', name: 'A', nombreCupon: 'SECOND', valor: '20%', fechaInicio: 'x', fechaFin: 'y' },
      ],
    };
    const merged = mergeSource(data);
    expect(merged[0].cupon?.nombre).toBe('SECOND');
    expect(merged[0].warnings.length).toBe(1);
  });

  it('skips rows without merchant-id', () => {
    const data: WebAppResponse = {
      ok: true,
      cashback: [{ merchantId: '', name: 'X', valor: '5%', fechaInicio: 'x', fechaFin: 'y' }],
    };
    expect(mergeSource(data)).toHaveLength(0);
  });
});

describe('computeDiff', () => {
  it('classifies a brand-new merchant as new with full payload', () => {
    const data: WebAppResponse = {
      ok: true,
      month: 'Julio 2026',
      cupon: [{ merchantId: '9', name: 'Nuevo', nombreCupon: 'N10', valor: '10%', fechaInicio: '01/07/2026', fechaFin: '31/07/2026' }],
    };
    const report = computeDiff(data, []);
    expect(report.counts.new).toBe(1);
    const e = report.entries[0];
    expect(e.isCreate).toBe(true);
    expect(e.fieldData[F.merchantId]).toBe('9');
    expect(e.fieldData.slug).toBe('9');
    expect(e.fieldData[F.cuponSwitch]).toBe(true);
    // cashback absent → soft off in the create payload
    expect(e.fieldData[F.cashbackSwitch]).toBe(false);
  });

  it('detects a changed date and emits only the differing fields in the patch', () => {
    const existing = [
      item('1', {
        [F.cuponNombre]: 'A10',
        [F.cuponValor]: '10%',
        [F.cuponInicio]: '01/07/2026',
        [F.cuponFin]: '20/07/2026',
        [F.cuponSwitch]: true,
        [F.cashbackSwitch]: false,
      }),
    ];
    const data: WebAppResponse = {
      ok: true,
      cupon: [{ merchantId: '1', name: 'M1', nombreCupon: 'A10', valor: '10%', fechaInicio: '01/07/2026', fechaFin: '31/07/2026' }],
    };
    const report = computeDiff(data, existing);
    expect(report.counts.changed).toBe(1);
    const e = report.entries[0];
    expect(e.changes.map((c) => c.field)).toEqual([F.cuponFin]);
    expect(e.fieldData).toEqual({ [F.cuponFin]: '31/07/2026' });
  });

  it('marks an identical merchant as unchanged (empty patch)', () => {
    const existing = [
      item('1', {
        [F.cuponNombre]: 'A10',
        [F.cuponValor]: '10%',
        [F.cuponInicio]: '01/07/2026',
        [F.cuponFin]: '31/07/2026',
        [F.cuponSwitch]: true,
        [F.cashbackSwitch]: false,
      }),
    ];
    const data: WebAppResponse = {
      ok: true,
      cupon: [{ merchantId: '1', name: 'M1', nombreCupon: 'A10', valor: '10%', fechaInicio: '01/07/2026', fechaFin: '31/07/2026' }],
    };
    const report = computeDiff(data, existing);
    expect(report.counts.unchanged).toBe(1);
    expect(report.entries[0].changes).toHaveLength(0);
  });

  it('turns off switches for a merchant no longer in the source', () => {
    const existing = [item('7', { [F.cuponSwitch]: true, [F.cashbackSwitch]: true })];
    const report = computeDiff({ ok: true, cupon: [] }, existing);
    expect(report.counts.out_of_source).toBe(1);
    const e = report.entries[0];
    expect(e.fieldData).toEqual({ [F.cuponSwitch]: false, [F.cashbackSwitch]: false });
  });

  it('ignores out-of-source merchants whose switches are already off', () => {
    const existing = [item('7', { [F.cuponSwitch]: false, [F.cashbackSwitch]: false })];
    const report = computeDiff({ ok: true, cupon: [] }, existing);
    expect(report.entries).toHaveLength(0);
  });

  it('keeps the highest-value promotion on duplicate source rows', () => {
    const data: WebAppResponse = {
      ok: true,
      cupon: [
        { merchantId: '1', name: 'A', nombreCupon: 'LOW', valor: '10%', fechaInicio: 'x', fechaFin: 'y' },
        { merchantId: '1', name: 'A', nombreCupon: 'HIGH', valor: '25%', fechaInicio: 'x', fechaFin: 'y' },
        { merchantId: '1', name: 'A', nombreCupon: 'MID', valor: '15%', fechaInicio: 'x', fechaFin: 'y' },
      ],
    };
    const merged = mergeSource(data);
    expect(merged[0].cupon?.nombre).toBe('HIGH');
    expect(merged[0].cupon?.valor).toBe('25%');
  });

  it('never modifies a draft item and marks it as draft', () => {
    const existing: ExistingItem[] = [
      {
        id: 'd1',
        isDraft: true,
        fieldData: { [F.merchantId]: '1', name: 'M1', [F.cuponSwitch]: false, [F.cashbackSwitch]: false },
      },
    ];
    const data: WebAppResponse = {
      ok: true,
      cupon: [{ merchantId: '1', name: 'M1', nombreCupon: 'X', valor: '10%', fechaInicio: 'a', fechaFin: 'b' }],
    };
    const report = computeDiff(data, existing);
    expect(report.counts.draft).toBe(1);
    const e = report.entries[0];
    expect(e.status).toBe('draft');
    expect(e.fieldData).toEqual({}); // nothing to apply
  });

  it('does not turn off switches on a draft that is absent from the source', () => {
    const existing: ExistingItem[] = [
      { id: 'd1', isDraft: true, fieldData: { [F.merchantId]: '7', name: 'M7', [F.cuponSwitch]: true } },
    ];
    const report = computeDiff({ ok: true, cupon: [] }, existing);
    expect(report.entries).toHaveLength(0);
  });

  it('preserves promoción especial / referencia by never including them in the patch', () => {
    const existing = [
      item('1', {
        [F.cuponSwitch]: false,
        [F.cashbackSwitch]: false,
        'mostrar-promocion': true,
        'referencia-landing-2': 'ref-123',
      }),
    ];
    const data: WebAppResponse = {
      ok: true,
      cashback: [{ merchantId: '1', name: 'M1', valor: '5%', fechaInicio: '01/07/2026', fechaFin: '31/07/2026' }],
    };
    const report = computeDiff(data, existing);
    const e = report.entries[0];
    expect(Object.keys(e.fieldData)).not.toContain('mostrar-promocion');
    expect(Object.keys(e.fieldData)).not.toContain('referencia-landing-2');
    // cashback turned on
    expect(e.fieldData[F.cashbackSwitch]).toBe(true);
  });
});
