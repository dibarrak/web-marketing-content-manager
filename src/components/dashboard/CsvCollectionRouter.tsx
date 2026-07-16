import type { CsvCollectionKey } from '@lib/config/csvCollections';
import {
  AD_BANNER_CSV_HEADERS,
  adBannerSchema,
  adBannerToCsvRow,
  csvRowToAdBanner,
  isAdBannerActive,
  nextAdBannerId,
  SEGMENT_LABELS,
  USER_SEGMENTS,
  type AdBannerFields,
} from '@lib/csv-modules/adBanners';
import AdBannerForm from '../forms/AdBannerForm';
import AdBannerCard from './AdBannerCard';
import CsvCollectionPage, { type CsvFilterConfig } from './CsvCollectionPage';

const AD_BANNER_FILTERS: CsvFilterConfig<AdBannerFields>[] = [
  {
    key: 'status',
    label: 'Vigencia',
    options: [
      { value: 'active', label: 'Vigentes' },
      { value: 'inactive', label: 'Fuera de rango' },
    ],
    matches: (item, selected) => (selected === 'active') === isAdBannerActive(item),
  },
  {
    key: 'segment',
    label: 'Segmento',
    options: USER_SEGMENTS.map((s) => ({ value: s, label: SEGMENT_LABELS[s] })),
    matches: (item, selected) => item.user_segment.includes(selected as (typeof USER_SEGMENTS)[number]),
  },
];

interface Props {
  csvKey: CsvCollectionKey;
  displayName: string;
  singularName: string;
}

/** Picks the CsvCollectionPage instantiation for a given CSV module key. */
export default function CsvCollectionRouter({ csvKey, displayName, singularName }: Props) {
  if (csvKey === 'adBanners') {
    return (
      <CsvCollectionPage<AdBannerFields>
        displayName={displayName}
        singularName={singularName}
        csvHeaders={AD_BANNER_CSV_HEADERS}
        schema={adBannerSchema}
        csvRowToRow={csvRowToAdBanner}
        rowToCsvRow={adBannerToCsvRow}
        getCreateDefaults={(rows) => ({ id: nextAdBannerId(rows) })}
        filters={AD_BANNER_FILTERS}
        renderForm={({ defaultValues, onSubmit, onCancel, isEditing }) => (
          <AdBannerForm
            defaultValues={defaultValues}
            onSubmit={onSubmit}
            onCancel={onCancel}
            isEditing={isEditing}
          />
        )}
        renderCard={({ item, onEdit, onDuplicate, onDelete }) => (
          <AdBannerCard item={item} onEdit={onEdit} onDuplicate={onDuplicate} onDelete={onDelete} />
        )}
      />
    );
  }
  return null;
}
