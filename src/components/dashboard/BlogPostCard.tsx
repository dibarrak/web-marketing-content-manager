import type { SitePublishStatus, WebflowItem } from '@lib/api-client';
import { getPublishState, PUBLISH_STATE_LABELS } from '@lib/publish-state';
import { CopyPlus, SquarePen, SquareX } from 'lucide-react';
import styles from './collectionCard.module.scss';

type AnyFields = Record<string, unknown> & { name: string; slug: string };

interface Props {
  item: WebflowItem<AnyFields>;
  onEdit: (item: WebflowItem<AnyFields>) => void;
  onDelete: (item: WebflowItem<AnyFields>) => void;
  onDuplicate: (item: WebflowItem<AnyFields>) => void;
  deletingId?: string;
  /** Last time the site was actually republished (staging/production). */
  sitePublishStatus?: SitePublishStatus;
}

/**
 * "Live in the Webflow CMS" (item.isDraft/lastPublished) and "the site the
 * visitor sees has this change" are different things in Webflow — publishing
 * an item only stages it; the site itself needs a separate republish to
 * actually serve it. Compares the item's own publish timestamp against the
 * site's last recorded publish per target (see /api/sites/:siteId/publish-status).
 */
function siteLiveNote(
  item: WebflowItem<AnyFields>,
  sitePublish: SitePublishStatus | undefined,
): { text: string; tone: 'live' | 'pending' | 'loading' } | null {
  if (getPublishState(item) === 'draft') return null; // side ribbon already reads "Borrador"
  if (!sitePublish) return { text: 'Verificando estado del sitio…', tone: 'loading' };

  const itemPublishedAt = new Date(item.lastPublished!).getTime();
  const stagingLive =
    !!sitePublish.stagingPublishedAt &&
    new Date(sitePublish.stagingPublishedAt).getTime() >= itemPublishedAt;
  const prodLive =
    !!sitePublish.productionPublishedAt &&
    new Date(sitePublish.productionPublishedAt).getTime() >= itemPublishedAt;

  if (stagingLive && prodLive) return { text: 'En vivo en staging y producción', tone: 'live' };
  if (prodLive) return { text: 'En vivo en producción', tone: 'live' };
  if (stagingLive) return { text: 'En vivo en staging (falta producción)', tone: 'pending' };
  return { text: 'Pendiente de publicar el sitio', tone: 'pending' };
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
  sitePublishStatus,
}: Props) {
  const f = item.fieldData;
  const published = getPublishState(item) === 'published';
  const status = published ? 'active' : 'hidden';
  const statusLabel = PUBLISH_STATE_LABELS[published ? 'published' : 'draft'];
  const lastUpdated = item.lastUpdated
    ? new Date(item.lastUpdated).toLocaleString('es-MX')
    : '—';
  const img = imageUrl(f['post-image']);
  const readingTime = f['post-reading-time'];
  const liveNote = siteLiveNote(item, sitePublishStatus);

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

              {liveNote && (
                <>
                  <span className={styles.label}>Estado en sitio</span>
                  <p className={`${styles.siteLiveNote} ${styles[liveNote.tone]}`}>
                    {liveNote.tone === 'live' ? '✓' : liveNote.tone === 'pending' ? '⚠' : '…'}{' '}
                    {liveNote.text}
                  </p>
                </>
              )}

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
