import { isAdBannerActive, SEGMENT_LABELS, type AdBannerFields } from '@lib/csv-modules/adBanners';
import { CopyPlus, ExternalLink, SquarePen, SquareX } from 'lucide-react';
import styles from './collectionCard.module.scss';

interface Props {
  item: AdBannerFields;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

function fmt(dt: string): string {
  if (!dt) return '—';
  const d = new Date(dt);
  return Number.isNaN(d.getTime()) ? dt : d.toLocaleString('es-MX');
}

export default function AdBannerCard({ item, onEdit, onDelete, onDuplicate }: Props) {
  const isActive = isAdBannerActive(item);

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
                    src={item.image_url}
                    alt=""
                    loading="lazy"
                    className={styles.bannerImageThumb}
                  />
                </div>
              </div>

              <span className={styles.label}>Click URL</span>
              <p className={styles.urlRow}>
                <span title={item.click_url}>{item.click_url}</span>
                <a href={item.click_url} target="_blank" rel="noopener noreferrer" className={styles.urlLink}>
                  <ExternalLink size={16} strokeWidth={3} />
                </a>
              </p>
            </div>

            <div className={styles.metaBlock}>
              <span className={styles.label}>ID</span>
              <p>{item.id}</p>

              <span className={styles.label}>Merchant</span>
              <p>{item.merchant_id}</p>

              <span className={styles.label}>Vigencia</span>
              <p>
                {fmt(item.start_date)} — {fmt(item.end_date)}
              </p>

              <span className={styles.label}>Segmentos</span>
              <p>{item.user_segment.map((s) => SEGMENT_LABELS[s] ?? s).join(', ') || '—'}</p>

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
