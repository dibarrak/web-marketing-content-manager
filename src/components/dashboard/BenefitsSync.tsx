import { api } from '@lib/api-client';
import { AxiosError } from 'axios';
import { ArrowLeft, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { toast, Toaster } from 'sonner';
import { withBase } from '@lib/base-path';
import ConfirmDialog from './ConfirmDialog';
import PublishControls from './PublishControls';
import styles from './benefitsSync.module.scss';

type ChangeStatus = 'new' | 'changed' | 'unchanged' | 'out_of_source' | 'draft' | 'no_landing';

interface FieldChange {
  field: string;
  label: string;
  before: unknown;
  after: unknown;
}

interface DiffEntry {
  merchantId: string;
  name: string;
  status: ChangeStatus;
  itemId?: string;
  tiendaId?: string;
  isCreate: boolean;
  changes: FieldChange[];
  summary?: { cupon?: string; cashback?: string };
  warnings?: string[];
}

interface TiendaRef {
  id: string;
  merchantId: string;
  name: string;
  slug: string;
  isDraft?: boolean;
  linkedBenefitId?: string;
}

interface DiffReport {
  month: string;
  entries: DiffEntry[];
  counts: Record<ChangeStatus, number>;
}

const STATUS_LABEL: Record<ChangeStatus, string> = {
  new: 'Nuevo',
  changed: 'Cambiado',
  unchanged: 'Sin cambios',
  out_of_source: 'Fuera de fuente',
  draft: 'Draft (omitido)',
  no_landing: 'Sin landing',
};

// Applicable: merchants in both the sheet and the CMS with differences
// ("changed"), and sheet merchants that have a Tiendas landing but no Benefits
// item yet ("new" → created and linked). Out-of-source / draft / no_landing are
// informational.
const ACTIONABLE: ChangeStatus[] = ['new', 'changed'];
const DEFAULT_SELECTED: ChangeStatus[] = ['new', 'changed'];
// Merchants per request; batches are sent one after another to stay under
// Webflow's rate limit and the Worker subrequest cap.
const APPLY_BATCH_SIZE = 10;
// All statuses, in the order shown as filter chips.
const ALL_STATUSES: ChangeStatus[] = ['new', 'changed', 'out_of_source', 'no_landing', 'draft', 'unchanged'];
// Statuses visible by default (everything except the noisy "unchanged").
const DEFAULT_VISIBLE: ChangeStatus[] = ['new', 'changed', 'out_of_source', 'no_landing', 'draft'];

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function fmt(v: unknown): string {
  if (v === true) return 'Sí';
  if (v === false) return 'No';
  if (v === undefined || v === null || v === '') return '—';
  return String(v);
}

interface Props {
  siteId: string;
}

export default function BenefitsSync({ siteId }: Props) {
  const [months, setMonths] = useState<Array<{ month: string; updatedAt: string }>>([]);
  const [month, setMonth] = useState('');
  const [monthsError, setMonthsError] = useState<string | null>(null);
  const [report, setReport] = useState<DiffReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('Cargando…');
  // Tiendas index, loaded once per page visit (thousands of items, slow to list).
  const tiendasRef = useRef<TiendaRef[] | null>(null);
  const [applying, setApplying] = useState(false);
  const [confirmApply, setConfirmApply] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [visibleStatuses, setVisibleStatuses] = useState<Set<ChangeStatus>>(
    new Set(DEFAULT_VISIBLE),
  );

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<{ months: Array<{ month: string; updatedAt: string }> }>(
          '/benefits/months',
        );
        setMonths(res.data.months);
      } catch (err) {
        setMonthsError(errMessage(err, 'No se pudieron cargar los meses.'));
      }
    })();
  }, []);

  const preview = async () => {
    if (!month) return;
    setLoading(true);
    setLoadingLabel('Cargando…');
    setReport(null);
    try {
      if (!tiendasRef.current) {
        // Walk the Tiendas collection in slices so no single request times out.
        const collected: TiendaRef[] = [];
        let next: number | null = 0;
        let stalls = 0;
        while (next !== null) {
          const slice: {
            data: { tiendas: TiendaRef[]; next: number | null; total: number; retryAfter?: number };
          } = await api.get('/benefits/tiendas', { params: { offset: next } });
          collected.push(...slice.data.tiendas);
          next = slice.data.next;
          if (slice.data.retryAfter && next !== null) {
            // Webflow rate limit: wait out its window, then resume the same slice.
            if (++stalls > 10) throw new Error('Webflow limitó demasiado las solicitudes; intenta más tarde.');
            setLoadingLabel(`Esperando límite de Webflow (${slice.data.retryAfter}s)…`);
            await sleep(slice.data.retryAfter * 1000);
          } else {
            setLoadingLabel(
              next === null ? 'Comparando…' : `Leyendo Tiendas ${next}/${slice.data.total}…`,
            );
          }
        }
        tiendasRef.current = collected;
      }
      const res = await api.post<DiffReport>('/benefits/preview', {
        month,
        tiendas: tiendasRef.current,
      });
      setReport(res.data);
      setSelected(
        new Set(
          res.data.entries.filter((e) => DEFAULT_SELECTED.includes(e.status)).map((e) => e.merchantId),
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

  const tiendaByMerchant = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of report?.entries ?? []) if (e.status === 'new' && e.tiendaId) map.set(e.merchantId, e.tiendaId);
    return map;
  }, [report]);

  const apply = async () => {
    const merchantIds = [...selected];
    setApplying(true);
    const toastId = toast.loading(`Aplicando 0/${merchantIds.length}…`);
    let applied = 0;
    let failed = 0;
    try {
      // Sequential batches. The server stops after ~11s (Webflow Cloud kills requests
      // at ~20s) and returns the unprocessed merchants as `pending`; they go back
      // to the front of the queue. A 429 makes it wait out Webflow's window first.
      const queue = [...merchantIds];
      let done = 0;
      let rateLimitStalls = 0;
      while (queue.length > 0) {
        const batch = queue.splice(0, APPLY_BATCH_SIZE);
        // For new merchants the server needs the Tienda to link; it re-verifies it.
        const tiendaIds: Record<string, string> = {};
        for (const id of batch) {
          const t = tiendaByMerchant.get(id);
          if (t) tiendaIds[id] = t;
        }
        try {
          const res = await api.post<{
            applied: number;
            failed: number;
            pending?: string[];
            retryAfter?: number;
          }>('/benefits/apply', { month, merchantIds: batch, tiendaIds });
          applied += res.data.applied;
          failed += res.data.failed;
          const pending = res.data.pending ?? [];
          done += batch.length - pending.length;
          queue.unshift(...pending);
          if (res.data.retryAfter && pending.length > 0) {
            if (++rateLimitStalls > 10) {
              failed += queue.length;
              break;
            }
            toast.loading(`Esperando límite de Webflow (${res.data.retryAfter}s)…`, { id: toastId });
            await sleep(Math.min(res.data.retryAfter, 60) * 1000);
          }
        } catch (err) {
          if (err instanceof AxiosError && err.response?.status === 429 && ++rateLimitStalls <= 10) {
            queue.unshift(...batch); // nothing was written; retry after a pause
            toast.loading('Esperando límite de Webflow…', { id: toastId });
            await sleep(15_000);
            continue;
          }
          failed += batch.length;
          done += batch.length;
        }
        toast.loading(`Aplicando ${done}/${merchantIds.length}…`, { id: toastId });
      }
      if (failed > 0) {
        toast.warning(`${applied} aplicados, ${failed} con error`, {
          id: toastId,
          description: 'Revisa la previsualización actualizada.',
        });
      } else {
        toast.success(`${applied} cambios aplicados`, {
          id: toastId,
          description: 'Publica el sitio para reflejarlos en vivo.',
        });
      }
      await preview(); // refresh so applied rows drop to "sin cambios"
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
        <h1>Sincronización de Benefits</h1>
      </header>

      <section className={styles.controls}>
        <label className={styles.monthField}>
          <span>Mes (pestaña del Sheet)</span>
          <select value={month} onChange={(e) => setMonth(e.target.value)} disabled={loading || applying}>
            <option value="">Selecciona un mes…</option>
            {months.map((m) => (
              <option key={m.month} value={m.month}>
                {m.month}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={styles.secondary}
          onClick={preview}
          disabled={!month || loading || applying}
        >
          <RefreshCw size={16} /> {loading ? loadingLabel : 'Previsualizar'}
        </button>
        {report && (
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

      {monthsError && <div className={styles.errorBanner}>{monthsError}</div>}

      {report && (
        <>
          <div className={styles.filterBar}>
            <input
              className={styles.search}
              type="search"
              placeholder="Buscar por nombre o merchant-id…"
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

          {displayEntries.length === 0 ? (
            <p className={styles.empty}>No hay cambios por aplicar para este mes. 🎉</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                  </th>
                  <th>Estado</th>
                  <th>Merchant</th>
                  <th>Promo a aplicar</th>
                  <th>Cambios</th>
                </tr>
              </thead>
              <tbody>
                {displayEntries.map((e) => {
                  const isOpen = expanded.has(e.merchantId);
                  const selectable = ACTIONABLE.includes(e.status);
                  return (
                    <Fragment key={e.merchantId}>
                      <tr>
                        <td>
                          <input
                            type="checkbox"
                            checked={selected.has(e.merchantId)}
                            disabled={!selectable}
                            title={selectable ? undefined : 'Solo informativo: no se modifica'}
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
                          {e.status === 'out_of_source' ? (
                            <span className={styles.promoOff}>Apagar promociones</span>
                          ) : e.summary?.cupon || e.summary?.cashback ? (
                            <div className={styles.promoValues}>
                              {e.summary?.cupon && (
                                <span className={styles.promoTag}>Cupón: {e.summary.cupon}</span>
                              )}
                              {e.summary?.cashback && (
                                <span className={styles.promoTag}>Cashback: {e.summary.cashback}</span>
                              )}
                            </div>
                          ) : (
                            <span className={styles.merchantId}>—</span>
                          )}
                        </td>
                        <td>
                          <button
                            type="button"
                            className={styles.expandBtn}
                            onClick={() => toggleExpand(e.merchantId)}
                          >
                            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            {e.changes.length} campo(s)
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className={styles.detailRow}>
                          <td />
                          <td colSpan={4}>
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
        message={`Se crearán/actualizarán ${selected.size} merchant(s) en Webflow (en staging). Después publica el sitio para reflejarlo en vivo. ¿Continuar?`}
        confirmLabel="Aplicar"
        cancelLabel="Cancelar"
        busy={applying}
        onConfirm={apply}
        onCancel={() => setConfirmApply(false)}
      />

      <PublishControls siteId={siteId} />
      <Toaster richColors position="top-center" />
    </main>
  );
}

function errMessage(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    return (err.response?.data as { error?: string })?.error ?? err.message ?? fallback;
  }
  return err instanceof Error ? err.message : fallback;
}
