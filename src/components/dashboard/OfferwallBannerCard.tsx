import {
  isOfferwallBannerActive,
  OFFERWALL_ACTION_LABELS,
  SEGMENT_LABELS,
  type OfferwallBannerFields,
} from '@lib/csv-modules/offerwallBanners';
import { CopyPlus, ExternalLink, SquarePen, SquareX } from 'lucide-react';
import styles from './collectionCard.module.scss';

interface Props {
  item: OfferwallBannerFields;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

function fmt(dt: string): string {
  if (!dt) return '—';
  const d = new Date(dt);
  return Number.isNaN(d.getTime()) ? dt : d.toLocaleString('es-MX');
}

export default function OfferwallBannerCard({ item, onEdit, onDelete, onDuplicate }: Props) {
  const isActive = isOfferwallBannerActive(item);

  return (
    <div className={styles.item}>
      <div className={styles.wrapper}>
        <div className={styles.body}>
          <div className={`${styles.row} ${styles.alignStart}`}>
            <div className={styles.textBlock}>
              <div className={styles.bannerImage}>
                <span className={styles.label}>Imagen</span>
                <div className={styles.imagePreviewWrap}>
                  <img
                    src={item.background_image}
                    alt=""
                    loading="lazy"
                    className={styles.bannerImageThumb}
                  />
                </div>
              </div>

              <span className={styles.label}>Título</span>
              <p>{item.title || '—'}</p>

              <span className={styles.label}>Descripción</span>
              <p>{item.description || '—'}</p>

              <span className={styles.label}>CTA</span>
              <p>{item.cta_text || '—'}</p>

              <span className={styles.label}>{OFFERWALL_ACTION_LABELS[item.action]}</span>
              {item.action === 'redirect-to-url' && (
                <p className={styles.urlRow}>
                  <span title={item.url}>{item.url}</span>
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className={styles.urlLink}>
                    <ExternalLink size={16} strokeWidth={3} />
                  </a>
                  {item.external_browser && ' (navegador externo)'}
                </p>
              )}
              {item.action === 'redirect-to-screen' && <p>{item.screen_path || '—'}</p>}
              {item.action === 'simulate-click' && <p>Sin navegación</p>}
            </div>

            <div className={styles.metaBlock}>
              <span className={styles.label}>Banner ID</span>
              <p>{item.banner_id}</p>

              <span className={styles.label}>Merchants</span>
              <p>{item.merchant_ids.join(', ') || '—'}</p>

              <span className={styles.label}>Vigencia</span>
              <p>
                {fmt(item.start_date)} — {fmt(item.end_date)}
              </p>

              <span className={styles.label}>Segmentos</span>
              <p>{item.user_segment.map((s) => SEGMENT_LABELS[s] ?? s).join(', ') || '—'}</p>

              <span className={styles.label}>Filtro</span>
              <p>{item.filter.join(', ') || '—'}</p>

              <div className={styles.bannerActions}>
                <button type="button" className={styles.duplicateBtn} onClick={onDuplicate}>
                  Duplicar <CopyPlus size={16} />
                </button>
                <button type="button" className={styles.editBtn} onClick={onEdit}>
                  Editar <SquarePen size={16} />
                </button>
                <button type="button" className={styles.deleteBtn} onClick={onDelete}>
                  Borrar <SquareX size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={`${styles.sideStatus} ${styles[isActive ? 'active' : 'inactive']}`}>
        {isActive ? 'Vigente' : 'Fuera de rango'}
      </div>
    </div>
  );
}
