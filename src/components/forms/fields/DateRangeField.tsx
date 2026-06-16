import { useEffect, useState } from 'react';
import styles from './fields.module.scss';

/**
 * Date range field that emits `[DD/MM/YYYY] - [DD/MM/YYYY]` — the canonical
 * deployment-dates format used across the Webflow CMS schemas.
 */

interface Props {
  label: string;
  value: string;
  onChange: (next: string) => void;
  required?: boolean;
  error?: string;
  help?: string;
}

const DATE_RANGE_RE = /^\[(\d{2}\/\d{2}\/\d{4})\] - \[(\d{2}\/\d{2}\/\d{4})\]$/;

const dmyToIso = (dmy: string) => {
  const [d, m, y] = dmy.split('/');
  return `${y}-${m}-${d}`;
};
const isoToDmy = (iso: string) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

function parse(raw: string): { startIso: string; endIso: string } {
  const m = DATE_RANGE_RE.exec(raw);
  if (m) return { startIso: dmyToIso(m[1]), endIso: dmyToIso(m[2]) };
  return { startIso: '', endIso: '' };
}

export default function DateRangeField({ label, value, onChange, required, error, help }: Props) {
  const initial = parse(value);
  const [startIso, setStartIso] = useState(initial.startIso);
  const [endIso, setEndIso] = useState(initial.endIso);

  useEffect(() => {
    if (startIso && endIso) {
      onChange(`[${isoToDmy(startIso)}] - [${isoToDmy(endIso)}]`);
    } else {
      onChange('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startIso, endIso]);

  return (
    <div className={styles.field}>
      <span className={styles.label}>
        {label} {required && <em className={styles.req}>*</em>}
      </span>
      <div className={styles.dateRow}>
        <label className={styles.dateField}>
          <small>Desde</small>
          <input
            type="date"
            className={styles.input}
            value={startIso}
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
      {help && !error && <small className={styles.help}>{help}</small>}
      {error && <small className={styles.error}>{error}</small>}
    </div>
  );
}
