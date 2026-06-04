import {
  createItem,
  deleteItem,
  listItems,
  updateItem,
  type WebflowItem,
} from '@lib/api-client';
import { withBase } from '@lib/base-path';
import type { CollectionKey } from '@lib/config/sites';
import { reverseTranslateOptionFields, translateOptionFields } from '@lib/webflow/option-maps';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import gsap from 'gsap';
import { CirclePlus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import CouponFilterForm from '../forms/CouponFilterForm';
import CouponForm from '../forms/CouponForm';
import HeroBannerForm from '../forms/HeroBannerForm';
import QueryProvider from '../providers/QueryProvider';
import ConfirmDialog from './ConfirmDialog';
import CouponCard from './CouponCard';
import CouponFilterCard from './CouponFilterCard';
import HeroBannerCard from './HeroBannerCard';
import styles from './dashboard.module.scss';

interface Props {
  collectionKey: CollectionKey;
  collectionId: string;
  displayName: string;
  singularName: string;
}

type AnyFields = Record<string, unknown> & { name: string; slug: string };


function CollectionPageInner({ collectionKey, collectionId, displayName, singularName }: Props) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<WebflowItem<AnyFields> | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<WebflowItem<AnyFields> | null>(null);

  const itemsQuery = useQuery({
    queryKey: ['collection', collectionId],
    queryFn: () => listItems<AnyFields>(collectionId),
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

      if (Object.keys(diff).length === 0) {
        closeForm();
        return;
      }
      const payload = reverseTranslateOptionFields(collectionKey, diff) as AnyFields;
      updateMutation.mutate({ id: editing.id, fields: payload });
    } else {
      createMutation.mutate(reverseTranslateOptionFields(collectionKey, values) as AnyFields);
    }
  };

  const submitting = createMutation.isPending || updateMutation.isPending;
  const editingDefaults = editing
    ? (translateOptionFields(collectionKey, editing.fieldData) as unknown as AnyFields)
    : undefined;

  const renderForm = () => {
    if (collectionKey === 'coupons') {
      return (
        <CouponForm
          collectionId={collectionId}
          defaultValues={editingDefaults as never}
          onSubmit={onSubmitForm as never}
          onCancel={closeForm}
          submitting={submitting}
        />
      );
    }
    if (collectionKey === 'couponFilterList') {
      return (
        <CouponFilterForm
          defaultValues={editingDefaults as never}
          onSubmit={onSubmitForm as never}
          onCancel={closeForm}
          submitting={submitting}
        />
      );
    }
    return (
      <HeroBannerForm
        collectionId={collectionId}
        defaultValues={editingDefaults as never}
        onSubmit={onSubmitForm as never}
        onCancel={closeForm}
        submitting={submitting}
      />
    );
  };

  return (
    <main className={styles.page}>
      <a href={withBase('dashboard')} className={styles.back}>← Volver al dashboard</a>
      <header className={styles.toolbar}>
        <h1>{displayName}</h1>
        <button type="button" className={styles.primary} onClick={() => setCreating(true)}>
          <CirclePlus size={16} /> Nuevo {singularName.toLowerCase()}
        </button>
      </header>

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

        const deletingId = deleteMutation.isPending ? deleteMutation.variables : undefined;

        return (
          <div ref={containerRef}>
            {translatedItems.map((item) => {
              if (collectionKey === 'coupons') {
                return (
                  <CouponCard
                    key={item.id}
                    item={item}
                    onEdit={setEditing}
                    onDelete={setPendingDelete}
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
                    deletingId={deletingId}
                  />
                );
              }
              return (
                <HeroBannerCard
                  key={item.id}
                  item={item}
                  onEdit={setEditing}
                  onDelete={setPendingDelete}
                  deletingId={deletingId}
                />
              );
            })}
          </div>
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
        <div
          className={styles.modal}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeForm();
          }}
        >
          <div className={styles.modalCard}>
            <h2>
              {editing ? `Editar ${singularName.toLowerCase()}` : `Nuevo ${singularName.toLowerCase()}`}
            </h2>
            {renderForm()}
          </div>
        </div>
      )}
    </main>
  );
}

export default function CollectionPage(props: Props) {
  return (
    <QueryProvider>
      <CollectionPageInner {...props} />
    </QueryProvider>
  );
}
