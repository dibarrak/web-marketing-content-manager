import { withBase } from '@lib/base-path';
import type { MerchantOption } from '@lib/merchants';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import styles from './fields.module.scss';
import { useOutsideClose } from './useOutsideClose';

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  error?: string;
  help?: string;
}

export async function fetchMerchants(): Promise<MerchantOption[]> {
  const res = await fetch(withBase('api/merchants?requireLogo=false'));
  if (!res.ok) throw new Error(`Error ${res.status}`);
  const data = (await res.json()) as { merchants: MerchantOption[] };
  return data.merchants;
}

/**
 * Free-text merchant id field with autocomplete suggestions from the internal
 * merchant directory. Not every merchant referenced by ad banners is
 * registered there yet, so — unlike ReferenceField — this never restricts the
 * value to a catalog match: typing a raw id that isn't found is always valid.
 */
export default function MerchantIdField({ label, value, onChange, required, error, help }: Props) {
  const { data: merchants = [], isLoading } = useQuery({
    queryKey: ['merchants', 'any-logo'],
    queryFn: fetchMerchants,
    staleTime: 5 * 60 * 1000,
  });
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useOutsideClose(wrapRef, () => setOpen(false));

  const matched = useMemo(
    () => merchants.find((m) => m.merchantId === value.trim()),
    [merchants, value],
  );

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return merchants;
    return merchants.filter(
      (m) => m.name.toLowerCase().includes(q) || m.merchantId.toLowerCase().includes(q),
    );
  }, [merchants, value]);

  return (
    <div className={styles.field} ref={wrapRef}>
      <span className={styles.label}>
        {label} {required && <em className={styles.req}>*</em>}
      </span>
      <div className={styles.combo}>
        <input
          className={styles.input}
          aria-invalid={!!error}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="ID de comercio, o busca por nombre…"
        />
        {open && (
          <div className={styles.comboMenu}>
            <ul className={styles.comboList}>
              {isLoading && <li className={styles.comboEmpty}>Cargando…</li>}
              {!isLoading && filtered.length === 0 && (
                <li className={styles.comboEmpty}>
                  Sin coincidencias en el directorio — se usará el valor escrito tal cual.
                </li>
              )}
              {!isLoading &&
                filtered.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      className={m.merchantId === value.trim() ? styles.comboActive : undefined}
                      onClick={() => {
                        onChange(m.merchantId);
                        setOpen(false);
                      }}
                    >
                      {m.name} <small>({m.merchantId})</small>
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>
      {matched && <small className={styles.help}>✓ Coincide con "{matched.name}" en el directorio.</small>}
      {!matched && value.trim() && (
        <small className={styles.help}>Sin coincidencia en el directorio — se usará tal cual.</small>
      )}
      {help && !error && !matched && !value.trim() && <small className={styles.help}>{help}</small>}
      {error && <small className={styles.error}>{error}</small>}
    </div>
  );
}
