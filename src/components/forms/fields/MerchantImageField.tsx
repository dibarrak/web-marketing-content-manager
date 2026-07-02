import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { withBase } from '@lib/base-path';
import type { MerchantOption } from '@lib/merchants';
import ImageDropzone, { type UploadedImage } from './ImageDropzone';
import styles from './MerchantImageField.module.scss';

interface Props {
  label: string;
  collectionId: string;
  value: UploadedImage[];
  onChange: (next: UploadedImage[]) => void;
  maxDimension?: number;
  required?: boolean;
  error?: string;
  help?: string;
}

/**
 * Logo field for coupons with two sources: upload a file (delegated to
 * ImageDropzone) or pick a logo from the merchants directory. Both append to
 * the same {url, alt}[] value, so ImageDropzone's preview grid and remove
 * buttons cover images from either source. Picking a merchant stores an
 * immutable snapshot ({url: logo, alt: name}); it does not link to the record.
 */
export default function MerchantImageField({
  label,
  collectionId,
  value,
  onChange,
  maxDimension,
  required,
  error,
  help,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  // Keep the latest value so rapid picks append against fresh state.
  const valueRef = useRef(value);
  valueRef.current = value;

  const addMerchant = (m: MerchantOption) => {
    if (valueRef.current.some((img) => img.url === m.logoUrl)) return; // no duplicates
    const next = [...valueRef.current, { url: m.logoUrl, alt: m.name }];
    valueRef.current = next;
    onChange(next);
  };

  return (
    <div className={styles.wrapper}>
      <ImageDropzone
        label={label}
        collectionId={collectionId}
        value={value}
        onChange={onChange}
        multiple
        maxDimension={maxDimension}
        required={required}
        error={error}
        help={help}
      />

      <div className={styles.pickerBar}>
        <span className={styles.orLabel}>o</span>
        <button
          type="button"
          className={styles.pickBtn}
          onClick={() => setPickerOpen(true)}
        >
          Elegir de comercios
        </button>
      </div>

      {pickerOpen && (
        <MerchantPicker
          selectedUrls={new Set(value.map((v) => v.url))}
          onPick={addMerchant}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

function MerchantPicker({
  selectedUrls,
  onPick,
  onClose,
}: {
  selectedUrls: Set<string>;
  onPick: (m: MerchantOption) => void;
  onClose: () => void;
}) {
  const [merchants, setMerchants] = useState<MerchantOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(withBase('api/merchants'));
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data = (await res.json()) as { merchants: MerchantOption[] };
        if (!cancelled) setMerchants(data.merchants);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error cargando comercios.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const q = query.trim().toLowerCase();
  const visible = q
    ? merchants.filter(
        (m) => m.name.toLowerCase().includes(q) || m.merchantId.toLowerCase().includes(q),
      )
    : merchants;

  // Portal to <body> so the fixed backdrop escapes the coupon FormModal, whose
  // GSAP transform would otherwise become the containing block for position:
  // fixed — clipping the dialog and creating a nested scroll.
  return createPortal(
    <div className={styles.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.dialog}>
        <div className={styles.dialogHeader}>
          <h3>Elegir comercios</h3>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <input
          className={styles.search}
          type="search"
          placeholder="Buscar por nombre o ID…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />

        <div className={styles.body}>
          {error && <p className={styles.error}>{error}</p>}

          {loading ? (
            <p className={styles.hint}>Cargando…</p>
          ) : visible.length === 0 ? (
            <p className={styles.hint}>
              {merchants.length === 0
                ? 'No hay comercios registrados. Un super-admin puede agregarlos en la sección Comercios.'
                : 'Sin resultados.'}
            </p>
          ) : (
            <div className={styles.grid}>
              {visible.map((m) => {
                const added = selectedUrls.has(m.logoUrl);
                return (
                  <button
                    key={m.id}
                    type="button"
                    className={`${styles.card} ${added ? styles.cardAdded : ''}`}
                    disabled={added}
                    onClick={() => onPick(m)}
                    title={m.name}
                  >
                    <div className={styles.cardLogo}>
                      <img src={m.logoUrl} alt={m.name} />
                    </div>
                    <span className={styles.cardName}>{m.name}</span>
                    {added && <span className={styles.addedTag}>Agregado</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className={styles.dialogActions}>
          <button type="button" className={styles.doneBtn} onClick={onClose}>
            Listo
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
