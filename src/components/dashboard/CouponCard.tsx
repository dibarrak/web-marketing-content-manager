import type { WebflowItem } from '@lib/api-client';
import styles from './collectionCard.module.scss';

type AnyFields = Record<string, unknown> & { name: string; slug: string };

interface Props {
  item: WebflowItem<AnyFields>;
  onEdit: (item: WebflowItem<AnyFields>) => void;
  onDelete: (item: WebflowItem<AnyFields>) => void;
  deletingId?: string;
}

type StatusKey = 'active' | 'inactive' | 'hidden';

const STATUS_LABELS: Record<StatusKey, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  hidden: 'Oculto',
};

const MAX_MERCHANTS = 5;

function getCouponStatus(display: string | undefined): StatusKey {
  if (!display || display === 'hidden') return 'hidden';
  const m = /^\[(\d{2})\/(\d{2})\/(\d{4})\] - \[(\d{2})\/(\d{2})\/(\d{4})\]$/.exec(display);
  if (!m) return 'inactive';
  const [, d1, mo1, y1, d2, mo2, y2] = m;
  const start = new Date(+y1, +mo1 - 1, +d1);
  const end = new Date(+y2, +mo2 - 1, +d2, 23, 59, 59, 999);
  const now = new Date();
  return now >= start && now <= end ? 'active' : 'inactive';
}

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

export default function CouponCard({ item, onEdit, onDelete, deletingId }: Props) {
  const f = item.fieldData;
  const display = typeof f['coupon-display'] === 'string' ? f['coupon-display'] : undefined;
  const status = getCouponStatus(display);

  const rawMerchants = f['related-merchants'];
  const merchants = Array.isArray(rawMerchants)
    ? (rawMerchants as Array<{ url?: unknown; alt?: unknown }>).filter(
        (m) => typeof m?.url === 'string',
      )
    : [];
  const visible = merchants.slice(0, MAX_MERCHANTS);
  const extra = merchants.length - MAX_MERCHANTS;

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

              <span className={styles.label}>Título</span>
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
                  className={styles.editBtn}
                  onClick={() => onEdit(item)}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={() => onDelete(item)}
                  disabled={deletingId === item.id}
                >
                  {deletingId === item.id ? '…' : 'Borrar'}
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
