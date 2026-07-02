import type { WebflowItem } from '@lib/api-client';
import { getStatus, STATUS_LABELS } from '@lib/collection-status';
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

const MAX_MERCHANTS = 5;

function DisplayValue({ value }: { value: string | undefined }) {
  if (!value || value === 'hidden') {
    return (
      <span className={`${styles.displayBadge} ${styles.displayHidden}`}>
        Oculto
      </span>
    );
  }
  // Strip brackets from "[DD/MM/YYYY] - [DD/MM/YYYY]" → "DD/MM/YYYY - DD/MM/YYYY"
  return <span className={styles.displayRange}>{value.replace(/[\[\]]/g, '')}</span>;
}

export default function CouponCard({ item, onEdit, onDelete, onDuplicate, deletingId }: Props) {
  const f = item.fieldData;
  const display = typeof f['coupon-display'] === 'string' ? f['coupon-display'] : undefined;
  const status = getStatus(display);

  const rawMerchants = f['related-merchants'];
  const merchants = Array.isArray(rawMerchants)
    ? (rawMerchants as Array<{ url?: unknown; alt?: unknown }>).filter(
        (m) => typeof m?.url === 'string',
      )
    : [];
  const visible = merchants.slice(0, MAX_MERCHANTS);
  const extra = merchants.length - MAX_MERCHANTS;

  const couponTitle =
    typeof f['coupon-title'] === 'string' ? f['coupon-title'] : '—';
  const description =
    typeof f['coupon-description'] === 'string' ? f['coupon-description'] : '—';
  const validityText =
    typeof f['coupon-validity-text'] === 'string' ? f['coupon-validity-text'] : '—';
  const lastUpdated = item.lastUpdated
    ? new Date(item.lastUpdated).toLocaleString('es-MX')
    : '—';

  return (
    <div className={styles.item}>
      <div className={styles.wrapper}>
        <div className={styles.body}>
          <div className={`${styles.row} ${styles.alignStart}`}>

            {/* Left column — main coupon data */}
            <div className={styles.textBlock}>
              <span className={styles.label}>Nombre de cupón</span>
              <p className={styles.couponName}>{f.name}</p>

              <span className={styles.label}>Título del cupón</span>
              <p>{couponTitle}</p>

              <span className={styles.label}>Descripción</span>
              <p>{description}</p>

              <span className={styles.label}>Texto vigencia</span>
              <p>{validityText}</p>

              <span className={styles.label}>Merchants relacionados</span>
              <div>
                <div className={styles.merchantsImg}>
                {visible.length === 0 && <span>—</span>}
                {visible.map((m, i) => (
                  <img
                    key={i}
                    src={m.url as string}
                    alt={typeof m.alt === 'string' ? m.alt : 'Merchant'}
                    loading="lazy"
                  />
                ))}
                {extra > 0 && (
                  <span className={styles.merchantsExtra}>+{extra}</span>
                )}
              </div>
              </div>
            </div>

            {/* Right column — metadata and actions */}
            <div className={styles.metaBlock}>
              <span className={styles.label}>Display</span>
              <DisplayValue value={display} />

              <span className={styles.label}>Slug de Webflow</span>
              <p>{f.slug}</p>

              <span className={styles.label}>Última modificación</span>
              <p>{lastUpdated}</p>

              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.duplicateBtn}
                  onClick={() => onDuplicate(item)}
                >
                  Duplicar <CopyPlus size={16} />
                </button>
                <button
                  type="button"
                  className={styles.editBtn}
                  onClick={() => onEdit(item)}
                >
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

      {/* Vertical status badge on the right edge */}
      <div className={`${styles.sideStatus} ${styles[status]}`}>
        {STATUS_LABELS[status]}
      </div>
    </div>
  );
}
