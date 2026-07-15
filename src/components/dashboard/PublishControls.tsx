import { api } from '@lib/api-client';
import { AxiosError } from 'axios';
import { CloudUpload, Rocket, Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import ConfirmDialog from './ConfirmDialog';
import styles from './publishControls.module.scss';

type Target = 'staging' | 'production';

interface PublishResponse {
  ok: boolean;
  target: Target;
  domains: string[];
}

interface Props {
  siteId: string;
  /** Called after a publish request succeeds (staging or production). */
  onPublished?: () => void;
}

/**
 * Floating action button (bottom-right) that reveals the site-level publish
 * options. Publishing is scoped to the collection's Webflow site (siteId):
 * staging pushes to the .webflow.io subdomain, production to the attached
 * custom domains. All collections sharing a siteId publish the same site, so a
 * publish here also ships any other staged changes on that site.
 */
export default function PublishControls({ siteId, onPublished }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Target | null>(null);
  const [confirmProd, setConfirmProd] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close the menu on outside click or Escape (but keep it open while a
  // confirm dialog or a publish request is in flight).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirmProd) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, confirmProd]);

  const publish = async (target: Target) => {
    setBusy(target);
    const where = target === 'staging' ? 'staging' : 'producción';
    const toastId = toast.loading(`Publicando en ${where}…`);
    try {
      const res = await api.post<PublishResponse>(`/sites/${siteId}/publish`, { target });
      toast.success(`Publicado en ${where}`, {
        id: toastId,
        description: res.data.domains.join(', '),
      });
      onPublished?.();
    } catch (err) {
      let text = 'No se pudo publicar.';
      if (err instanceof AxiosError) {
        if (err.response?.status === 429) {
          text = 'Webflow permite ~1 publicación por minuto. Espera un momento e intenta de nuevo.';
        } else {
          text = (err.response?.data as { error?: string })?.error ?? text;
        }
      }
      toast.error('Error al publicar', { id: toastId, description: text });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={styles.container} ref={containerRef}>
      {open && (
        <div className={styles.menu} role="menu">
          <span className={styles.menuTitle}>Opciones de publicación</span>
          <button
            type="button"
            role="menuitem"
            className={styles.staging}
            onClick={() => publish('staging')}
            disabled={busy !== null}
          >
            <CloudUpload size={16} />
            {busy === 'staging' ? 'Publicando…' : 'Publicar a Staging'}
          </button>
          <button
            type="button"
            role="menuitem"
            className={styles.production}
            onClick={() => setConfirmProd(true)}
            disabled={busy !== null}
          >
            <Rocket size={16} />
            {busy === 'production' ? 'Publicando…' : 'Publicar a Producción'}
          </button>
        </div>
      )}

      <button
        type="button"
        className={styles.fab}
        data-tooltip={open ? undefined : 'Opciones de publicación'}
        aria-label="Opciones de publicación"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X size={22} /> : <Send size={20} />}
      </button>

      <ConfirmDialog
        open={confirmProd}
        title="Publicar a producción"
        message="Se republicará TODO el sitio a los dominios de producción, incluidos otros cambios pendientes en staging (incluido el Designer). ¿Continuar?"
        confirmLabel="Publicar a producción"
        cancelLabel="Cancelar"
        busy={busy === 'production'}
        onConfirm={async () => {
          await publish('production');
          setConfirmProd(false);
          setOpen(false);
        }}
        onCancel={() => setConfirmProd(false)}
      />
    </div>
  );
}
