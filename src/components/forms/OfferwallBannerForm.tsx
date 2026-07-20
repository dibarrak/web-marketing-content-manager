import { zodResolver } from '@hookform/resolvers/zod';
import {
  MAX_OFFERWALL_MERCHANTS,
  OFFERWALL_ACTION_LABELS,
  OFFERWALL_ACTIONS,
  OFFERWALL_FILTER_CATALOG,
  offerwallBannerSchema,
  SEGMENT_LABELS,
  USER_SEGMENTS,
  type OfferwallBannerFields,
} from '@lib/csv-modules/offerwallBanners';
import { Controller, useForm } from 'react-hook-form';
import { useEffect, useRef } from 'react';
import { CheckboxGroupField } from './fields/CheckboxGroupField';
import fieldStyles from './fields/fields.module.scss';
import MerchantIdsField from './fields/MerchantIdsField';
import { SelectField } from './fields/SelectField';
import { SwitchField } from './fields/SwitchField';
import { TagComboField } from './fields/TagComboField';
import { TextAreaField, TextField } from './fields/TextField';
import styles from './form.module.scss';
import FormErrorSummary from './FormErrorSummary';

interface Props {
  defaultValues?: Partial<OfferwallBannerFields>;
  onSubmit: (data: OfferwallBannerFields) => void;
  onCancel?: () => void;
  submitting?: boolean;
  isEditing?: boolean;
}

const EMPTY: OfferwallBannerFields = {
  banner_id: '',
  merchant_ids: [],
  background_image: '',
  title: '',
  description: '',
  cta_text: '',
  action: 'simulate-click',
  url: '',
  external_browser: false,
  screen_path: '',
  filter: [],
  start_date: '',
  end_date: '',
  user_segment: [],
};

const FILTER_SUGGESTIONS = OFFERWALL_FILTER_CATALOG.map((f) => ({ value: f, label: f }));

export default function OfferwallBannerForm({
  defaultValues,
  onSubmit,
  onCancel,
  submitting,
  isEditing,
}: Props) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<OfferwallBannerFields>({
    resolver: zodResolver(offerwallBannerSchema),
    defaultValues: { ...EMPTY, ...defaultValues },
    mode: 'onBlur',
    shouldFocusError: false,
  });

  const backgroundImage = watch('background_image');
  const action = watch('action');

  // react-hook-form keeps a hidden field's last value in state even after it
  // unmounts (e.g. switching away from "redirect-to-url" hides the URL
  // input) — clear whichever field no longer applies so a stale value from
  // a previous action (or a duplicated row) can't sneak into the submit.
  const isFirstActionRender = useRef(true);
  useEffect(() => {
    if (isFirstActionRender.current) {
      isFirstActionRender.current = false;
      return;
    }
    if (action !== 'redirect-to-url') {
      setValue('url', '');
      setValue('external_browser', false);
    }
    if (action !== 'redirect-to-screen') {
      setValue('screen_path', '');
    }
  }, [action, setValue]);

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
      <FormErrorSummary errors={errors} />

      <fieldset className={styles.fieldset}>
        <legend>Identificación</legend>
        <TextField
          label="Banner ID"
          required
          {...register('banner_id')}
          error={errors.banner_id?.message}
          help={
            isEditing ? undefined : 'Los duplicados son válidos en este archivo — no es necesario que sea único.'
          }
        />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Contenido</legend>
        <TextField label="Título" required {...register('title')} error={errors.title?.message} />
        <TextAreaField
          label="Descripción"
          required
          {...register('description')}
          error={errors.description?.message}
        />
        <TextField
          label="Texto del botón (CTA)"
          required
          {...register('cta_text')}
          error={errors.cta_text?.message}
        />
        <TextField
          label="Background Image URL"
          required
          type="url"
          {...register('background_image')}
          error={errors.background_image?.message}
          help="URL de la imagen ya alojada en S3 (no se sube desde aquí)."
        />
        {backgroundImage && (
          <img
            src={backgroundImage}
            alt=""
            className={fieldStyles.urlPreviewImg}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Comercios</legend>
        <Controller
          control={control}
          name="merchant_ids"
          render={({ field }) => (
            <MerchantIdsField
              label="Merchants"
              required
              max={MAX_OFFERWALL_MERCHANTS}
              value={field.value}
              onChange={field.onChange}
              error={errors.merchant_ids?.message}
              help={`Hasta ${MAX_OFFERWALL_MERCHANTS} merchants.`}
            />
          )}
        />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Acción</legend>
        <SelectField
          label="Acción"
          required
          options={OFFERWALL_ACTIONS.map((a) => ({ value: a, label: OFFERWALL_ACTION_LABELS[a] }))}
          {...register('action')}
          error={errors.action?.message}
        />

        {action === 'redirect-to-url' && (
          <>
            <TextField
              label="URL"
              required
              type="url"
              {...register('url')}
              error={errors.url?.message}
              help="A dónde navega al tocar el banner."
            />
            <SwitchField
              label="Abrir en navegador externo"
              {...register('external_browser')}
              error={errors.external_browser?.message}
            />
          </>
        )}

        {action === 'redirect-to-screen' && (
          <TextField
            label="Screen path"
            required
            {...register('screen_path')}
            error={errors.screen_path?.message}
            help="Ruta interna de la app, ej. /search."
          />
        )}
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Vigencia</legend>
        <div className={styles.grid}>
          <TextField
            label="Fecha de inicio"
            required
            type="datetime-local"
            step={1}
            {...register('start_date')}
            error={errors.start_date?.message}
            help="Hora de Ciudad de México."
          />
          <TextField
            label="Fecha de fin"
            required
            type="datetime-local"
            step={1}
            {...register('end_date')}
            error={errors.end_date?.message}
            help="Hora de Ciudad de México."
          />
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Segmento de usuario</legend>
        <Controller
          control={control}
          name="user_segment"
          render={({ field }) => (
            <CheckboxGroupField
              label="Segmentos"
              required
              options={USER_SEGMENTS.map((s) => ({ value: s, label: SEGMENT_LABELS[s] }))}
              value={field.value}
              onChange={field.onChange}
              error={errors.user_segment?.message}
            />
          )}
        />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Filtro</legend>
        <Controller
          control={control}
          name="filter"
          render={({ field }) => (
            <TagComboField
              label="Filtro"
              value={field.value}
              onChange={field.onChange}
              suggestions={FILTER_SUGGESTIONS}
              error={errors.filter?.message}
              help="Selecciona del catálogo conocido o escribe un valor nuevo."
            />
          )}
        />
      </fieldset>

      <div className={styles.actions}>
        {onCancel && (
          <button type="button" className={styles.secondary} onClick={onCancel}>
            Cancelar
          </button>
        )}
        <button type="submit" className={styles.primary} disabled={submitting}>
          {submitting ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}
