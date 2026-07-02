import { useEffect, useRef, useState } from 'react';
import { withBase } from '@lib/base-path';
import type { Merchant } from '@lib/merchants';
import styles from './MerchantsAdmin.module.scss';

const api = (path = '') => withBase(`api/admin/merchants${path}`);

interface Props {
  /** Webflow site where merchant logos are uploaded. */
  siteId: string;
}

export default function MerchantsAdmin({ siteId }: Props) {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Merchant | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(api());
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = (await res.json()) as { merchants: Merchant[] };
      setMerchants(data.merchants);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando comercios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const q = query.trim().toLowerCase();
  const visible = q
    ? merchants.filter(
        (m) =>
          m.name.toLowerCase().includes(q) || m.merchantId.toLowerCase().includes(q),
      )
    : merchants;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Comercios</h1>
        <button type="button" className={styles.primary} onClick={() => setCreating(true)}>
          Agregar comercio
        </button>
      </header>

      <input
        className={styles.search}
        type="search"
        placeholder="Buscar por nombre o ID…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {error && <div className={styles.errorBanner}>{error}</div>}

      {loading ? (
        <p>Cargando…</p>
      ) : visible.length === 0 ? (
        <p className={styles.empty}>
          {merchants.length === 0 ? 'Aún no hay comercios.' : 'Sin resultados.'}
        </p>
      ) : (
        <div className={styles.list}>
          {visible.map((m) => (
            <div key={m.id} className={styles.row}>
              <div className={styles.logoThumb}>
                {m.logoUrl ? <img src={m.logoUrl} alt={m.name} /> : <span>—</span>}
              </div>
              <div className={styles.identity}>
                <strong>{m.name}</strong>
                <span className={styles.merchantId}>ID: {m.merchantId}</span>
              </div>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => setEditing(m)}
                >
                  Editar
                </button>
                <DeleteButton merchant={m} onDeleted={load} />
              </div>
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <MerchantModal
          siteId={siteId}
          merchant={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            void load();
          }}
        />
      )}
    </main>
  );
}

function DeleteButton({ merchant, onDeleted }: { merchant: Merchant; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    if (
      !confirm(
        `¿Eliminar "${merchant.name}"? Los cupones que ya usan su logo no se verán afectados.`,
      )
    )
      return;
    setBusy(true);
    try {
      const res = await fetch(api(`/${merchant.id}`), { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `Error ${res.status}`);
      }
      onDeleted();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error eliminando.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" className={styles.danger} disabled={busy} onClick={remove}>
      Eliminar
    </button>
  );
}

function MerchantModal({
  siteId,
  merchant,
  onClose,
  onSaved,
}: {
  siteId: string;
  merchant: Merchant | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [merchantId, setMerchantId] = useState(merchant?.merchantId ?? '');
  const [name, setName] = useState(merchant?.name ?? '');
  const [logoUrl, setLogoUrl] = useState(merchant?.logoUrl ?? '');
  const [logoAssetId, setLogoAssetId] = useState<string | null>(merchant?.logoAssetId ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!merchant;

  const submit = async () => {
    setError(null);
    if (!merchantId.trim() || !name.trim()) {
      setError('El ID y el nombre son requeridos.');
      return;
    }
    if (!logoUrl) {
      setError('Sube un logo.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(isEdit ? api(`/${merchant!.id}`) : api(), {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchantId: merchantId.trim(), name: name.trim(), logoUrl, logoAssetId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `Error ${res.status}`);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error guardando.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={styles.modalBackdrop}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={styles.modalCard}>
        <h2>{isEdit ? 'Editar comercio' : 'Agregar comercio'}</h2>

        <label className={styles.field}>
          <span>ID de comercio</span>
          <input value={merchantId} onChange={(e) => setMerchantId(e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>Nombre</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <div className={styles.field}>
          <span>Logo</span>
          <LogoUpload
            siteId={siteId}
            logoUrl={logoUrl}
            alt={name}
            onUploaded={(asset) => {
              setLogoUrl(asset.url);
              setLogoAssetId(asset.id);
            }}
            onError={setError}
          />
        </div>

        {error && <p className={styles.rowError}>{error}</p>}

        <div className={styles.modalActions}>
          <button type="button" className={styles.secondary} onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className={styles.primary} disabled={saving} onClick={submit}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function LogoUpload({
  siteId,
  logoUrl,
  alt,
  onUploaded,
  onError,
}: {
  siteId: string;
  logoUrl: string;
  alt: string;
  onUploaded: (asset: { id: string; url: string }) => void;
  onError: (msg: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
      onError('Formato no soportado. Usa JPEG, PNG, WebP o AVIF.');
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('siteId', siteId);
      form.append('maxDimension', '1200');
      const res = await fetch(withBase('api/assets/upload'), { method: 'POST', body: form });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `Error ${res.status}`);
      }
      const data = (await res.json()) as { id: string; url: string };
      onUploaded({ id: data.id, url: data.url });
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Error subiendo el logo.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className={styles.logoUpload}>
      {logoUrl && (
        <div className={styles.logoPreview}>
          <img src={logoUrl} alt={alt} />
        </div>
      )}
      <button
        type="button"
        className={styles.secondary}
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? 'Subiendo…' : logoUrl ? 'Reemplazar logo' : 'Subir logo'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
        hidden
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
