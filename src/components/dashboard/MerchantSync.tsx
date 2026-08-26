import { api } from '@lib/api-client';
import { AxiosError } from 'axios';
import { ArrowLeft, ChevronDown, ChevronRight, FileUp, RefreshCw } from 'lucide-react';
import Papa from 'papaparse';
import { Fragment, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { toast, Toaster } from 'sonner';
import { withBase } from '@lib/base-path';
import ConfirmDialog from './ConfirmDialog';
import PublishControls from './PublishControls';
import styles from './merchantSync.module.scss';

type EntryStatus = 'create' | 'update' | 'delete' | 'error';

interface FieldChange {
  field: string;
  label: string;
  before: unknown;
  after: unknown;
}

interface MerchantEntry {
  row: number;
  merchantId: string;
  name: string;
  status: EntryStatus;
  itemId?: string;
  changes: FieldChange[];
  tiendaItemIds?: string[];
  errors?: string[];
  warnings?: string[];
}

interface MerchantDiffReport {
  entries: MerchantEntry[];
  counts: Record<EntryStatus, number>;
  /** Set when the header row is missing an expected column — entries is empty. */
  headerError?: string;
}

interface ApplyResultRow {
  merchantId: string;
  name: string;
  action: 'create' | 'update' | 'delete';
  ok: boolean;
  error?: string;
}

const STATUS_LABEL: Record<EntryStatus, string> = {
  create: 'Alta',
  update: 'Actualización',
  delete: 'Baja',
  error: 'Error',
};

// Statuses the user can select and apply.
const ACTIONABLE: EntryStatus[] = ['create', 'update', 'delete'];
const ALL_STATUSES: EntryStatus[] = ['create', 'update', 'delete', 'error'];

function fmt(v: unknown): string {
  if (v === true) return 'Sí';
  if (v === false) return 'No';
  if (v === undefined || v === null || v === '') return '—';
  return String(v);
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

export default function MerchantSync({ siteId }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<string[][] | null>(null);
  const [report, setReport] = useState<MerchantDiffReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [confirmApply, setConfirmApply] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [visibleStatuses, setVisibleStatuses] = useState<Set<EntryStatus>>(new Set(ALL_STATUSES));
  const [lastFailures, setLastFailures] = useState<ApplyResultRow[]>([]);

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setReport(null);
    setSelected(new Set());
    setLastFailures([]);
    Papa.parse<string[]>(file, {
      header: false,
      skipEmptyLines: true,
      complete: (result) => setRows(result.data),
      error: (err) => toast.error('Error al leer el CSV', { description: err.message }),
    });
  };

  const preview = async () => {
    if (!rows) return;
    setLoading(true);
    setReport(null);
    try {
      const res = await api.post<MerchantDiffReport>('/merchant-sync/preview', { rows });
      setReport(res.data);
      setSelected(
        new Set(
          res.data.entries.filter((e) => ACTIONABLE.includes(e.status)).map((e) => e.merchantId),
        ),
      );
      setExpanded(new Set());
    } catch (err) {
      toast.error('Error al previsualizar', { description: errMessage(err, 'Intenta de nuevo.') });
    } finally {
      setLoading(false);
    }
  };

  const displayEntries = useMemo(() => {
    if (!report) return [];
    const q = query.trim().toLowerCase();
    return report.entries.filter(
      (e) =>
        visibleStatuses.has(e.status) &&
        (!q || e.name.toLowerCase().includes(q) || e.merchantId.toLowerCase().includes(q)),
    );
  }, [report, query, visibleStatuses]);
  const actionableEntries = useMemo(
    () => displayEntries.filter((e) => ACTIONABLE.includes(e.status)),
    [displayEntries],
  );
  const selectedCounts = useMemo(() => {
    const counts = { create: 0, update: 0, delete: 0 };
    if (!report) return counts;
    for (const e of report.entries) {
      if (e.status !== 'error' && selected.has(e.merchantId)) counts[e.status]++;
    }
    return counts;
  }, [report, selected]);

  const apply = async () => {
    const merchantIds = [...selected];
    setApplying(true);
    setLastFailures([]);
    const toastId = toast.loading(`Aplicando ${merchantIds.length} cambios…`);
    try {
      const res = await api.post<{ applied: number; failed: number; results: ApplyResultRow[] }>(
        '/merchant-sync/apply',
        { rows, merchantIds },
      );
      const { applied, failed, results } = res.data;
      if (failed > 0) {
        setLastFailures(results.filter((r) => !r.ok));
        toast.warning(`${applied} aplicados, ${failed} con error`, {
          id: toastId,
          description: 'Revisa el detalle debajo de la barra de progreso.',
        });
      } else {
        toast.success(`${applied} cambios aplicados`, {
          id: toastId,
          description: 'Publica el sitio para reflejarlos en vivo.',
        });
      }
      await preview();
    } catch (err) {
      toast.error('Error al aplicar', { id: toastId, description: errMessage(err, 'Intenta de nuevo.') });
    } finally {
      setApplying(false);
      setConfirmApply(false);
    }
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allSelected = actionableEntries.length > 0 && selected.size === actionableEntries.length;
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(actionableEntries.map((e) => e.merchantId)));

  return (
    <main className={styles.page}>
      <a href={withBase('dashboard')} className={styles.back}>
        <ArrowLeft size={16} /> Volver al dashboard
      </a>

      <header className={styles.toolbar}>
        <h1>Sincronización de Merchants</h1>
      </header>

      <section className={styles.controls}>
        <label className={styles.uploadField}>
          <span>CSV de solicitudes (Alta / Actualización / Baja)</span>
          <div className={styles.uploadRow}>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || applying}
            >
              <FileUp size={16} /> {fileName || 'Elegir archivo…'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className={styles.hiddenInput}
              onChange={onFileChange}
            />
          </div>
        </label>
        <button
          type="button"
          className={styles.secondary}
          onClick={preview}
          disabled={!rows || loading || applying}
        >
          <RefreshCw size={16} /> {loading ? 'Cargando…' : 'Previsualizar'}
        </button>
        {report && !report.headerError && (
          <button
            type="button"
            className={styles.primary}
            onClick={() => setConfirmApply(true)}
            disabled={selected.size === 0 || applying}
          >
            Aplicar seleccionados ({selected.size})
          </button>
        )}
      </section>

      {lastFailures.length > 0 && (
        <div className={styles.errorBanner}>
          <strong>{lastFailures.length} fila(s) fallaron al aplicar:</strong>
          <ul className={styles.failureList}>
            {lastFailures.map((r) => (
              <li key={r.merchantId}>
                <code>{r.merchantId}</code> {r.name} ({STATUS_LABEL[r.action]}): {r.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {report?.headerError && (
        <div className={styles.errorBanner}>
          ⚠ No se pudo leer el CSV: {report.headerError} Revisa que el archivo exportado desde el
          Sheet conserve la fila de encabezados.
        </div>
      )}

      {report && !report.headerError && (
        <>
          <div className={styles.filterBar}>
            <input
              className={styles.search}
              type="search"
              placeholder="Buscar por nombre o merchant_id…"
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

          {report.counts.error > 0 && (
            <div className={styles.warnBanner}>
              ⚠ {report.counts.error} fila(s) con error no se pueden aplicar — corrígelas en el
              Sheet y vuelve a subir el CSV.
            </div>
          )}

          {displayEntries.length === 0 ? (
            <p className={styles.empty}>No hay filas que mostrar con los filtros actuales.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                  </th>
                  <th>Acción</th>
                  <th>Merchant</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {displayEntries.map((e) => {
                  const isOpen = expanded.has(e.merchantId);
                  const selectable = ACTIONABLE.includes(e.status);
                  return (
                    <Fragment key={`${e.merchantId}-${e.row}`}>
                      <tr>
                        <td>
                          <input
                            type="checkbox"
                            checked={selected.has(e.merchantId)}
                            disabled={!selectable}
                            title={selectable ? undefined : 'Fila con error: no se puede aplicar'}
                            onChange={() => selectable && toggle(e.merchantId)}
                          />
                        </td>
                        <td>
                          <span className={`${styles.badge} ${styles[e.status]}`}>
                            {STATUS_LABEL[e.status]}
                          </span>
                        </td>
                        <td>
                          <strong>{e.name || '(sin nombre)'}</strong>
                          <span className={styles.merchantId}>ID: {e.merchantId}</span>
                          {e.warnings?.map((w, i) => (
                            <span key={i} className={styles.warning}>⚠ {w}</span>
                          ))}
                        </td>
                        <td>
                          {e.status === 'error' ? (
                            <div className={styles.errorList}>
                              {e.errors?.map((err, i) => (
                                <div key={i}>⚠ {err}</div>
                              ))}
                            </div>
                          ) : e.status === 'delete' ? (
                            <span className={styles.deleteNote}>
                              {(e.tiendaItemIds?.length ?? 0) > 0
                                ? `Elimina también ${e.tiendaItemIds!.length} landing page(s) en Tiendas`
                                : 'Sin landing page en Tiendas'}
                            </span>
                          ) : (
                            <button
                              type="button"
                              className={styles.expandBtn}
                              onClick={() => toggleExpand(e.merchantId)}
                            >
                              {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              {e.changes.length} campo(s)
                            </button>
                          )}
                        </td>
                      </tr>
                      {isOpen && e.changes.length > 0 && (
                        <tr className={styles.detailRow}>
                          <td />
                          <td colSpan={3}>
                            <ul className={styles.changeList}>
                              {e.changes.map((c) => (
                                <li key={c.field}>
                                  <span className={styles.changeLabel}>{c.label}</span>
                                  <span className={styles.before}>{fmt(c.before)}</span>
                                  <span className={styles.arrow}>→</span>
                                  <span className={styles.after}>{fmt(c.after)}</span>
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmApply}
        title="Aplicar sincronización"
        message={`Se aplicarán ${selectedCounts.create} alta(s), ${selectedCounts.update} actualización(es) y ${selectedCounts.delete} baja(s) en Webflow (en staging). Las bajas eliminan también su landing page en Tiendas y despublican los items. Después publica el sitio para reflejarlo en vivo. ¿Continuar?`}
        confirmLabel="Aplicar"
        cancelLabel="Cancelar"
        destructive={selectedCounts.delete > 0}
        busy={applying}
        onConfirm={apply}
        onCancel={() => setConfirmApply(false)}
      />

      <PublishControls siteId={siteId} />
      <Toaster richColors position="top-center" />
    </main>
  );
}
