import { type WebflowItem } from '@lib/api-client';
import { referenceCollectionId } from '@lib/config/sites';
import { MERCHANT_TYPE_LABELS } from '@lib/featured-merchants';
import { useReferenceOptions } from '@lib/reference-options';
import { CopyPlus, SquarePen, SquareX } from 'lucide-react';
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

/** Resolves a Reference field's stored item id to its name. */
function useReferenceName(fieldSlug: string, id: unknown): string {
  const { data: options = [], isLoading } = useReferenceOptions(
    referenceCollectionId('featuredMerchants', fieldSlug),
  );
  if (typeof id !== 'string' || !id) return '—';
  if (isLoading) return 'Cargando…';
  // Fall back to the raw id when the referenced item was deleted in Webflow.
  return options.find((o) => o.id === id)?.name ?? id;
}

export default function FeaturedMerchantCard({
  item,
  onEdit,
  onDelete,
  onDuplicate,
  deletingId,
}: Props) {
  const f = item.fieldData;
  const merchantName = useReferenceName('nombre-del-comercio', f['nombre-del-comercio']);
  const categoryName = useReferenceName('categoria', f['categoria']);
  const tipo = typeof f['tipo-de-comercio'] === 'string' ? f['tipo-de-comercio'] : '';
  const lastUpdated = item.lastUpdated
    ? new Date(item.lastUpdated).toLocaleString('es-MX')
    : '—';

  return (
    <div className={styles.item}>
      <div className={styles.wrapper}>
        <div className={styles.body}>
          <div className={`${styles.row} ${styles.alignStart}`}>
            {/* Left column — what the item points at */}
            <div className={styles.textBlock}>
              <span className={styles.label}>Nombre del comercio</span>
              <p className={styles.couponName}>{merchantName}</p>

              <span className={styles.label}>Categoría</span>
              <p>{categoryName}</p>

              <span className={styles.label}>Tipo de comercio</span>
              <p>{tipo ? (MERCHANT_TYPE_LABELS[tipo] ?? tipo) : '—'}</p>
            </div>

            {/* Right column — metadata and actions */}
            <div className={styles.metaBlock}>
              <span className={styles.label}>Publicación</span>
              <PublishStateBadge item={item} />

              <span className={styles.label}>Orden</span>
              <p>{f.orden != null ? String(f.orden) : '—'}</p>

              <span className={styles.label}>Merchant ID</span>
              <p>{f.name}</p>

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
    </div>
  );
}
