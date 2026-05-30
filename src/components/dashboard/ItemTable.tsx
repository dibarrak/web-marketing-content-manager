import type { WebflowItem } from '@lib/api-client';
import styles from './dashboard.module.scss';

export interface ColumnDef<T> {
  key: keyof T | 'name' | 'slug' | 'lastUpdated';
  label: string;
  /** When true, render the value as an image thumbnail (or a stack for arrays). */
  thumb?: boolean;
}

interface Props<T extends Record<string, unknown>> {
  items: WebflowItem<T>[];
  columns: ColumnDef<T>[];
  onEdit: (item: WebflowItem<T>) => void;
  onDelete: (item: WebflowItem<T>) => void;
  deletingId?: string;
}

function extractUrl(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') {
    // Header-image format: "{url, 150}" or "{url, auto}"
    const m = /^\{\s*([^,}\s][^,}]*?)\s*,/.exec(value);
    if (m) return m[1];
    if (/^https?:\/\//.test(value)) return value;
    return null;
  }
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    if (typeof obj.url === 'string') return obj.url;
  }
  return null;
}

function renderThumbCell(value: unknown) {
  if (Array.isArray(value)) {
    const urls = value
      .map((v) => extractUrl(v))
      .filter((u): u is string => Boolean(u))
      .slice(0, 3);
    if (urls.length === 0) return <span>—</span>;
    return (
      <span className={styles.thumbStack}>
        {urls.map((u) => (
          <img key={u} src={u} alt="" className={styles.thumb} loading="lazy" />
        ))}
        {value.length > urls.length && (
          <span className={styles.thumbExtra}>+{value.length - urls.length}</span>
        )}
      </span>
    );
  }
  const url = extractUrl(value);
  if (!url) return <span>—</span>;
  return <img src={url} alt="" className={styles.thumb} loading="lazy" />;
}

function renderTextCell(value: unknown): string {
  if (value == null) return '—';
  if (Array.isArray(value)) return `${value.length} item(s)`;
  if (typeof value === 'object') return JSON.stringify(value).slice(0, 60);
  return String(value);
}

export default function ItemTable<T extends Record<string, unknown>>({
  items,
  columns,
  onEdit,
  onDelete,
  deletingId,
}: Props<T>) {
  if (items.length === 0) {
    return (
      <p className={styles.empty}>
        Sin items todavía. Click en "Nuevo" para crear el primero.
      </p>
    );
  }
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={String(c.key)}>{c.label}</th>
            ))}
            <th aria-label="Acciones"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              {columns.map((c) => {
                const raw =
                  c.key === 'lastUpdated'
                    ? item.lastUpdated
                      ? new Date(item.lastUpdated).toLocaleString()
                      : '—'
                    : (item.fieldData as Record<string, unknown>)[c.key as string];
                return (
                  <td key={String(c.key)}>
                    {c.thumb ? renderThumbCell(raw) : renderTextCell(raw)}
                  </td>
                );
              })}
              <td className={styles.actionsCell}>
                <button type="button" onClick={() => onEdit(item)}>
                  Editar
                </button>
                <button
                  type="button"
                  className={styles.danger}
                  onClick={() => onDelete(item)}
                  disabled={deletingId === item.id}
                >
                  {deletingId === item.id ? '…' : 'Borrar'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
