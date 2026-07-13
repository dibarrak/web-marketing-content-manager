import type { WebflowItem } from '@lib/api-client';
import { CopyPlus, SquarePen, SquareX } from 'lucide-react';
import styles from './collectionCard.module.scss';

type AnyFields = Record<string, unknown> & { name: string; slug: string };

interface Props {
  item: WebflowItem<AnyFields>;
  onEdit: (item: WebflowItem<AnyFields>) => void;
  onDelete: (item: WebflowItem<AnyFields>) => void;
  onDuplicate: (item: WebflowItem<AnyFields>) => void;
  deletingId?: string;
}

function str(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '—';
  return value.trim();
}

/** Blog images come back as `{ url }`; also tolerate a plain string. */
function imageUrl(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value;
  if (value && typeof value === 'object' && 'url' in value) {
    const u = (value as { url?: string }).url;
    return u && u.trim() ? u : null;
  }
  return null;
}

export default function BlogPostCard({
  item,
  onEdit,
  onDelete,
  onDuplicate,
  deletingId,
}: Props) {
  const f = item.fieldData;
  const published = !item.isDraft && !!item.lastPublished;
  const status = published ? 'active' : 'hidden';
  const statusLabel = published ? 'Publicado' : 'Borrador';
  const lastUpdated = item.lastUpdated
    ? new Date(item.lastUpdated).toLocaleString('es-MX')
    : '—';
  const img = imageUrl(f['post-image']);
  const readingTime = f['post-reading-time'];

  return (
    <div className={styles.item}>
      <div className={styles.wrapper}>
        <div className={styles.body}>
          <div className={`${styles.row} ${styles.alignStart}`}>
            <div className={styles.textBlock}>
              <span className={styles.label}>H1</span>
              <p>
                <strong>{str(f['post-h1'])}</strong>
              </p>

              <span className={styles.label}>Meta description</span>
              <p>{str(f['post-meta-description'])}</p>

              {img && (
                <>
                  <span className={styles.label}>Imagen destacada</span>
                  <img
                    src={img}
                    alt={str(f['post-image-alt-tex'])}
                    loading="lazy"
                    className={`${styles.bannerImageThumb} ${styles.large}`}
                  />
                </>
              )}
            </div>

            <div className={`${styles.metaBlock} ${styles.noPadding}`}>
              <span className={styles.label}>Name (interno)</span>
              <p>{f.name}</p>

              <span className={styles.label}>Slug</span>
              <p>{f.slug}</p>

              {readingTime != null && (
                <>
                  <span className={styles.label}>Tiempo de lectura</span>
                  <p>{String(readingTime)} min</p>
                </>
              )}

              <span className={styles.label}>Última modificación</span>
              <p>{lastUpdated}</p>

              <div className={styles.bannerActions}>
                <button
                  type="button"
                  className={styles.duplicateBtn}
                  onClick={() => onDuplicate(item)}
                >
                  Duplicar <CopyPlus size={16} />
                </button>
                <button type="button" className={styles.editBtn} onClick={() => onEdit(item)}>
                  Editar <SquarePen size={16} />
                </button>
                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={() => onDelete(item)}
                  disabled={deletingId === item.id}
                >
                  {deletingId === item.id ? '…' : 'Borrar'} <SquareX size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={`${styles.sideStatus} ${styles[status]}`}>{statusLabel}</div>
    </div>
  );
}
