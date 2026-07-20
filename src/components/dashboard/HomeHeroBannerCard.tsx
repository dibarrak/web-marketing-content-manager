import {
  HOME_HERO_SEGMENT_LABELS,
  isHomeHeroBannerActive,
  type HomeHeroBannerFields,
} from '@lib/csv-modules/homeHeroBanners';
import { CopyPlus, ExternalLink, SquarePen, SquareX } from 'lucide-react';
import styles from './collectionCard.module.scss';

interface Props {
  item: HomeHeroBannerFields;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

function fmtDate(d: string): string {
  if (!d) return '—';
  const parsed = new Date(`${d}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? d : parsed.toLocaleDateString('es-MX');
}

export default function HomeHeroBannerCard({ item, onEdit, onDelete, onDuplicate }: Props) {
  const isActive = isHomeHeroBannerActive(item);
  const discountBits = [
    item.discount_percentage && `${item.discount_percentage}% dto.`,
    item.discount_amount && `$${item.discount_amount} dto.`,
    item.cashback_percentage && `${item.cashback_percentage}% cashback`,
    item.cashback_amount && `$${item.cashback_amount} cashback`,
  ].filter(Boolean);

  return (
    <div className={styles.item}>
      <div className={styles.wrapper}>
        <div className={styles.body}>
          <div className={`${styles.row} ${styles.alignStart}`}>
            <div className={styles.textBlock}>
              <div className={styles.bannerImage}>
                <span className={styles.label}>Background</span>
                <div className={styles.imagePreviewWrap}>
                  <img
                    src={item.background_url}
                    alt=""
                    loading="lazy"
                    className={styles.bannerImageThumb}
                  />
                </div>
              </div>

              <span className={styles.label}>Título</span>
              <p>{item.title || '—'}</p>

              <span className={styles.label}>Subtítulo</span>
              <p>{item.subtitle || '—'}</p>

              {item.caption && (
                <>
                  <span className={styles.label}>Caption</span>
                  <p>{item.caption}</p>
                </>
              )}

              {discountBits.length > 0 && (
                <>
                  <span className={styles.label}>Descuento / cashback</span>
                  <p>{discountBits.join(' · ')}</p>
                </>
              )}

              {item.coupon && (
                <>
                  <span className={styles.label}>Cupón</span>
                  <p>
                    {item.coupon_caption} {item.coupon}
                  </p>
                </>
              )}

              {item.click_url && (
                <>
                  <span className={styles.label}>Click URL</span>
                  <p className={styles.urlRow}>
                    <span title={item.click_url}>{item.click_url}</span>
                    <a
                      href={item.click_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.urlLink}
                    >
                      <ExternalLink size={16} strokeWidth={3} />
                    </a>
                  </p>
                </>
              )}
            </div>

            <div className={styles.metaBlock}>
              <span className={styles.label}>Campaign ID</span>
              <p>{item.campaign_id}</p>

              <span className={styles.label}>Merchant</span>
              <p>{item.merchant_id || '—'}</p>

              <span className={styles.label}>Vigencia</span>
              <p>
                {fmtDate(item.start_date)} — {fmtDate(item.end_date)}
              </p>

              <span className={styles.label}>Segmentos</span>
              <p>{item.user_segment.map((s) => HOME_HERO_SEGMENT_LABELS[s] ?? s).join(', ') || '—'}</p>

              <span className={styles.label}>Template</span>
              <p>{item.template_id}</p>

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
