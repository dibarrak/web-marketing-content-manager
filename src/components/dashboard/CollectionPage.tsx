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
import { useState } from 'react';
import CouponFilterForm from '../forms/CouponFilterForm';
import CouponForm from '../forms/CouponForm';
import HeroBannerForm from '../forms/HeroBannerForm';
import QueryProvider from '../providers/QueryProvider';
import ConfirmDialog from './ConfirmDialog';
import CouponCard from './CouponCard';
import CouponFilterCard from './CouponFilterCard';
import styles from './dashboard.module.scss';
import ItemTable, { type ColumnDef } from './ItemTable';

interface Props {
  collectionKey: CollectionKey;
  collectionId: string;
  displayName: string;
  singularName: string;
}

type AnyFields = Record<string, unknown> & { name: string; slug: string };

const COLUMNS: Record<CollectionKey, ColumnDef<AnyFields>[]> = {
  coupons: [
    { key: 'name', label: 'Name' },
    { key: 'coupon-title', label: 'Título' },
    { key: 'related-merchants', label: 'Merchants', thumb: true },
    { key: 'coupon-display', label: 'Display' },
    { key: 'lastUpdated', label: 'Actualizado' },
  ],
  couponFilterList: [
    { key: 'name', label: 'Name' },
    { key: 'slug', label: 'Slug' },
    { key: 'coupon-display', label: 'Display' },
    { key: 'lastUpdated', label: 'Actualizado' },
  ],
  heroBanners: [
    { key: 'imagen-2', label: 'Imagen', thumb: true },
    { key: 'name', label: 'Name' },
    { key: 'pagina-despliegue', label: 'Página' },
    { key: 'fechas-despliegue', label: 'Fechas' },
    { key: 'lastUpdated', label: 'Actualizado' },
  ],
};

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
          + Nuevo {singularName.toLowerCase()}
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

        if (collectionKey === 'coupons') {
          return translatedItems.length === 0 ? (
            <p className={styles.empty}>
              Sin items todavía. Click en "Nuevo" para crear el primero.
            </p>
          ) : (
            <div>
              {translatedItems.map((item) => (
                <CouponCard
                  key={item.id}
                  item={item}
                  onEdit={setEditing}
                  onDelete={setPendingDelete}
                  deletingId={deleteMutation.isPending ? deleteMutation.variables : undefined}
                />
              ))}
            </div>
          );
        }

        if (collectionKey === 'couponFilterList') {
          return translatedItems.length === 0 ? (
            <p className={styles.empty}>
              Sin items todavía. Click en "Nuevo" para crear el primero.
            </p>
          ) : (
            <div>
              {translatedItems.map((item) => (
                <CouponFilterCard
                  key={item.id}
                  item={item}
                  onEdit={setEditing}
                  onDelete={setPendingDelete}
                  deletingId={deleteMutation.isPending ? deleteMutation.variables : undefined}
                />
              ))}
            </div>
          );
        }

        return (
          <ItemTable<AnyFields>
            items={translatedItems}
            columns={COLUMNS[collectionKey]}
            onEdit={(item) => setEditing(item)}
            onDelete={(item) => setPendingDelete(item)}
            deletingId={deleteMutation.isPending ? deleteMutation.variables : undefined}
          />
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
