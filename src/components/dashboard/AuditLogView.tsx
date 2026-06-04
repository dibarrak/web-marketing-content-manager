import { api } from '@lib/api-client';
import { withBase } from '@lib/base-path';
import { COLLECTIONS, findCollectionById } from '@lib/config/sites';
import { useQuery } from '@tanstack/react-query';
import { Fragment, useMemo, useState } from 'react';
import QueryProvider from '../providers/QueryProvider';
import styles from './dashboard.module.scss';
import { MoveLeft } from 'lucide-react';

interface AuditRow {
  id: string;
  userId: string;
  userEmail: string;
  action: 'create' | 'update' | 'delete';
  siteId: string;
  collectionId: string;
  itemId: string | null;
  itemSlug: string | null;
  diffJson: string | null;
  ts: string; // serialized Date
}

interface AuditResponse {
  rows: AuditRow[];
  total: number;
}

const PAGE_SIZE = 50;

function actionBadgeClass(action: AuditRow['action']) {
  if (action === 'create') return styles.badgeCreate;
  if (action === 'update') return styles.badgeUpdate;
  return styles.badgeDelete;
}

function AuditLogInner() {
  const [user, setUser] = useState('');
  const [action, setAction] = useState('');
  const [collectionId, setCollectionId] = useState('');
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  const params = useMemo(() => {
    const p: Record<string, string> = { limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) };
    if (user) p.user = user;
    if (action) p.action = action;
    if (collectionId) p.collectionId = collectionId;
    if (since) p.since = new Date(since).toISOString();
    if (until) {
      const d = new Date(until);
      d.setHours(23, 59, 59, 999);
      p.until = d.toISOString();
    }
    return p;
  }, [user, action, collectionId, since, until, page]);

  const query = useQuery({
    queryKey: ['audit-log', params],
    queryFn: async () => {
      const res = await api.get<AuditResponse>('/audit-log', { params });
      return res.data;
    },
    placeholderData: (prev) => prev,
  });

  const resetFilters = () => {
    setUser('');
    setAction('');
    setCollectionId('');
    setSince('');
    setUntil('');
    setPage(0);
  };

  const data = query.data;
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className={styles.page}>
      <a href={withBase('dashboard')} className={styles.back}>
        <MoveLeft size={16} /> Volver al dashboard
      </a>
      <header className={styles.toolbar}>
        <h1>Bitácora</h1>
      </header>

      <section className={styles.filters}>
        <label>
          <span>Usuario</span>
          <input
            type="text"
            placeholder="email o parte"
            value={user}
            onChange={(e) => {
              setUser(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <label>
          <span>Acción</span>
          <select
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Todas</option>
            <option value="create">create</option>
            <option value="update">update</option>
            <option value="delete">delete</option>
          </select>
        </label>
        <label>
          <span>Colección</span>
          <select
            value={collectionId}
            onChange={(e) => {
              setCollectionId(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Todas</option>
            {Object.values(COLLECTIONS).map((c) => (
              <option key={c.collectionId} value={c.collectionId}>
                {c.displayName}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Desde</span>
          <input
            type="date"
            value={since}
            onChange={(e) => {
              setSince(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <label>
          <span>Hasta</span>
          <input
            type="date"
            value={until}
            onChange={(e) => {
              setUntil(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <button type="button" className={styles.filterReset} onClick={resetFilters}>
          Limpiar
        </button>
      </section>

      {query.isLoading && <p>Cargando…</p>}
      {query.isError && (
        <div className={styles.errorBanner}>
          {(query.error as Error).message}
        </div>
      )}

      {data && data.rows.length === 0 && (
        <p className={styles.empty}>Sin registros con esos filtros.</p>
      )}

      {data && data.rows.length > 0 && (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Acción</th>
                  <th>Colección</th>
                  <th>Item</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => {
                  const isOpen = expanded === row.id;
                  const collection = findCollectionById(row.collectionId);
                  return (
                    <Fragment key={row.id}>
                      <tr>
                        <td>{new Date(row.ts).toLocaleString()}</td>
                        <td>{row.userEmail}</td>
                        <td>
                          <span className={`${styles.badge} ${actionBadgeClass(row.action)}`}>
                            {row.action}
                          </span>
                        </td>
                        <td>{collection?.singularName ?? row.collectionId}</td>
                        <td>
                          <code>{row.itemSlug ?? row.itemId ?? '—'}</code>
                        </td>
                        <td className={styles.actionsCell}>
                          {row.diffJson && (
                            <button
                              type="button"
                              onClick={() => setExpanded(isOpen ? null : row.id)}
                            >
                              {isOpen ? 'Ocultar' : 'Detalle'}
                            </button>
                          )}
                        </td>
                      </tr>
                      {isOpen && row.diffJson && (
                        <tr>
                          <td colSpan={6} className={styles.diffCell}>
                            <pre className={styles.diff}>
                              {JSON.stringify(JSON.parse(row.diffJson), null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className={styles.pager}>
            <span className={styles.pagerInfo}>
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total}
            </span>
            <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              ← Anterior
            </button>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente →
            </button>
          </div>
        </>
      )}
    </main>
  );
}

export default function AuditLogView() {
  return (
    <QueryProvider>
      <AuditLogInner />
    </QueryProvider>
  );
}
