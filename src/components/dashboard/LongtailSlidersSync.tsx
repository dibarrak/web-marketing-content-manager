import { api } from '@lib/api-client';
import { AxiosError } from 'axios';
import { ArrowLeft, FileUp, RefreshCw, X } from 'lucide-react';
import Papa from 'papaparse';
import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { toast, Toaster } from 'sonner';
import { withBase } from '@lib/base-path';
import ConfirmDialog from './ConfirmDialog';
import PublishControls from './PublishControls';
import fieldStyles from '../forms/fields/fields.module.scss';
import styles from './longtailSlidersSync.module.scss';

type RowStatus = 'ready' | 'error';

interface LongtailRow {
  row: number;
  orden: number | null;
  merchantId: string;
  merchantName: string;
  selectorRaw: string;
  selectorResolved?: string;
  slug: string;
  status: RowStatus;
  errors?: string[];
}

interface LongtailDiffReport {
  rows: LongtailRow[];
  toDelete: { id: string; name: string }[];
  counts: Record<RowStatus, number>;
  headerError?: string;
}

interface CreateResult {
  row: number;
  merchantId: string;
  slug: string;
  ok: boolean;
  error?: string;
}

interface ApplyResponse {
  deletedCount: number;
  skippedRows: number;
  created: number;
  createFailed: number;
  results: CreateResult[];
}

const ALL_STATUSES: RowStatus[] = ['ready', 'error'];
const STATUS_LABEL: Record<RowStatus, string> = { ready: 'Listo', error: 'Error' };

const NOTICE_KEY = 'longtail-sliders-publish-notice-dismissed';

function noticeDismissed(): boolean {
  try {
    return localStorage.getItem(NOTICE_KEY) === '1';
  } catch {
    return false;
  }
}

function errMessage(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    return (err.response?.data as { error?: string })?.error ?? err.message ?? fallback;
  }
  return err instanceof Error ? err.message : fallback;
}

interface Props {
  siteId: string;
}

export default function LongtailSlidersSync({ siteId }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<string[][] | null>(null);
  const [report, setReport] = useState<LongtailDiffReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [confirmApply, setConfirmApply] = useState(false);
  const [query, setQuery] = useState('');
  const [visibleStatuses, setVisibleStatuses] = useState<Set<RowStatus>>(new Set(ALL_STATUSES));
  const [showNotice, setShowNotice] = useState(() => !noticeDismissed());
  const [dragging, setDragging] = useState(false);
  const [lastResult, setLastResult] = useState<ApplyResponse | null>(null);

  const handleFile = (file: File) => {
    if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
      toast.error('Archivo no válido', { description: 'Sube un archivo .csv.' });
      return;
    }
    setFileName(file.name);
    setReport(null);
    setLastResult(null);
    Papa.parse<string[]>(file, {
      header: false,
      skipEmptyLines: true,
      complete: (result) => {
        setRows(result.data);
        void preview(result.data);
      },
      error: (err) => toast.error('Error al leer el CSV', { description: err.message }),
    });
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (loading || applying) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const dismissNotice = () => {
    setShowNotice(false);
    try {
      localStorage.setItem(NOTICE_KEY, '1');
    } catch {
      /* storage unavailable — dismissal just lasts for this visit */
    }
  };

  const preview = async (data: string[][] | null = rows) => {
    if (!data) return;
    setLoading(true);
    setReport(null);
    try {
      const res = await api.post<LongtailDiffReport>('/longtail-sliders/preview', { rows: data });
      setReport(res.data);
    } catch (err) {
      toast.error('Error al previsualizar', { description: errMessage(err, 'Intenta de nuevo.') });
    } finally {
      setLoading(false);
    }
  };

  /** How many 'ready' rows land in each Selector de slider group — errors
   * aren't counted here since they won't actually be created. */
  const categoryCounts = useMemo(() => {
    if (!report) return [];
    const counts = new Map<string, number>();
    for (const r of report.rows) {
      if (r.status !== 'ready') continue;
      const label = r.selectorResolved ?? r.selectorRaw;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [report]);

  const displayRows = useMemo(() => {
    if (!report) return [];
    const q = query.trim().toLowerCase();
    return report.rows.filter(
      (r) =>
        visibleStatuses.has(r.status) &&
        (!q || r.merchantName.toLowerCase().includes(q) || r.merchantId.toLowerCase().includes(q)),
    );
  }, [report, query, visibleStatuses]);

  const apply = async () => {
    if (!rows) return;
    setApplying(true);
    const toastId = toast.loading('Sincronizando…');
    try {
      const res = await api.post<ApplyResponse>('/longtail-sliders/apply', { rows });
      setLastResult(res.data);
      const { deletedCount, created, createFailed } = res.data;
      if (createFailed > 0) {
        toast.warning(`${created} creados, ${createFailed} con error`, {
          id: toastId,
          description: `Se eliminaron ${deletedCount} items previos. Revisa el detalle debajo.`,
        });
      } else {
        toast.success(`${created} items publicados`, {
          id: toastId,
          description: `Se eliminaron ${deletedCount} items previos y se publicaron los nuevos de inmediato.`,
        });
      }
      setConfirmApply(false);
      await preview();
    } catch (err) {
      toast.error('Error al aplicar', { id: toastId, description: errMessage(err, 'Intenta de nuevo.') });
    } finally {
      setApplying(false);
      setConfirmApply(false);
    }
  };

  const readyCount = report?.counts.ready ?? 0;
  const errorCount = report?.counts.error ?? 0;
  const toDeleteCount = report?.toDelete.length ?? 0;
  const failures = lastResult?.results.filter((r) => !r.ok) ?? [];

  return (
    <main className={styles.page}>
      <a href={withBase('dashboard')} className={styles.back}>
        <ArrowLeft size={16} /> Volver al dashboard
      </a>

      <header className={styles.toolbar}>
        <h1>Sincronización de Longtail Sliders</h1>
      </header>

      {showNotice && (
        <div className={`${styles.warnBanner} ${styles.dismissible}`}>
          <span>
            ℹ Si esta colección nunca se ha publicado en Webflow, la primera sincronización fallará
            (Webflow no puede crear items "en vivo" en una colección sin publicar). Publica el sitio una
            vez con el botón inferior derecho y luego vuelve a sincronizar.
          </span>
          <button
            type="button"
            className={styles.dismiss}
            onClick={dismissNotice}
            aria-label="Cerrar aviso"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <section className={styles.controls}>
        <div className={styles.uploadField}>
          <span>CSV del calendario de promos (Slug / Merchant ID / Selector de slider)</span>
          <div
            className={`${fieldStyles.dropzone} ${dragging ? fieldStyles.dragging : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
            }}
          >
            <p style={{ margin: 0 }}>
              {fileName ? (
                <>
                  <FileUp size={16} style={{ verticalAlign: 'text-bottom' }} /> {fileName} — arrastra otro
                  para reemplazarlo
                </>
              ) : (
                'Arrastra el CSV aquí, o haz click para seleccionar'
              )}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className={styles.hiddenInput}
              onChange={onFileChange}
            />
          </div>
        </div>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => preview()}
          disabled={!rows || loading || applying}
        >
          <RefreshCw size={16} /> {loading ? 'Cargando…' : 'Previsualizar'}
        </button>
        {report && !report.headerError && (
          <button
            type="button"
            className={styles.primary}
            onClick={() => setConfirmApply(true)}
            disabled={readyCount === 0 || applying}
          >
            Sincronizar ({readyCount} listo{readyCount === 1 ? '' : 's'})
          </button>
        )}
      </section>

      {failures.length > 0 && (
        <div className={styles.errorBanner}>
          <strong>{failures.length} fila(s) fallaron al crear:</strong>
          <ul className={styles.failureList}>
            {failures.map((r) => (
              <li key={`${r.row}-${r.slug}`}>
                Fila {r.row} — <code>{r.merchantId}</code> ({r.slug}): {r.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {report?.headerError && (
        <div className={styles.errorBanner}>
          ⚠ No se pudo leer el CSV: {report.headerError} Revisa que el archivo exportado desde el
          Sheet conserve las columnas en su posición habitual (A: Orden, B: Slug, C: Merchant ID, E:
          Selector de slider).
        </div>
      )}

      {report && !report.headerError && (
        <>
          <div className={styles.deleteBanner}>
            ⚠ Al sincronizar se eliminarán los <strong>{toDeleteCount}</strong> item(s) que hoy existen
            en la colección Longtail Sliders, y se crearán/publicarán los {readyCount} listos desde
            este archivo.
            {readyCount === 0 && ' El slider quedará vacío hasta que corrijas y vuelvas a subir el CSV.'}
          </div>

          {categoryCounts.length > 0 && (
            <div className={styles.categorySummary}>
              <span className={styles.categorySummaryTitle}>Elementos a crear por categoría:</span>
              <div className={styles.categoryPills}>
                {categoryCounts.map(([label, count]) => (
                  <span key={label} className={styles.categoryPill}>
                    {label} <strong>{count}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className={styles.filterBar}>
            <input
              className={styles.search}
              type="search"
              placeholder="Buscar por nombre o merchant ID…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className={styles.counts}>
              {ALL_STATUSES.map((s) => {
                const active = visibleStatuses.has(s);
                return (
                  <button
                    key={s}
                    type="button"
                    className={`${styles.countBadge} ${styles[s]} ${active ? styles.chipActive : styles.chipOff}`}
                    aria-pressed={active}
                    onClick={() =>
                      setVisibleStatuses((prev) => {
                        const next = new Set(prev);
                        next.has(s) ? next.delete(s) : next.add(s);
                        return next;
                      })
                    }
                  >
                    {report.counts[s]} {STATUS_LABEL[s].toLowerCase()}
                  </button>
                );
              })}
            </div>
          </div>

          {errorCount > 0 && (
            <div className={styles.warnBanner}>
              ⚠ {errorCount} fila(s) con error no se van a crear — corrígelas en el Sheet y vuelve a
              subir el CSV.
            </div>
          )}

          {displayRows.length === 0 ? (
            <p className={styles.empty}>No hay filas que mostrar con los filtros actuales.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Fila</th>
                  <th>Estado</th>
                  <th>Merchant</th>
                  <th>Orden</th>
                  <th>Selector de slider</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((r) => (
                  <tr key={`${r.row}-${r.slug}`}>
                    <td>{r.row}</td>
                    <td>
                      <span className={`${styles.badge} ${styles[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                    </td>
                    <td>
                      <strong>{r.merchantName || '(sin match)'}</strong>
                      <span className={styles.merchantId}>ID: {r.merchantId || '—'}</span>
                    </td>
                    <td>{r.orden ?? '—'}</td>
                    <td>{r.selectorResolved ?? r.selectorRaw ?? '—'}</td>
                    <td>
                      {r.status === 'error' ? (
                        <div className={styles.errorList}>
                          {r.errors?.map((err, i) => <div key={i}>⚠ {err}</div>)}
                        </div>
                      ) : (
                        <span className={styles.merchantId}>slug: {r.slug}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmApply}
        title="Sincronizar Longtail Sliders"
        message={`Se eliminarán los ${toDeleteCount} item(s) actuales de la colección y se crearán/publicarán ${readyCount} item(s) nuevo(s) desde el CSV. Esta acción no se puede deshacer. ¿Continuar?`}
        confirmLabel="Sincronizar"
        cancelLabel="Cancelar"
        destructive
        busy={applying}
        onConfirm={apply}
        onCancel={() => setConfirmApply(false)}
      />

      <PublishControls siteId={siteId} />
      <Toaster richColors position="top-center" />
    </main>
  );
}
