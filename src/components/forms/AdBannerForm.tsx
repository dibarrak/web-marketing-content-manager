import { zodResolver } from '@hookform/resolvers/zod';
import {
  adBannerSchema,
  SEGMENT_LABELS,
  USER_SEGMENTS,
  type AdBannerFields,
} from '@lib/csv-modules/adBanners';
import { Controller, useForm } from 'react-hook-form';
import { CheckboxGroupField } from './fields/CheckboxGroupField';
import fieldStyles from './fields/fields.module.scss';
import MerchantIdField from './fields/MerchantIdField';
import { TextField } from './fields/TextField';
import styles from './form.module.scss';
import FormErrorSummary from './FormErrorSummary';

interface Props {
  defaultValues?: Partial<AdBannerFields>;
  onSubmit: (data: AdBannerFields) => void;
  onCancel?: () => void;
  submitting?: boolean;
  isEditing?: boolean;
}

const EMPTY: AdBannerFields = {
  id: 1,
  click_url: '',
  image_url: '',
  merchant_id: '',
  start_date: '',
  end_date: '',
  user_segment: [],
};

export default function AdBannerForm({
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
    formState: { errors },
  } = useForm<AdBannerFields>({
    resolver: zodResolver(adBannerSchema),
    defaultValues: { ...EMPTY, ...defaultValues },
    mode: 'onBlur',
    shouldFocusError: false,
  });

  const imageUrl = watch('image_url');

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
      <FormErrorSummary errors={errors} />

      <fieldset className={styles.fieldset}>
        <legend>Identificación</legend>
        <TextField
          label="ID"
          type="number"
          step={1}
          {...register('id', { valueAsNumber: true })}
          error={errors.id?.message}
          help={
            isEditing
              ? undefined
              : 'Sugerido automáticamente al siguiente consecutivo; puedes cambiarlo — los duplicados son válidos en este archivo.'
          }
        />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Contenido</legend>
        <TextField
          label="Click URL"
          required
          type="url"
          {...register('click_url')}
          error={errors.click_url?.message}
          help="Enlace de destino, incluyendo los parámetros UTM tal cual deben ir."
        />
        <TextField
          label="Image URL"
          required
          type="url"
          {...register('image_url')}
          error={errors.image_url?.message}
          help="URL de la imagen ya alojada en S3 (no se sube desde aquí)."
        />
        {imageUrl && (
          <img
            src={imageUrl}
            alt=""
            className={fieldStyles.urlPreviewImg}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Comercio</legend>
        <Controller
          control={control}
          name="merchant_id"
          render={({ field }) => (
            <MerchantIdField
              label="Merchant"
              required
              value={field.value}
              onChange={field.onChange}
              error={errors.merchant_id?.message}
            />
          )}
        />
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
