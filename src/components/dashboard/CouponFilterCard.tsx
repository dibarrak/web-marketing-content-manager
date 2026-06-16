import type { WebflowItem } from '@lib/api-client';
import styles from './collectionCard.module.scss';

type AnyFields = Record<string, unknown> & { name: string; slug: string };

interface Props {
  item: WebflowItem<AnyFields>;
  onEdit: (item: WebflowItem<AnyFields>) => void;
  onDelete: (item: WebflowItem<AnyFields>) => void;
  onDuplicate: (item: WebflowItem<AnyFields>) => void;
  deletingId?: string;
}

type StatusKey = 'active' | 'inactive' | 'hidden';

const STATUS_LABELS: Record<StatusKey, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  hidden: 'Oculto',
};

function getStatus(display: string | undefined): StatusKey {
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
  return <span className={styles.displayRange}>{value.replace(/[\[\]]/g, '')}</span>;
}

export default function CouponFilterCard({ item, onEdit, onDelete, onDuplicate, deletingId }: Props) {
  const f = item.fieldData;
  const display = typeof f['coupon-display'] === 'string' ? f['coupon-display'] : undefined;
  const status = getStatus(display);
  const lastUpdated = item.lastUpdated
    ? new Date(item.lastUpdated).toLocaleString('es-MX')
    : '—';

  return (
    <div className={styles.item}>
      <div className={styles.wrapper}>
        <div className={styles.body}>
          <div className={`${styles.row} ${styles.alignStart}`}>

            {/* Left column — name and display */}
            <div className={styles.textBlock}>
              <span className={styles.label}>Nombre</span>
              <p className={styles.couponName}>{f.name}</p>

              <span className={styles.label}>Display</span>
              <DisplayValue value={display} />
            </div>

            {/* Right column — metadata and actions */}
            <div className={styles.metaBlock}>
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
                  Duplicar
                </button>
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
