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
