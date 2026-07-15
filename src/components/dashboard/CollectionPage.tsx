import {
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
import { reverseTranslateOptionFields, translateOptionFields } from '@lib/webflow/option-maps';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import gsap from 'gsap';
import { CirclePlus, ArrowLeft, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Toaster } from 'sonner';
import { blogFieldsFromWebflow, blogFieldsToWebflow } from '@lib/blog-fields';
import BlogPostForm from '../forms/BlogPostForm';
import CouponFilterForm from '../forms/CouponFilterForm';
import CouponForm from '../forms/CouponForm';
import HeroBannerForm from '../forms/HeroBannerForm';
import QueryProvider from '../providers/QueryProvider';
import BlogPostCard from './BlogPostCard';
import ConfirmDialog from './ConfirmDialog';
import CollectionFilters, { DEFAULT_FILTERS, type FilterState } from './CollectionFilters';
import CouponCard from './CouponCard';
import CouponFilterCard from './CouponFilterCard';
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

function FormModal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const backdrop = backdropRef.current;
    const card = cardRef.current;
    if (!backdrop || !card) return;
    gsap.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power2.out' });
    gsap.fromTo(card, { scale: 0.92, opacity: 0, y: 16 }, { scale: 1, opacity: 1, y: 0, duration: 0.3, ease: 'back.out(1.5)' });
  }, []);

  const handleClose = () => {
    const backdrop = backdropRef.current;
    const card = cardRef.current;
    if (!backdrop || !card) { onClose(); return; }
    gsap.to(card, { scale: 0.92, opacity: 0, y: 16, duration: 0.2, ease: 'power2.in' });
    gsap.to(backdrop, { opacity: 0, duration: 0.25, ease: 'power2.in', onComplete: onClose });
  };

  return createPortal(
    <div
      ref={backdropRef}
      className={styles.modal}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div ref={cardRef} className={styles.modalCard}>
        <div className={styles.modalHeader}>
          <h2>{title}</h2>
          <button type="button" className={styles.modalCloseBtn} onClick={handleClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

function CollectionPageInner({ collectionKey, collectionId, displayName, singularName, siteId, canPublish }: Props) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<WebflowItem<AnyFields> | null>(null);
  const [creating, setCreating] = useState(false);
  const [createDefaults, setCreateDefaults] = useState<AnyFields | undefined>(undefined);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [pendingDelete, setPendingDelete] = useState<WebflowItem<AnyFields> | null>(null);

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
        <button type="button" className={styles.primary} onClick={() => setCreating(true)}>
          <CirclePlus size={16} /> Nuevo {singularName.toLowerCase()}
        </button>
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
            if (filters.status) {
              const display = getDisplayField(collectionKey, item.fieldData);
              if (getStatus(display) !== filters.status) return false;
            }
            if (filters.siteDestination && collectionKey === 'heroBanners') {
              if (item.fieldData['pagina-despliegue'] !== filters.siteDestination) return false;
            }
            return true;
          })
          .sort((a, b) => {
            const aTs = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
            const bTs = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
            return filters.sortOrder === 'asc' ? aTs - bTs : bTs - aTs;
          });

        const deletingId = deleteMutation.isPending ? deleteMutation.variables : undefined;

        return (
          <>
            <CollectionFilters
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
                <div ref={containerRef}>
                  {filteredItems.map((item) => {
                    if (collectionKey === 'coupons') {
                      return (
                        <CouponCard
                          key={item.id}
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
                          key={item.id}
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
                          key={item.id}
                          item={item}
                          onEdit={setEditing}
                          onDelete={setPendingDelete}
                          onDuplicate={handleDuplicate}
                          deletingId={deletingId}
                          sitePublishStatus={sitePublishQuery.data}
                        />
                      );
                    }
                    return (
                      <HeroBannerCard
                        key={item.id}
                        item={item}
                        onEdit={setEditing}
                        onDelete={setPendingDelete}
                        onDuplicate={handleDuplicate}
                        deletingId={deletingId}
                      />
                    );
                  })}
                </div>
              </>
            )}
          </>
        );
      })()}

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
      {props.canPublish && <Toaster richColors position="top-center" />}
    </QueryProvider>
  );
}
