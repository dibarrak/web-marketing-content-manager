import { listReferenceItems, type ReferenceOption } from '@lib/api-client';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useRef, useState, useEffect } from 'react';
import styles from './fields.module.scss';

interface BaseProps {
  label: string;
  /** Collection whose items populate the picker. */
  refCollectionId: string;
  required?: boolean;
  error?: string;
  help?: string;
}

function useReferenceOptions(refCollectionId: string) {
  return useQuery({
    queryKey: ['reference-items', refCollectionId],
    queryFn: () => listReferenceItems(refCollectionId),
    staleTime: 5 * 60 * 1000, // options change rarely; cache for the session
  });
}

/** Close the dropdown when clicking outside `ref`. */
function useOutsideClose(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, onClose]);
}

/* ------------------------------- single ------------------------------- */

interface SingleProps extends BaseProps {
  value: string | null;
  onChange: (id: string | null) => void;
}

export function ReferenceField({
  label,
  refCollectionId,
  value,
  onChange,
  required,
  error,
  help,
}: SingleProps) {
  const { data: options = [], isLoading, isError } = useReferenceOptions(refCollectionId);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  useOutsideClose(wrapRef, () => setOpen(false));

  const selected = useMemo(() => options.find((o) => o.id === value) ?? null, [options, value]);
  const filtered = useMemo(
    () => options.filter((o) => o.name.toLowerCase().includes(query.toLowerCase())),
    [options, query],
  );

  return (
    <div className={styles.field} ref={wrapRef}>
      <span className={styles.label}>
        {label} {required && <em className={styles.req}>*</em>}
      </span>
      <div className={styles.combo}>
        <button
          type="button"
          className={styles.input}
          aria-invalid={!!error}
          onClick={() => setOpen((v) => !v)}
          style={{ textAlign: 'left', cursor: 'pointer' }}
        >
          {isLoading
            ? 'Cargando…'
            : isError
              ? 'Error al cargar opciones'
              : (selected?.name ?? '— Seleccionar —')}
        </button>
        {selected && !required && (
          <button
            type="button"
            className={styles.comboClear}
            onClick={() => onChange(null)}
            aria-label="Quitar selección"
          >
            ×
          </button>
        )}
        {open && !isLoading && !isError && (
          <div className={styles.comboMenu}>
            <input
              className={styles.comboSearch}
              placeholder="Buscar…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <ul className={styles.comboList}>
              {filtered.length === 0 && <li className={styles.comboEmpty}>Sin resultados</li>}
              {filtered.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    className={o.id === value ? styles.comboActive : undefined}
                    onClick={() => {
                      onChange(o.id);
                      setOpen(false);
                      setQuery('');
                    }}
                  >
                    {o.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {help && !error && <small className={styles.help}>{help}</small>}
      {error && <small className={styles.error}>{error}</small>}
    </div>
  );
}

/* -------------------------------- multi ------------------------------- */

interface MultiProps extends BaseProps {
  value: string[];
  onChange: (ids: string[]) => void;
}

export function MultiReferenceField({
  label,
  refCollectionId,
  value,
  onChange,
  required,
  error,
  help,
}: MultiProps) {
  const { data: options = [], isLoading, isError } = useReferenceOptions(refCollectionId);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  useOutsideClose(wrapRef, () => setOpen(false));

  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const filtered = useMemo(
    () => options.filter((o) => o.name.toLowerCase().includes(query.toLowerCase())),
    [options, query],
  );

  const toggle = (o: ReferenceOption) => {
    onChange(value.includes(o.id) ? value.filter((id) => id !== o.id) : [...value, o.id]);
  };

  return (
    <div className={styles.field} ref={wrapRef}>
      <span className={styles.label}>
        {label} {required && <em className={styles.req}>*</em>}
      </span>
      {value.length > 0 && (
        <div className={styles.chips}>
          {value.map((id) => (
            <span key={id} className={styles.chip}>
              {byId.get(id)?.name ?? id}
              <button
                type="button"
                onClick={() => onChange(value.filter((v) => v !== id))}
                aria-label="Quitar"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className={styles.combo}>
        <button
          type="button"
          className={styles.input}
          aria-invalid={!!error}
          onClick={() => setOpen((v) => !v)}
          style={{ textAlign: 'left', cursor: 'pointer' }}
        >
          {isLoading ? 'Cargando…' : isError ? 'Error al cargar opciones' : '+ Agregar…'}
        </button>
        {open && !isLoading && !isError && (
          <div className={styles.comboMenu}>
            <input
              className={styles.comboSearch}
              placeholder="Buscar…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <ul className={styles.comboList}>
              {filtered.length === 0 && <li className={styles.comboEmpty}>Sin resultados</li>}
              {filtered.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    className={value.includes(o.id) ? styles.comboActive : undefined}
                    onClick={() => toggle(o)}
                  >
                    <span aria-hidden>{value.includes(o.id) ? '☑' : '☐'}</span> {o.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {help && !error && <small className={styles.help}>{help}</small>}
      {error && <small className={styles.error}>{error}</small>}
    </div>
  );
}
