import {
  bulkDeleteItems,
  createItem,
  deleteItem,
  getSitePublishStatus,
  listItems,
  updateItem,
  type WebflowItem,
} from '@lib/api-client';
import { withBase } from '@lib/base-path';
import type { CollectionKey } from '@lib/config/sites';
import { getDisplayField, getStatus } from '@lib/collection-status';
import { getPublishState } from '@lib/publish-state';
import { reverseTranslateOptionFields, translateOptionFields } from '@lib/webflow/option-maps';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import gsap from 'gsap';
import { CirclePlus, ArrowLeft, ListChecks, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Toaster, toast } from 'sonner';
import { blogFieldsFromWebflow, blogFieldsToWebflow } from '@lib/blog-fields';
import BlogPostForm from '../forms/BlogPostForm';
import CouponFilterForm from '../forms/CouponFilterForm';
import CouponForm from '../forms/CouponForm';
import FeaturedMerchantForm from '../forms/FeaturedMerchantForm';
import HeroBannerForm from '../forms/HeroBannerForm';
import QueryProvider from '../providers/QueryProvider';
import BlogPostCard from './BlogPostCard';
import ConfirmDialog from './ConfirmDialog';
import CollectionFilters, { DEFAULT_FILTERS, type FilterState } from './CollectionFilters';
import CouponCard from './CouponCard';
import CouponFilterCard from './CouponFilterCard';
import FeaturedMerchantCard from './FeaturedMerchantCard';
import FormModal from './FormModal';
import HeroBannerCard from './HeroBannerCard';
import PublishControls from './PublishControls';
import styles from './dashboard.module.scss';

interface Props {
  collectionKey: CollectionKey;
  collectionId: string;
  displayName: string;
  singularName: string;
  siteId: string;
  canPublish: boolean;
}

type AnyFields = Record<string, unknown> & { name: string; slug: string };

function CollectionPageInner({ collectionKey, collectionId, displayName, singularName, siteId, canPublish }: Props) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<WebflowItem<AnyFields> | null>(null);
  const [creating, setCreating] = useState(false);
  const [createDefaults, setCreateDefaults] = useState<AnyFields | undefined>(undefined);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [pendingDelete, setPendingDelete] = useState<WebflowItem<AnyFields> | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmingBulk, setConfirmingBulk] = useState(false);
  /** Checkboxes stay hidden until the user opts into selection mode. */
  const [selectionMode, setSelectionMode] = useState(false);

  const itemsQuery = useQuery({
    queryKey: ['collection', collectionId],
    queryFn: () => listItems<AnyFields>(collectionId),
  });

  // Blog Posts is the only card that distinguishes "live in the Webflow CMS"
  // from "the site has actually been republished since". Other collections'
  // status badges are about date-range visibility, not this.
  const sitePublishQuery = useQuery({
    queryKey: ['site-publish-status', siteId],
    queryFn: () => getSitePublishStatus(siteId),
    enabled: collectionKey === 'blogPosts',
    staleTime: 15_000,
  });

  const createMutation = useMutation({
    mutationFn: (fields: AnyFields) => createItem<AnyFields>(collectionId, fields, true),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['collection', collectionId] });
      setCreating(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: AnyFields }) =>
      updateItem<AnyFields>(collectionId, id, fields, true),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['collection', collectionId] });
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteItem(collectionId, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['collection', collectionId] });
      setPendingDelete(null);
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => bulkDeleteItems(collectionId, ids),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ['collection', collectionId] });
      setConfirmingBulk(false);
      setSelected(new Set());

      const problems = [...(res.unpublishFailures ?? []), ...(res.deleteFailures ?? [])];
      // Stay in selection mode when something failed, so the user can retry the
      // leftovers without re-entering the mode.
      if (problems.length === 0) setSelectionMode(false);
      if (problems.length > 0) {
        toast.error(`Se borraron ${res.deletedCount}, pero hubo errores`, {
          description: problems.map((p) => p.error).join(' · '),
        });
        return;
      }
      toast.success(`${res.deletedCount} item(s) borrado(s)`, {
        description:
          res.unpublished > 0
            ? `${res.unpublished} se despublicaron del sitio — no hace falta republicar.`
            : 'Eran borradores, no estaban en el sitio.',
      });
    },
  });

  const toggleSelected = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /** First few selected names, to make the bulk confirmation concrete. */
  const selectedNames = (itemsQuery.data?.items ?? [])
    .filter((i) => selected.has(i.id))
    .slice(0, 5)
    .map((i) => i.fieldData.name);

  // Changing a filter clears the selection: otherwise "Borrar seleccionados"
  // could delete items the user can no longer see.
  useEffect(() => {
    setSelected(new Set());
  }, [filters]);

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelected(new Set());
  };

  // .filters is sticky at top:68px with a height that varies (more filters on
  // featuredMerchants, wrapping to two rows on narrow screens, etc.), so a
  // hardcoded `top` for .bulkBar drifts out of sync and the two bars collide.
  // Measure the real rendered height instead of guessing it.
  //
  // Measured via a ref forwarded straight to .filters' own DOM node — NOT a
  // wrapping div. A wrapper would become .filters' sticky containing block,
  // and since it'd be sized to fit .filters exactly, there'd be no scroll
  // room left for it to actually stick.
  //
  // A callback ref (state, not useRef) so the ResizeObserver attaches the
  // moment the node mounts — .filters only renders once itemsQuery.data
  // resolves, which happens after this component's first render.
  const FILTERS_STICKY_TOP = 68;
  const BAR_GAP = 12;
  const [filtersEl, setFiltersEl] = useState<HTMLDivElement | null>(null);
  const [bulkBarTop, setBulkBarTop] = useState(FILTERS_STICKY_TOP + BAR_GAP);

  useEffect(() => {
    if (!filtersEl) return;
    const update = () => setBulkBarTop(FILTERS_STICKY_TOP + filtersEl.offsetHeight + BAR_GAP);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(filtersEl);
    return () => observer.disconnect();
  }, [filtersEl]);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const cards = Array.from(containerRef.current.children) as HTMLElement[];
    if (cards.length === 0) return;
    gsap.from(cards, {
      opacity: 0,
      y: 20,
      duration: 0.45,
      stagger: 0.07,
      ease: 'power2.out',
      clearProps: 'all',
    });
  }, [itemsQuery.data]);

  const mutationError =
    createMutation.error ?? updateMutation.error ?? deleteMutation.error;

  const mutationStatus = mutationError
    ? (mutationError as AxiosError).response?.status
    : null;

  const errorPayload = mutationError
    ? (mutationError as AxiosError<{ error?: string; code?: string; details?: unknown }>).response
        ?.data
    : null;

  const errorMessage = mutationError
    ? mutationStatus === 429
      ? 'Webflow limitó las solicitudes (60 por minuto). Espera ~1 minuto y reintenta.'
      : errorPayload?.error ?? (mutationError as Error).message
    : null;

  const errorDetailLines = (() => {
    const details = errorPayload?.details;
    if (!details) return [];
    if (Array.isArray(details)) {
      return details.map((d) => {
        if (d && typeof d === 'object') {
          const obj = d as Record<string, unknown>;
          const param = (obj.param as string) ?? (obj.path as string) ?? '';
          const msg =
            (obj.message as string) ?? (obj.msg as string) ?? JSON.stringify(obj);
          return param ? `${param}: ${msg}` : msg;
        }
        return String(d);
      });
    }
    if (typeof details === 'object') {
      return Object.entries(details).map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
    }
    return [String(details)];
  })();

  const closeForm = () => {
    setCreating(false);
    setEditing(null);
    setCreateDefaults(undefined);
  };

  const handleDuplicate = (item: WebflowItem<AnyFields>) => {
    let source = translateOptionFields(collectionKey, item.fieldData) as AnyFields;
    if (collectionKey === 'blogPosts') {
      source = blogFieldsFromWebflow(source) as AnyFields;
    }
    setCreateDefaults({
      ...source,
      name: `${source.name} (copia)`,
      slug: `${source.slug}-copy`,
    });
    setCreating(true);
  };

  // Treat '', null, undefined as the same "empty" — Webflow returns null for
  // unset optional fields while forms emit '' for the same state.
  const normalize = (v: unknown) => (v === '' || v == null ? null : v);
  const isEqual = (a: unknown, b: unknown) =>
    JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));

  const onSubmitForm = async (values: AnyFields) => {
    if (editing) {
      const original = translateOptionFields(collectionKey, editing.fieldData) as Record<
        string,
        unknown
      >;
      const diff: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(values)) {
        if (!isEqual((original as Record<string, unknown>)[k], v)) diff[k] = v;
      }
      // Webflow's slug uniqueness check trips even when the slug in PATCH
      // equals the item's own current slug. Only send slug when `name` changed
      // (the only case where the user would expect slug to update).
      if (isEqual(original.name, values.name)) delete diff.slug;

      // JSON.stringify drops `undefined` values, so Webflow would never receive
      // the clear signal. Convert undefined → null so optional fields are
      // explicitly cleared in Webflow when the user removes a value.
      for (const k of Object.keys(diff)) {
        if (diff[k] === undefined) diff[k] = null;
      }

      if (Object.keys(diff).length === 0) {
        closeForm();
        return;
      }
      let payload = reverseTranslateOptionFields(collectionKey, diff) as AnyFields;
      if (collectionKey === 'blogPosts') {
        payload = blogFieldsToWebflow(payload) as AnyFields;
      }
      updateMutation.mutate({ id: editing.id, fields: payload });
    } else {
      let payload = reverseTranslateOptionFields(collectionKey, values) as AnyFields;
      if (collectionKey === 'blogPosts') {
        payload = blogFieldsToWebflow(payload) as AnyFields;
      }
      createMutation.mutate(payload);
    }
  };

  const submitting = createMutation.isPending || updateMutation.isPending;
  const editingDefaults = editing
    ? ((collectionKey === 'blogPosts'
        ? blogFieldsFromWebflow(translateOptionFields(collectionKey, editing.fieldData))
        : translateOptionFields(collectionKey, editing.fieldData)) as unknown as AnyFields)
    : undefined;
  // When duplicating, editingDefaults is undefined (no editing item), so fall back to createDefaults
  const formDefaults = (editingDefaults ?? createDefaults) as never;

  const renderForm = () => {
    if (collectionKey === 'coupons') {
      return (
        <CouponForm
          collectionId={collectionId}
          defaultValues={formDefaults}
          onSubmit={onSubmitForm as never}
          onCancel={closeForm}
          submitting={submitting}
          isEditing={!!editing}
        />
      );
    }
    if (collectionKey === 'couponFilterList') {
      return (
        <CouponFilterForm
          defaultValues={formDefaults}
          onSubmit={onSubmitForm as never}
          onCancel={closeForm}
          submitting={submitting}
          isEditing={!!editing}
        />
      );
    }
    if (collectionKey === 'blogPosts') {
      return (
        <BlogPostForm
          collectionId={collectionId}
          defaultValues={formDefaults}
          onSubmit={onSubmitForm as never}
          onCancel={closeForm}
          submitting={submitting}
          isEditing={!!editing}
        />
      );
    }
    if (collectionKey === 'featuredMerchants') {
      return (
        <FeaturedMerchantForm
          defaultValues={formDefaults}
          onSubmit={onSubmitForm as never}
          onCancel={closeForm}
          submitting={submitting}
          isEditing={!!editing}
        />
      );
    }
    return (
      <HeroBannerForm
        collectionId={collectionId}
        defaultValues={formDefaults}
        onSubmit={onSubmitForm as never}
        onCancel={closeForm}
        submitting={submitting}
        isEditing={!!editing}
      />
    );
  };

  return (
    <main className={styles.page}>
      <a href={withBase('dashboard')} className={styles.back}>
        <ArrowLeft className={styles.backIcon} size={16} /> Volver al dashboard
      </a>
      <header className={styles.toolbar}>
        <h1>{displayName}</h1>
        <div className={styles.toolbarActions}>
          <button
            type="button"
            className={selectionMode ? styles.selectModeOn : styles.secondary}
            onClick={() => (selectionMode ? exitSelectionMode() : setSelectionMode(true))}
          >
            {selectionMode ? (
              <>
                <X size={16} /> Salir de selección
              </>
            ) : (
              <>
                <ListChecks size={16} /> Seleccionar
              </>
            )}
          </button>
          <button type="button" className={styles.primary} onClick={() => setCreating(true)}>
            <CirclePlus size={16} /> Nuevo {singularName.toLowerCase()}
          </button>
        </div>
      </header>

      {canPublish && (
        <PublishControls
          siteId={siteId}
          onPublished={() => void qc.invalidateQueries({ queryKey: ['site-publish-status', siteId] })}
        />
      )}

      {errorMessage && (
        <div className={styles.errorBanner}>
          <strong>{errorMessage}</strong>
          {errorDetailLines.length > 0 && (
            <ul className={styles.errorList}>
              {errorDetailLines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {itemsQuery.isLoading && <p>Cargando…</p>}
      {itemsQuery.isError && (
        <div className={styles.errorBanner}>
          Error cargando items: {(itemsQuery.error as Error).message}
        </div>
      )}
      {itemsQuery.data && (() => {
        const translatedItems = itemsQuery.data.items.map((item) => ({
          ...item,
          fieldData: translateOptionFields(collectionKey, item.fieldData) as AnyFields & {
            name: string;
            slug: string;
          },
        }));

        const truncatedNotice = itemsQuery.data.truncated ? (
          <div className={styles.errorBanner}>
            Esta colección es demasiado grande para cargarse completa: se
            muestran {translatedItems.length} de {itemsQuery.data.pagination.total} items. Los
            filtros y el ordenamiento solo aplican a los cargados.
          </div>
        ) : null;

        if (translatedItems.length === 0) {
          return (
            <p className={styles.empty}>
              Sin items todavía. Click en "Nuevo" para crear el primero.
            </p>
          );
        }

        const stripHtml = (html: string) => html.replace(/<[^>]+>/g, '');

        const filteredItems = translatedItems
          .filter((item) => {
            if (filters.search) {
              const q = filters.search.toLowerCase();
              if (collectionKey === 'heroBanners') {
                const title = stripHtml(String(item.fieldData['titulo'] ?? '')).toLowerCase();
                const name = item.fieldData.name.toLowerCase();
                if (!title.includes(q) && !name.includes(q)) return false;
              } else {
                if (!item.fieldData.name.toLowerCase().includes(q)) return false;
              }
            }
            if (filters.publishState && getPublishState(item) !== filters.publishState) {
              return false;
            }
            if (filters.status) {
              const display = getDisplayField(collectionKey, item.fieldData);
              if (getStatus(display) !== filters.status) return false;
            }
            if (filters.siteDestination && collectionKey === 'heroBanners') {
              if (item.fieldData['pagina-despliegue'] !== filters.siteDestination) return false;
            }
            if (collectionKey === 'featuredMerchants') {
              // `categoria` holds a referenced item id; `tipo-de-comercio` has
              // already been translated from its option id to its name.
              if (filters.category && item.fieldData['categoria'] !== filters.category)
                return false;
              if (
                filters.merchantType &&
                item.fieldData['tipo-de-comercio'] !== filters.merchantType
              )
                return false;
            }
            return true;
          })
          .sort((a, b) => {
            const dir = filters.sortOrder === 'asc' ? 1 : -1;
            if (filters.sortBy === 'orden') {
              const num = (item: typeof a) =>
                typeof item.fieldData.orden === 'number' ? item.fieldData.orden : null;
              const aN = num(a);
              const bN = num(b);
              // Items without an order sink to the bottom in both directions.
              if (aN == null || bN == null) {
                if (aN == null && bN == null) return 0;
                return aN == null ? 1 : -1;
              }
              return (aN - bN) * dir;
            }
            const aTs = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
            const bTs = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
            return (aTs - bTs) * dir;
          });

        const deletingId = deleteMutation.isPending ? deleteMutation.variables : undefined;
        const visibleIds = filteredItems.map((i) => i.id);

        const renderItemCard = (item: (typeof filteredItems)[number]) => {
          if (collectionKey === 'coupons') {
            return (
              <CouponCard
                item={item}
                onEdit={setEditing}
                onDelete={setPendingDelete}
                onDuplicate={handleDuplicate}
                deletingId={deletingId}
              />
            );
          }
          if (collectionKey === 'couponFilterList') {
            return (
              <CouponFilterCard
                item={item}
                onEdit={setEditing}
                onDelete={setPendingDelete}
                onDuplicate={handleDuplicate}
                deletingId={deletingId}
              />
            );
          }
          if (collectionKey === 'blogPosts') {
            return (
              <BlogPostCard
                item={item}
                onEdit={setEditing}
                onDelete={setPendingDelete}
                onDuplicate={handleDuplicate}
                deletingId={deletingId}
                sitePublishStatus={sitePublishQuery.data}
              />
            );
          }
          if (collectionKey === 'featuredMerchants') {
            return (
              <FeaturedMerchantCard
                item={item}
                onEdit={setEditing}
                onDelete={setPendingDelete}
                onDuplicate={handleDuplicate}
                deletingId={deletingId}
              />
            );
          }
          return (
            <HeroBannerCard
              item={item}
              onEdit={setEditing}
              onDelete={setPendingDelete}
              onDuplicate={handleDuplicate}
              deletingId={deletingId}
            />
          );
        };

        return (
          <>
            {truncatedNotice}
            <CollectionFilters
              ref={setFiltersEl}
              collectionKey={collectionKey}
              filters={filters}
              onChange={setFilters}
              resultCount={filteredItems.length}
              totalCount={translatedItems.length}
            />

            {filteredItems.length === 0 ? (
              <p className={styles.empty}>
                Ningún item coincide con los filtros activos.{' '}
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                  onClick={() => setFilters(DEFAULT_FILTERS)}
                >
                  Limpiar filtros
                </button>
              </p>
            ) : (
              <>
                {filteredItems.length < translatedItems.length && (
                  <p className={styles.filterCount}>
                    {filteredItems.length} de {translatedItems.length} items
                  </p>
                )}

                {/* Shown for the whole selection mode — it's the sticky companion
                    to the (non-sticky) header toggle. */}
                {selectionMode && (
                  <div className={styles.bulkBar} style={{ top: bulkBarTop }}>
                    <span className={styles.bulkCount}>
                      {selected.size === 0
                        ? 'Marca los items que quieras borrar'
                        : `${selected.size} seleccionado${selected.size === 1 ? '' : 's'}`}
                    </span>
                    <button
                      type="button"
                      className={styles.secondary}
                      onClick={() => setSelected(new Set(visibleIds))}
                      disabled={visibleIds.every((id) => selected.has(id))}
                    >
                      Seleccionar los {visibleIds.length} visibles
                    </button>
                    <button
                      type="button"
                      className={styles.secondary}
                      onClick={() => setSelected(new Set())}
                      disabled={selected.size === 0}
                    >
                      Quitar selección
                    </button>
                    <button
                      type="button"
                      className={styles.bulkDelete}
                      onClick={() => setConfirmingBulk(true)}
                      disabled={selected.size === 0 || bulkDeleteMutation.isPending}
                    >
                      <Trash2 size={16} /> Borrar seleccionados
                    </button>
                    <button type="button" className={styles.secondary} onClick={exitSelectionMode}>
                      <X size={16} /> Salir
                    </button>
                  </div>
                )}

                <div ref={containerRef}>
                  {filteredItems.map((item) => (
                    // The checkbox column always exists in the DOM — only its
                    // "active" class toggles — so its width/opacity can
                    // transition via CSS instead of popping in on mount.
                    <div key={item.id} className={styles.selectRow}>
                      <div
                        className={`${styles.selectBox} ${selectionMode ? styles.selectBoxActive : ''}`}
                        aria-hidden={!selectionMode}
                      >
                        <input
                          type="checkbox"
                          tabIndex={selectionMode ? 0 : -1}
                          checked={selected.has(item.id)}
                          onChange={() => toggleSelected(item.id)}
                          aria-label={`Seleccionar ${item.fieldData.name}`}
                        />
                      </div>
                      <div className={styles.selectRowCard}>{renderItemCard(item)}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        );
      })()}

      <ConfirmDialog
        open={confirmingBulk}
        title={`Borrar ${selected.size} item(s)`}
        message={
          <>
            Se borrarán <strong>{selected.size} item(s)</strong> de forma permanente del CMS de
            Webflow y se quitarán del sitio publicado. No se puede deshacer.
            {selectedNames.length > 0 && (
              <>
                {' '}
                <br />
                <br />
                <em>{selectedNames.join(', ')}</em>
                {selected.size > selectedNames.length
                  ? ` y ${selected.size - selectedNames.length} más.`
                  : ''}
              </>
            )}
          </>
        }
        confirmLabel={`Borrar ${selected.size}`}
        destructive
        busy={bulkDeleteMutation.isPending}
        onCancel={() => setConfirmingBulk(false)}
        onConfirm={() => bulkDeleteMutation.mutate([...selected])}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        title={`Borrar ${singularName.toLowerCase()}`}
        message={
          pendingDelete
            ? `¿Seguro que quieres borrar "${pendingDelete.fieldData.name}"? Esta acción no se puede deshacer y removerá el item del CMS de Webflow.`
            : ''
        }
        confirmLabel="Borrar"
        destructive
        busy={deleteMutation.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
      />

      {(creating || editing) && (
        <FormModal
          title={editing ? `Editar ${singularName.toLowerCase()}` : `Nuevo ${singularName.toLowerCase()}`}
          onClose={closeForm}
        >
          {renderForm()}
        </FormModal>
      )}
    </main>
  );
}

export default function CollectionPage(props: Props) {
  return (
    <QueryProvider>
      <CollectionPageInner {...props} />
      {/* Always mounted — bulk delete reports its result via toast regardless of
          whether the user can publish. */}
      <Toaster richColors position="top-center" />
    </QueryProvider>
  );
}
