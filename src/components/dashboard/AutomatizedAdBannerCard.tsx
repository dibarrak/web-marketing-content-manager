import type { WebflowItem } from '@lib/api-client';
import { parseSiteTarget } from '@lib/ad-banners';
import { getStatus, STATUS_LABELS } from '@lib/collection-status';
import { CopyPlus, ExternalLink, GlobeCheck, SquarePen, SquareX } from 'lucide-react';
import styles from './collectionCard.module.scss';
import PublishStateBadge from './PublishStateBadge';

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

function Html({ value }: { value: unknown }) {
  if (typeof value !== 'string' || !value.trim()) return <span>—</span>;
  return <div className={styles.richText} dangerouslySetInnerHTML={{ __html: value }} />;
}

function Thumb({ value, alt }: { value: unknown; alt: string }) {
  if (typeof value === 'string' && value.trim()) {
    return <img src={value} alt={alt} loading="lazy" className={styles.bannerImageThumb} />;
  }
  return <span className={`${styles.bannerImageThumb} ${styles.noImage}`} />;
}

const yesNo = (v: unknown) => (v === true ? 'Sí' : 'No');

export default function AutomatizedAdBannerCard({
  item,
  onEdit,
  onDelete,
  onDuplicate,
  deletingId,
}: Props) {
  const f = item.fieldData;
  const display = typeof f['show-dates'] === 'string' ? f['show-dates'] : undefined;
  const status = getStatus(display);
  const lastUpdated = item.lastUpdated ? new Date(item.lastUpdated).toLocaleString('es-MX') : '—';
  const sites = parseSiteTarget(typeof f['site-target'] === 'string' ? f['site-target'] : '');
  const href = typeof f.href === 'string' ? f.href : '';

  return (
    <div className={styles.item}>
      <div className={styles.wrapper}>
        <div className={styles.body}>
          <div className={`${styles.row} ${styles.alignStart}`}>
            {/* Left column — content and images */}
            <div className={styles.textBlock}>
              <span className={styles.label}>Título</span>
              <div>
                <Html value={f.title} />
              </div>

              <span className={styles.label}>Cuerpo</span>
              <div>
                <Html value={f.body} />
              </div>

              <span className={styles.label}>Cupón</span>
              <p>
                {str(f['coupon-label'])} {str(f.coupon)}
              </p>

              <span className={styles.label}>CTA</span>
              <p>{str(f.cta)}</p>

              <div className={styles.bannerImages}>
                <div className={styles.bannerImage}>
                  <span className={styles.label}>
                    Imagen{f['image-wide'] === true ? ' (ancha)' : ''}
                  </span>
                  <Thumb value={f['image-2']} alt={str(f['image-alt'])} />
                </div>
                <div className={styles.bannerImage}>
                  <span className={styles.label}>Logo</span>
                  <Thumb value={f['logo-2']} alt={str(f['logo-alt'])} />
                </div>
              </div>
            </div>

            {/* Right column — operational data */}
            <div className={`${styles.metaBlock} ${styles.bannerMeta}`}>
              <span className={styles.label}>Publicación</span>
              <PublishStateBadge item={item} />

              <span className={styles.label}>Sitios de destino</span>
              <p className={styles.siteTargetWrapper}>
                <span className={styles.siteTarget}>
                  {sites.length === 0 ? '—' : sites[0] === 'all' ? 'Todos' : sites.join(', ')}
                </span>
                <GlobeCheck size={16} />
              </p>

              <span className={styles.label}>Vigencia</span>
              {!display || display === 'hidden' ? (
                <p>
                  <span className={`${styles.displayBadge} ${styles.displayHidden}`}>Oculto</span>
                </p>
              ) : (
                <p className={styles.displayRange}>
                  {display === 'always' ? 'Siempre' : display.replace(/[[\]]/g, '')}
                </p>
              )}

              <span className={styles.label}>Enlace</span>
              <p className={styles.urlRow}>
                <span title={href || undefined}>{str(href)}</span>
                {href && (
                  <a href={href} target="_blank" rel="noopener noreferrer" className={styles.urlLink}>
                    <ExternalLink size={16} strokeWidth={3} />
                  </a>
                )}
              </p>
              <p>Pestaña nueva: {yesNo(f['new-tab'])}</p>

              <span className={styles.label}>Track</span>
              <p>{str(f.track)}</p>

              {f['slide-order'] != null && (
                <>
                  <span className={styles.label}>Slide order</span>
                  <p>{String(f['slide-order'])}</p>
                </>
              )}

              <span className={styles.label}>Nombre</span>
              <p>{f.name}</p>

              <span className={styles.label}>Slug de Webflow</span>
              <p>{f.slug}</p>

              <span className={styles.label}>Última modificación</span>
              <p>{lastUpdated}</p>

              <div className={styles.bannerActions}>
                <button type="button" className={styles.duplicateBtn} onClick={() => onDuplicate(item)}>
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

      <div className={`${styles.sideStatus} ${styles[status]}`}>{STATUS_LABELS[status]}</div>
    </div>
  );
}
