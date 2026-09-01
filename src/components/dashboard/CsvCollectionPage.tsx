import { withBase } from '@lib/base-path';
import { downloadCsv, parseCsvFile, unparseCsv, validateHeaders } from '@lib/csv';
import { ArrowLeft, CirclePlus, Download } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { Toaster, toast } from 'sonner';
import type { ZodType } from 'zod';
import fieldStyles from '../forms/fields/fields.module.scss';
import QueryProvider from '../providers/QueryProvider';
import ConfirmDialog from './ConfirmDialog';
import styles from './dashboard.module.scss';
import FormModal from './FormModal';

interface RowEntry<Row> {
  /** Internal-only React/CRUD identity — NOT written to the CSV. Business id
   *  fields in these datasets aren't guaranteed unique, so we can't use them
   *  as the key. */
  key: string;
  data: Row;
}

function newKey(): string {
  return crypto.randomUUID();
}

export interface CsvFilterOption {
  value: string;
  label: string;
}

export interface CsvFilterConfig<Row> {
  key: string;
  label: string;
  options: CsvFilterOption[];
  /** Called only when a value is selected ('' = filter not applied, every row passes). */
  matches: (item: Row, selected: string) => boolean;
}

export interface CsvUniqueFieldConfig<Row> {
  /** Used in error messages, e.g. "banner_id". */
  label: string;
  getValue: (row: Row) => string;
}

export interface CsvCollectionPageProps<Row> {
  displayName: string;
  singularName: string;
  /**
   * Filename always used on download, regardless of what the uploaded file
   * was named — the consuming S3/app logic expects this exact name.
   */
  downloadFileName: string;
  /** Expected column set/order — an uploaded file must match exactly. */
  csvHeaders: readonly string[];
  /** Validates a single typed row (post csvRowToRow transform). */
  schema: ZodType<Row>;
  /** Raw CSV row (all strings) → typed row for the edit UI. */
  csvRowToRow: (raw: Record<string, string>) => Row;
  /** Typed row → raw CSV row (all strings), ready for export. */
  rowToCsvRow: (row: Row) => Record<string, string>;
  /** Defaults applied on top of a new/duplicated row (e.g. a fresh suggested id). */
  getCreateDefaults: (rows: Row[]) => Partial<Row>;
  /** Optional view-only filters — never affect what gets exported on download. */
  filters?: CsvFilterConfig<Row>[];
  /** Optional free-text search — returns the haystack to match the query against (case-insensitive). View-only, like `filters`. */
  search?: (item: Row) => string;
  /** Optional cross-row uniqueness constraint, checked on upload, save, and download. */
  uniqueField?: CsvUniqueFieldConfig<Row>;
  renderForm: (p: {
    defaultValues?: Partial<Row>;
    onSubmit: (row: Row) => void;
    onCancel: () => void;
    isEditing: boolean;
    /** Every other row currently loaded (excludes the one being edited) —
     * for cross-row hints a form may want (e.g. duplicate id warnings).
     * Most collections ignore this. */
    allRows: Row[];
  }) => ReactNode;
  renderCard: (p: {
    item: Row;
    onEdit: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
  }) => ReactNode;
}

function CsvCollectionPageInner<Row>({
  displayName,
  singularName,
  downloadFileName,
  csvHeaders,
  schema,
  csvRowToRow,
  rowToCsvRow,
  getCreateDefaults,
  filters,
  search,
  uniqueField,
  renderForm,
  renderCard,
}: CsvCollectionPageProps<Row>) {
  const [rows, setRows] = useState<RowEntry<Row>[] | null>(null); // null = upload phase
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const hasActiveFilters = Object.values(filterValues).some((v) => v) || !!searchQuery;
  const resetFilters = () => {
    setFilterValues({});
    setSearchQuery('');
  };

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createDefaults, setCreateDefaults] = useState<Partial<Row> | undefined>(undefined);
  const [pendingDeleteKey, setPendingDeleteKey] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploadErrors([]);
    try {
      const { headers, rows: rawRows } = await parseCsvFile(file);
      const { missing, unexpected } = validateHeaders(headers, csvHeaders);
      const headerErrors: string[] = [];
      if (missing.length > 0) headerErrors.push(`Faltan columnas: ${missing.join(', ')}`);
      if (unexpected.length > 0) headerErrors.push(`Columnas no reconocidas: ${unexpected.join(', ')}`);
      if (headerErrors.length > 0) {
        setUploadErrors(headerErrors);
        return;
      }

      const rowErrors: string[] = [];
      const parsedRows: RowEntry<Row>[] = [];
      rawRows.forEach((raw, i) => {
        const candidate = csvRowToRow(raw);
        const result = schema.safeParse(candidate);
        const lineNo = i + 2; // +1 for the header row, +1 for 1-indexing
        if (!result.success) {
          for (const issue of result.error.issues) {
            rowErrors.push(`Fila ${lineNo} (${issue.path.join('.')}): ${issue.message}`);
          }
        } else {
          parsedRows.push({ key: newKey(), data: result.data });
        }
      });

      if (rowErrors.length > 0) {
        setUploadErrors(rowErrors);
        return;
      }

      if (uniqueField) {
        const firstSeenAt = new Map<string, number>();
        const dupErrors: string[] = [];
        parsedRows.forEach((entry, i) => {
          const lineNo = i + 2; // +1 for the header row, +1 for 1-indexing
          const value = uniqueField.getValue(entry.data);
          const firstLine = firstSeenAt.get(value);
          if (firstLine !== undefined) {
            dupErrors.push(
              `Fila ${lineNo} (${uniqueField.label}): duplicado — ya se usó en la fila ${firstLine}.`,
            );
          } else {
            firstSeenAt.set(value, lineNo);
          }
        });
        if (dupErrors.length > 0) {
          setUploadErrors(dupErrors);
          return;
        }
      }

      setRows(parsedRows);
    } catch (err) {
      setUploadErrors([err instanceof Error ? err.message : 'No se pudo leer el archivo.']);
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const closeForm = () => {
    setCreating(false);
    setEditingKey(null);
    setCreateDefaults(undefined);
  };

  const editingEntry = rows?.find((r) => r.key === editingKey);

  const handleSubmitForm = (row: Row) => {
    if (uniqueField) {
      const value = uniqueField.getValue(row);
      const conflict = (rows ?? []).find(
        (r) => r.key !== editingEntry?.key && uniqueField.getValue(r.data) === value,
      );
      if (conflict) {
        toast.error(`Ya existe otro elemento con ${uniqueField.label} "${value}".`);
        return;
      }
    }
    if (editingEntry) {
      setRows((prev) =>
        (prev ?? []).map((r) => (r.key === editingEntry.key ? { ...r, data: row } : r)),
      );
    } else {
      setRows((prev) => [...(prev ?? []), { key: newKey(), data: row }]);
    }
    closeForm();
  };

  const openCreate = () => {
    setCreateDefaults(getCreateDefaults((rows ?? []).map((r) => r.data)));
    setCreating(true);
  };

  const handleDuplicate = (entry: RowEntry<Row>) => {
    setCreateDefaults({ ...entry.data, ...getCreateDefaults((rows ?? []).map((r) => r.data)) });
    setCreating(true);
  };

  const handleDelete = () => {
    if (!pendingDeleteKey) return;
    setRows((prev) => (prev ?? []).filter((r) => r.key !== pendingDeleteKey));
    setPendingDeleteKey(null);
  };

  const handleDownload = () => {
    const current = rows ?? [];
    // Defense in depth — rows only ever enter state through the validated
    // form, but re-check before export in case a future bug lets one through.
    const invalid = current.filter((r) => !schema.safeParse(r.data).success);
    if (invalid.length > 0) {
      toast.error(`${invalid.length} fila(s) inválida(s) — corrígelas antes de descargar.`);
      return;
    }
    if (uniqueField) {
      const seen = new Set<string>();
      const hasDupes = current.some((r) => {
        const value = uniqueField.getValue(r.data);
        if (seen.has(value)) return true;
        seen.add(value);
        return false;
      });
      if (hasDupes) {
        toast.error(`Hay valores duplicados de ${uniqueField.label} — corrígelos antes de descargar.`);
        return;
      }
    }
    const csvText = unparseCsv(csvHeaders, current.map((r) => rowToCsvRow(r.data)));
    downloadCsv(downloadFileName, csvText);
    toast.success('CSV descargado', { description: downloadFileName });
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void handleFile(f);
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();

  // View-only — the full `rows` list (unfiltered) is always what gets exported.
  const visibleRows = (rows ?? []).filter((entry) => {
    if (normalizedQuery && !search?.(entry.data).toLowerCase().includes(normalizedQuery)) {
      return false;
    }
    return (filters ?? []).every((f) => {
      const selected = filterValues[f.key] ?? '';
      return !selected || f.matches(entry.data, selected);
    });
  });

  if (rows === null) {
    return (
      <main className={styles.page}>
        <a href={withBase('dashboard')} className={styles.back}>
          <ArrowLeft className={styles.backIcon} size={16} /> Volver al dashboard
        </a>
        <header className={styles.toolbar}>
          <h1>{displayName}</h1>
        </header>

        <div
          className={`${fieldStyles.dropzone} ${fieldStyles.marginBottom} ${dragging ? fieldStyles.dragging : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
          }}
        >
          <p style={{ margin: 0 }}>
            Arrastra el CSV de {displayName} aquí, o haz click para seleccionar
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
        </div>

        {uploadErrors.length > 0 && (
          <div className={styles.errorBanner}>
            <strong>El archivo tiene {uploadErrors.length} problema(s):</strong>
            <ul className={styles.errorList}>
              {uploadErrors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <a href={withBase('dashboard')} className={styles.back}>
        <ArrowLeft className={styles.backIcon} size={16} /> Volver al dashboard
      </a>
      <header className={styles.toolbar}>
        <h1>{displayName}</h1>
        <div className={styles.toolbarActions}>
          <button type="button" className={styles.secondary} onClick={handleDownload}>
            <Download size={16} /> Descargar CSV
          </button>
          <button type="button" className={styles.primary} onClick={openCreate}>
            <CirclePlus size={16} /> Nuevo {singularName.toLowerCase()}
          </button>
        </div>
      </header>

      {(search || (filters && filters.length > 0)) && (
        <div className={styles.filters}>
          {search && (
            <label className={styles.searchLabel}>
              Buscar
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Buscar ${singularName.toLowerCase()}...`}
              />
            </label>
          )}
          {filters?.map((f) => (
            <label key={f.key}>
              {f.label}
              <select
                value={filterValues[f.key] ?? ''}
                onChange={(e) =>
                  setFilterValues((prev) => ({ ...prev, [f.key]: e.target.value }))
                }
              >
                <option value="">Todos</option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <button
            type="button"
            className={styles.filterReset}
            onClick={resetFilters}
            disabled={!hasActiveFilters}
          >
            Limpiar filtros
          </button>
        </div>
      )}

      {visibleRows.length < rows.length && (
        <p className={styles.filterCount}>
          {visibleRows.length} de {rows.length} items
        </p>
      )}

      {rows.length === 0 ? (
        <p className={styles.empty}>Sin items. Click en "Nuevo" para crear el primero.</p>
      ) : visibleRows.length === 0 ? (
        <p className={styles.empty}>
          Ningún elemento coincide con los filtros.{' '}
          <button type="button" className={styles.secondary} onClick={resetFilters}>
            Limpiar filtros
          </button>
        </p>
      ) : (
        visibleRows.map((entry) => (
          <div key={entry.key}>
            {renderCard({
              item: entry.data,
              onEdit: () => setEditingKey(entry.key),
              onDuplicate: () => handleDuplicate(entry),
              onDelete: () => setPendingDeleteKey(entry.key),
            })}
          </div>
        ))
      )}

      <ConfirmDialog
        open={!!pendingDeleteKey}
        title={`Borrar ${singularName.toLowerCase()}`}
        message="¿Seguro que quieres borrar este elemento? No se puede deshacer — recuerda descargar el CSV para conservar los cambios."
        confirmLabel="Borrar"
        destructive
        onCancel={() => setPendingDeleteKey(null)}
        onConfirm={handleDelete}
      />

      {(creating || editingEntry) && (
        <FormModal
          title={editingEntry ? `Editar ${singularName.toLowerCase()}` : `Nuevo ${singularName.toLowerCase()}`}
          onClose={closeForm}
        >
          {renderForm({
            defaultValues: editingEntry ? editingEntry.data : createDefaults,
            onSubmit: handleSubmitForm,
            onCancel: closeForm,
            isEditing: !!editingEntry,
            allRows: (rows ?? []).filter((r) => r.key !== editingEntry?.key).map((r) => r.data),
          })}
        </FormModal>
      )}
    </main>
  );
}

export default function CsvCollectionPage<Row>(props: CsvCollectionPageProps<Row>) {
  return (
    <QueryProvider>
      <CsvCollectionPageInner {...props} />
      <Toaster richColors position="top-center" />
    </QueryProvider>
  );
}
