import { useMemo, useRef, useState } from 'react';
import styles from './fields.module.scss';
import { useOutsideClose } from './useOutsideClose';

export interface TagOption {
  value: string;
  label: string;
}

interface Props {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  /** Known catalog to suggest from — typing a value not in here is still valid. */
  suggestions: TagOption[];
  isLoading?: boolean;
  /** Upper bound on selected tags; the input hides once reached. */
  max?: number;
  required?: boolean;
  error?: string;
  help?: string;
  placeholder?: string;
}

/**
 * Multi-value chip picker backed by a catalog of suggestions, but — like
 * MerchantIdField — never restricted to it: typing a value with no catalog
 * match is always accepted as free text.
 */
export function TagComboField({
  label,
  value,
  onChange,
  suggestions,
  isLoading,
  max,
  required,
  error,
  help,
  placeholder = 'Escribe para buscar o agregar…',
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  useOutsideClose(wrapRef, () => setOpen(false));

  const atMax = max !== undefined && value.length >= max;
  const byValue = useMemo(() => new Map(suggestions.map((s) => [s.value, s])), [suggestions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? suggestions.filter(
          (s) => s.label.toLowerCase().includes(q) || s.value.toLowerCase().includes(q),
        )
      : suggestions;
    return base.filter((s) => !value.includes(s.value));
  }, [suggestions, query, value]);

  const exactMatch = suggestions.some((s) => s.value.toLowerCase() === query.trim().toLowerCase());

  const add = (v: string) => {
    const trimmed = v.trim();
    if (!trimmed || value.includes(trimmed) || (max !== undefined && value.length >= max)) return;
    onChange([...value, trimmed]);
    setQuery('');
  };

  return (
    <div className={styles.field} ref={wrapRef}>
      <span className={styles.label}>
        {label} {required && <em className={styles.req}>*</em>}
      </span>
      {value.length > 0 && (
        <div className={styles.chips}>
          {value.map((v) => (
            <span key={v} className={styles.chip}>
              {byValue.get(v)?.label ?? v}
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== v))}
                aria-label="Quitar"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {!atMax && (
        <div className={styles.combo}>
          <input
            className={styles.input}
            aria-invalid={!!error}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && query.trim()) {
                e.preventDefault();
                add(query);
              }
            }}
            placeholder={placeholder}
          />
          {open && (
            <div className={styles.comboMenu}>
              <ul className={styles.comboList}>
                {isLoading && <li className={styles.comboEmpty}>Cargando…</li>}
                {!isLoading &&
                  filtered.map((o) => (
                    <li key={o.value}>
                      <button
                        type="button"
                        onClick={() => {
                          add(o.value);
                          setOpen(false);
                        }}
                      >
                        {o.label}
                      </button>
                    </li>
                  ))}
                {query.trim() && !exactMatch && (
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        add(query);
                        setOpen(false);
                      }}
                    >
                      Agregar "{query.trim()}"
                    </button>
                  </li>
                )}
                {!isLoading && filtered.length === 0 && !query.trim() && (
                  <li className={styles.comboEmpty}>Sin más opciones en el catálogo.</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
      {atMax && <small className={styles.help}>Máximo {max} — quita uno para agregar otro.</small>}
      {help && !error && !atMax && <small className={styles.help}>{help}</small>}
      {error && <small className={styles.error}>{error}</small>}
    </div>
  );
}
