import type { CollectionKey } from '@lib/config/sites';
import { BrushCleaning } from 'lucide-react';
import styles from './dashboard.module.scss';

export interface FilterState {
  search: string;
  siteDestination: string;
  status: '' | 'active' | 'inactive' | 'hidden';
  sortOrder: 'asc' | 'desc';
}

export const DEFAULT_FILTERS: FilterState = {
  search: '',
  siteDestination: '',
  status: '',
  sortOrder: 'desc',
};

export const HERO_BANNER_SITES = [
  'Home',
  'Promociones',
  'Registrate Hoy',
  'Amazon',
  'Temu',
  'Prototype',
] as const;

const STATUS_OPTIONS: { value: FilterState['status']; label: string }[] = [
  { value: 'active', label: 'Activo' },
  { value: 'inactive', label: 'Inactivo' },
  { value: 'hidden', label: 'Oculto' },
];

interface Props {
  collectionKey: CollectionKey;
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  resultCount: number;
  totalCount: number;
}

export default function CollectionFilters({
  collectionKey,
  filters,
  onChange,
}: Props) {
  const set = <K extends keyof FilterState>(key: K, value: FilterState[K]) =>
    onChange({ ...filters, [key]: value });

  const activeCount =
    (filters.search ? 1 : 0) +
    (filters.siteDestination ? 1 : 0) +
    (filters.status ? 1 : 0);

  const isDefault = activeCount === 0 && filters.sortOrder === 'desc';

  const searchPlaceholder =
    collectionKey === 'heroBanners' ? 'Buscar por título o nombre…' : 'Buscar por nombre…';

  return (
    <div className={styles.filters}>
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

      <label>
        Última modificación
        <select
          value={filters.sortOrder}
          onChange={(e) => set('sortOrder', e.target.value as FilterState['sortOrder'])}
        >
          <option value="desc">Más reciente primero</option>
          <option value="asc">Más antiguo primero</option>
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
}
