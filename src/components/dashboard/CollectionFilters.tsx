import { hasDateRangeStatus } from '@lib/collection-status';
import { referenceCollectionId, type CollectionKey } from '@lib/config/sites';
import { MERCHANT_TYPES } from '@lib/featured-merchants';
import { PUBLISH_STATE_LABELS, type PublishState } from '@lib/publish-state';
import { useReferenceOptions } from '@lib/reference-options';
import { BrushCleaning } from 'lucide-react';
import { forwardRef } from 'react';
import styles from './dashboard.module.scss';

export interface FilterState {
  search: string;
  siteDestination: string;
  /** Featured merchants — referenced category item id. */
  category: string;
  /** Featured merchants — `tipo-de-comercio` option name. */
  merchantType: string;
  /** Live in the Webflow CMS vs still a draft. Applies to every collection. */
  publishState: '' | PublishState;
  status: '' | 'active' | 'inactive' | 'hidden';
  /** Which field the list is sorted by. `orden` only exists on some collections. */
  sortBy: 'lastUpdated' | 'orden';
  sortOrder: 'asc' | 'desc';
}

export const DEFAULT_FILTERS: FilterState = {
  search: '',
  siteDestination: '',
  category: '',
  merchantType: '',
  publishState: '',
  status: '',
  sortBy: 'lastUpdated',
  sortOrder: 'desc',
};

export const HERO_BANNER_SITES = [
  'Home',
  'Promociones',
  'Registrate Hoy',
  'Amazon',
  'Temu',
  'Prototype',
  'Longtail',
] as const;

const STATUS_OPTIONS: { value: FilterState['status']; label: string }[] = [
  { value: 'active', label: 'Activo' },
  { value: 'inactive', label: 'Inactivo' },
  { value: 'hidden', label: 'Oculto' },
];

/**
 * Sort choices, encoded as `field:direction` so one select drives both. The
 * `orden` pair is only offered on collections that have that field.
 */
const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'lastUpdated:desc', label: 'Modificado — más reciente primero' },
  { value: 'lastUpdated:asc', label: 'Modificado — más antiguo primero' },
];

const ORDEN_SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'orden:asc', label: 'Orden — ascendente (1 → 9)' },
  { value: 'orden:desc', label: 'Orden — descendente (9 → 1)' },
];

/** Category picker for featured merchants — its own component so the options
 *  query only runs on that collection. */
function CategoryFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { data: options = [], isLoading, isError } = useReferenceOptions(
    referenceCollectionId('featuredMerchants', 'categoria'),
  );

  return (
    <label>
      Categoría
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={isLoading}>
        <option value="">
          {isLoading ? 'Cargando…' : isError ? 'Error al cargar' : 'Todas'}
        </option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}

interface Props {
  collectionKey: CollectionKey;
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  resultCount: number;
  totalCount: number;
}

/**
 * Forwards a ref to the root `.filters` div so CollectionPage can measure its
 * real rendered height (for positioning the bulk-selection bar right below
 * it) WITHOUT wrapping it in an extra div — a wrapper div would become this
 * sticky element's containing block and, being sized to fit it exactly,
 * would leave no room for it to actually stick while scrolling.
 */
const CollectionFilters = forwardRef<HTMLDivElement, Props>(function CollectionFilters(
  { collectionKey, filters, onChange },
  ref,
) {
  const set = <K extends keyof FilterState>(key: K, value: FilterState[K]) =>
    onChange({ ...filters, [key]: value });

  const isFeaturedMerchants = collectionKey === 'featuredMerchants';

  const activeCount =
    (filters.search ? 1 : 0) +
    (filters.siteDestination ? 1 : 0) +
    (filters.category ? 1 : 0) +
    (filters.merchantType ? 1 : 0) +
    (filters.publishState ? 1 : 0) +
    (filters.status ? 1 : 0);

  const isDefault =
    activeCount === 0 &&
    filters.sortBy === DEFAULT_FILTERS.sortBy &&
    filters.sortOrder === DEFAULT_FILTERS.sortOrder;

  const sortOptions = isFeaturedMerchants
    ? [...ORDEN_SORT_OPTIONS, ...SORT_OPTIONS]
    : SORT_OPTIONS;

  const searchPlaceholder =
    collectionKey === 'heroBanners' ? 'Buscar por título o nombre…' : 'Buscar por nombre…';

  return (
    <div className={styles.filters} ref={ref}>
      <label>
        Búsqueda
        <input
          type="search"
          value={filters.search}
          onChange={(e) => set('search', e.target.value)}
          placeholder={searchPlaceholder}
        />
      </label>

      {collectionKey === 'heroBanners' && (
        <label>
          Sitio de destino
          <select
            value={filters.siteDestination}
            onChange={(e) => set('siteDestination', e.target.value)}
          >
            <option value="">Todos</option>
            {HERO_BANNER_SITES.map((site) => (
              <option key={site} value={site}>
                {site}
              </option>
            ))}
          </select>
        </label>
      )}

      {isFeaturedMerchants && (
        <CategoryFilter value={filters.category} onChange={(v) => set('category', v)} />
      )}

      {isFeaturedMerchants && (
        <label>
          Tipo de comercio
          <select
            value={filters.merchantType}
            onChange={(e) => set('merchantType', e.target.value)}
          >
            <option value="">Todos</option>
            {MERCHANT_TYPES.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}

      <label>
        Publicación
        <select
          value={filters.publishState}
          onChange={(e) => set('publishState', e.target.value as FilterState['publishState'])}
        >
          <option value="">Todos</option>
          <option value="published">{PUBLISH_STATE_LABELS.published}</option>
          <option value="draft">{PUBLISH_STATE_LABELS.draft}</option>
        </select>
      </label>

      {/* Only meaningful where a date-range field drives visibility — elsewhere
          every item resolves to "Oculto" and the filter is misleading. */}
      {hasDateRangeStatus(collectionKey) && (
        <label>
          Estado
          <select
            value={filters.status}
            onChange={(e) => set('status', e.target.value as FilterState['status'])}
          >
            <option value="">Todos</option>
            {STATUS_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}

      <label>
        Ordenar por
        <select
          value={`${filters.sortBy}:${filters.sortOrder}`}
          onChange={(e) => {
            const [sortBy, sortOrder] = e.target.value.split(':');
            onChange({
              ...filters,
              sortBy: sortBy as FilterState['sortBy'],
              sortOrder: sortOrder as FilterState['sortOrder'],
            });
          }}
        >
          {sortOptions.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        className={styles.filterReset}
        onClick={() => onChange({ ...DEFAULT_FILTERS })}
        disabled={isDefault}
        title="Limpiar filtros"
      >
        Limpiar{activeCount > 0 ? ` (${activeCount})` : ''}
        <BrushCleaning size={16} />
      </button>
    </div>
  );
});

export default CollectionFilters;
