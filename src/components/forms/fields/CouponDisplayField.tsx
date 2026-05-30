import { useEffect, useState } from 'react';
import styles from './fields.module.scss';

/**
 * Coupon display field — encodes one of two states into a single string
 * compatible with the existing Webflow CMS schema:
 *   • "hidden"
 *   • "DD/MM/YYYY-DD/MM/YYYY"
 *
 * Parses on incoming `value`, emits via `onChange`.
 */

interface Props {
  label: string;
  value: string;
  onChange: (next: string) => void;
  error?: string;
  required?: boolean;
}

type Mode = 'visible' | 'hidden';

function isoToDmy(iso: string): string {
  // input <input type="date"> gives YYYY-MM-DD
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function dmyToIso(dmy: string): string {
  if (!dmy) return '';
  const [d, m, y] = dmy.split('/');
  return `${y}-${m}-${d}`;
}

const DATE_RANGE_RE = /^\[(\d{2}\/\d{2}\/\d{4})\] - \[(\d{2}\/\d{2}\/\d{4})\]$/;

function parseInitial(raw: string): { mode: Mode; startIso: string; endIso: string } {
  if (raw === 'hidden') return { mode: 'hidden', startIso: '', endIso: '' };
  const m = DATE_RANGE_RE.exec(raw);
  if (m) return { mode: 'visible', startIso: dmyToIso(m[1]), endIso: dmyToIso(m[2]) };
  return { mode: 'visible', startIso: '', endIso: '' };
}

export default function CouponDisplayField({
  label,
  value,
  onChange,
  error,
  required,
}: Props) {
  const initial = parseInitial(value);
  const [mode, setMode] = useState<Mode>(initial.mode);
  const [startIso, setStartIso] = useState(initial.startIso);
  const [endIso, setEndIso] = useState(initial.endIso);

  useEffect(() => {
    if (mode === 'hidden') {
      onChange('hidden');
      return;
    }
    if (startIso && endIso) {
      onChange(`[${isoToDmy(startIso)}] - [${isoToDmy(endIso)}]`);
    } else {
      onChange('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, startIso, endIso]);

  return (
    <div className={styles.field}>
      <span className={styles.label}>
        {label} {required && <em className={styles.req}>*</em>}
      </span>

      <div className={styles.radioGroup}>
        <label className={styles.radio}>
          <input
            type="radio"
            name={`${label}-mode`}
            checked={mode === 'visible'}
            onChange={() => setMode('visible')}
          />
          <span>Visible (rango de fechas)</span>
        </label>
        <label className={styles.radio}>
          <input
            type="radio"
            name={`${label}-mode`}
            checked={mode === 'hidden'}
            onChange={() => setMode('hidden')}
          />
          <span>Oculto</span>
        </label>
      </div>

      {mode === 'visible' && (
        <div className={styles.dateRow}>
          <label className={styles.dateField}>
            <small>Desde</small>
            <input
              type="date"
              className={styles.input}
              value={startIso}
              max={endIso || undefined}
              onChange={(e) => setStartIso(e.target.value)}
            />
          </label>
          <label className={styles.dateField}>
            <small>Hasta</small>
            <input
              type="date"
              className={styles.input}
              value={endIso}
              min={startIso || undefined}
              onChange={(e) => setEndIso(e.target.value)}
            />
          </label>
        </div>
      )}

      {error && <small className={styles.error}>{error}</small>}
    </div>
  );
}
