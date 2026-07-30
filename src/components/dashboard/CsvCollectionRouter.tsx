import { CSV_COLLECTIONS, type CsvCollectionKey } from '@lib/config/csvCollections';
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
import {
  csvRowToOfferwallBanner,
  isOfferwallBannerActive,
  offerwallBannerSchema,
  offerwallBannerToCsvRow,
  OFFERWALL_BANNER_CSV_HEADERS,
  type OfferwallBannerFields,
} from '@lib/csv-modules/offerwallBanners';
import {
  csvRowToHomeHeroBanner,
  homeHeroBannerSchema,
  homeHeroBannerToCsvRow,
  HOME_HERO_BANNER_CSV_HEADERS,
  HOME_HERO_SEGMENT_LABELS,
  HOME_HERO_USER_SEGMENTS,
  isHomeHeroBannerActive,
  type HomeHeroBannerFields,
} from '@lib/csv-modules/homeHeroBanners';
import AdBannerForm from '../forms/AdBannerForm';
import HomeHeroBannerForm from '../forms/HomeHeroBannerForm';
import OfferwallBannerForm from '../forms/OfferwallBannerForm';
import AdBannerCard from './AdBannerCard';
import CsvCollectionPage, { type CsvFilterConfig } from './CsvCollectionPage';
import HomeHeroBannerCard from './HomeHeroBannerCard';
import OfferwallBannerCard from './OfferwallBannerCard';

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

const OFFERWALL_FILTERS: CsvFilterConfig<OfferwallBannerFields>[] = [
  {
    key: 'status',
    label: 'Vigencia',
    options: [
      { value: 'active', label: 'Vigentes' },
      { value: 'inactive', label: 'Fuera de rango' },
    ],
    matches: (item, selected) => (selected === 'active') === isOfferwallBannerActive(item),
  },
  {
    key: 'segment',
    label: 'Segmento',
    options: USER_SEGMENTS.map((s) => ({ value: s, label: SEGMENT_LABELS[s] })),
    matches: (item, selected) => item.user_segment.includes(selected as (typeof USER_SEGMENTS)[number]),
  },
];

const searchAdBanner = (item: AdBannerFields) =>
  [item.id, item.merchant_id, item.click_url].join(' ');

const searchOfferwallBanner = (item: OfferwallBannerFields) =>
  [item.banner_id, item.title, item.description, item.merchant_ids.join(' ')].join(' ');

const searchHomeHeroBanner = (item: HomeHeroBannerFields) =>
  [item.campaign_id, item.title, item.subtitle, item.merchant_id].join(' ');

const HOME_HERO_FILTERS: CsvFilterConfig<HomeHeroBannerFields>[] = [
  {
    key: 'status',
    label: 'Vigencia',
    options: [
      { value: 'active', label: 'Vigentes' },
      { value: 'inactive', label: 'Fuera de rango' },
    ],
    matches: (item, selected) => (selected === 'active') === isHomeHeroBannerActive(item),
  },
  {
    key: 'segment',
    label: 'Segmento',
    options: HOME_HERO_USER_SEGMENTS.map((s) => ({ value: s, label: HOME_HERO_SEGMENT_LABELS[s] })),
    matches: (item, selected) =>
      item.user_segment.includes(selected as (typeof HOME_HERO_USER_SEGMENTS)[number]),
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
        downloadFileName={CSV_COLLECTIONS.adBanners.downloadFileName}
        csvHeaders={AD_BANNER_CSV_HEADERS}
        schema={adBannerSchema}
        csvRowToRow={csvRowToAdBanner}
        rowToCsvRow={adBannerToCsvRow}
        getCreateDefaults={(rows) => ({ id: nextAdBannerId(rows) })}
        filters={AD_BANNER_FILTERS}
        search={searchAdBanner}
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
  if (csvKey === 'offerwallBanners') {
    return (
      <CsvCollectionPage<OfferwallBannerFields>
        displayName={displayName}
        singularName={singularName}
        downloadFileName={CSV_COLLECTIONS.offerwallBanners.downloadFileName}
        csvHeaders={OFFERWALL_BANNER_CSV_HEADERS}
        schema={offerwallBannerSchema}
        csvRowToRow={csvRowToOfferwallBanner}
        rowToCsvRow={offerwallBannerToCsvRow}
        getCreateDefaults={() => ({})}
        filters={OFFERWALL_FILTERS}
        search={searchOfferwallBanner}
        renderForm={({ defaultValues, onSubmit, onCancel, isEditing }) => (
          <OfferwallBannerForm
            defaultValues={defaultValues}
            onSubmit={onSubmit}
            onCancel={onCancel}
            isEditing={isEditing}
          />
        )}
        renderCard={({ item, onEdit, onDuplicate, onDelete }) => (
          <OfferwallBannerCard item={item} onEdit={onEdit} onDuplicate={onDuplicate} onDelete={onDelete} />
        )}
      />
    );
  }
  if (csvKey === 'homeHeroBanners') {
    return (
      <CsvCollectionPage<HomeHeroBannerFields>
        displayName={displayName}
        singularName={singularName}
        downloadFileName={CSV_COLLECTIONS.homeHeroBanners.downloadFileName}
        csvHeaders={HOME_HERO_BANNER_CSV_HEADERS}
        schema={homeHeroBannerSchema}
        csvRowToRow={csvRowToHomeHeroBanner}
        rowToCsvRow={homeHeroBannerToCsvRow}
        getCreateDefaults={() => ({})}
        filters={HOME_HERO_FILTERS}
        search={searchHomeHeroBanner}
        renderForm={({ defaultValues, onSubmit, onCancel, isEditing }) => (
          <HomeHeroBannerForm
            defaultValues={defaultValues}
            onSubmit={onSubmit}
            onCancel={onCancel}
            isEditing={isEditing}
          />
        )}
        renderCard={({ item, onEdit, onDuplicate, onDelete }) => (
          <HomeHeroBannerCard item={item} onEdit={onEdit} onDuplicate={onDuplicate} onDelete={onDelete} />
        )}
      />
    );
  }
  return null;
}
