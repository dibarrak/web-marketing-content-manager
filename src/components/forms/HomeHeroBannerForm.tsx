import { zodResolver } from '@hookform/resolvers/zod';
import {
  HOME_HERO_SEGMENT_LABELS,
  HOME_HERO_USER_SEGMENTS,
  homeHeroBannerSchema,
  KNOWN_TEMPLATE_IDS,
  type HomeHeroBannerFields,
} from '@lib/csv-modules/homeHeroBanners';
import { Controller, useForm } from 'react-hook-form';
import { CheckboxGroupField } from './fields/CheckboxGroupField';
import fieldStyles from './fields/fields.module.scss';
import MerchantIdField from './fields/MerchantIdField';
import { TextField } from './fields/TextField';
import styles from './form.module.scss';
import FormErrorSummary from './FormErrorSummary';

interface Props {
  defaultValues?: Partial<HomeHeroBannerFields>;
  onSubmit: (data: HomeHeroBannerFields) => void;
  onCancel?: () => void;
  submitting?: boolean;
  isEditing?: boolean;
}

const EMPTY: HomeHeroBannerFields = {
  campaign_id: '',
  title: '',
  subtitle: '',
  caption: '',
  discount_amount: '',
  discount_percentage: '',
  cashback_amount: '',
  cashback_percentage: '',
  coupon: '',
  coupon_caption: '',
  background_url: '',
  logo_url: '',
  click_url: '',
  cta: '',
  merchant_id: '',
  user_segment: [],
  start_date: '',
  end_date: '',
  template_id: '',
};

export default function HomeHeroBannerForm({
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
  } = useForm<HomeHeroBannerFields>({
    resolver: zodResolver(homeHeroBannerSchema),
    defaultValues: { ...EMPTY, ...defaultValues },
    mode: 'onBlur',
    shouldFocusError: false,
  });

  const backgroundUrl = watch('background_url');
  const logoUrl = watch('logo_url');

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
      <FormErrorSummary errors={errors} />

      <fieldset className={styles.fieldset}>
        <legend>Identificación</legend>
        <TextField
          label="Campaign ID"
          required
          {...register('campaign_id')}
          error={errors.campaign_id?.message}
          help={isEditing ? undefined : 'Los duplicados son válidos en este archivo.'}
        />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Contenido</legend>
        <TextField label="Título" required {...register('title')} error={errors.title?.message} />
        <TextField label="Subtítulo" required {...register('subtitle')} error={errors.subtitle?.message} />
        <TextField label="Caption" {...register('caption')} error={errors.caption?.message} />
        <TextField label="CTA" {...register('cta')} error={errors.cta?.message} />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Descuento / cashback</legend>
        <div className={styles.grid}>
          <TextField
            label="Discount amount"
            type="number"
            step="any"
            {...register('discount_amount')}
            error={errors.discount_amount?.message}
          />
          <TextField
            label="Discount percentage"
            type="number"
            step="any"
            {...register('discount_percentage')}
            error={errors.discount_percentage?.message}
          />
          <TextField
            label="Cashback amount"
            type="number"
            step="any"
            {...register('cashback_amount')}
            error={errors.cashback_amount?.message}
          />
          <TextField
            label="Cashback percentage"
            type="number"
            step="any"
            {...register('cashback_percentage')}
            error={errors.cashback_percentage?.message}
          />
        </div>
        <small className={fieldStyles.help}>
          Campos independientes — puedes dejar los 4 vacíos si el copy ya viene armado en Título/Subtítulo.
        </small>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Cupón</legend>
        <div className={styles.grid}>
          <TextField label="Coupon" {...register('coupon')} error={errors.coupon?.message} />
          <TextField
            label="Coupon caption"
            {...register('coupon_caption')}
            error={errors.coupon_caption?.message}
          />
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Imágenes y acción</legend>
        <TextField
          label="Background URL"
          required
          type="url"
          {...register('background_url')}
          error={errors.background_url?.message}
          help="URL de la imagen ya alojada en S3 (no se sube desde aquí)."
        />
        {backgroundUrl && (
          <img
            src={backgroundUrl}
            alt=""
            className={fieldStyles.urlPreviewImg}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
        <TextField label="Logo URL" type="url" {...register('logo_url')} error={errors.logo_url?.message} />
        {logoUrl && (
          <img
            src={logoUrl}
            alt=""
            className={fieldStyles.urlPreviewImg}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
        <TextField
          label="Click URL"
          {...register('click_url')}
          error={errors.click_url?.message}
          help="URL normal (https://…) o deep link de la app (ej. kueskios://cash). Puede quedar vacío si el banner no navega a ningún lado."
        />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Comercio</legend>
        <Controller
          control={control}
          name="merchant_id"
          render={({ field }) => (
            <MerchantIdField
              label="Merchant"
              value={field.value}
              onChange={field.onChange}
              error={errors.merchant_id?.message}
              help="Opcional — algunas campañas no están ligadas a un merchant."
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
            type="date"
            {...register('start_date')}
            error={errors.start_date?.message}
          />
          <TextField
            label="Fecha de fin"
            required
            type="date"
            {...register('end_date')}
            error={errors.end_date?.message}
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
              options={HOME_HERO_USER_SEGMENTS.map((s) => ({ value: s, label: HOME_HERO_SEGMENT_LABELS[s] }))}
              value={field.value}
              onChange={field.onChange}
              error={errors.user_segment?.message}
            />
          )}
        />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Template</legend>
        <TextField
          label="Template ID"
          required
          {...register('template_id')}
          error={errors.template_id?.message}
          help={`Texto libre. Valores conocidos: ${KNOWN_TEMPLATE_IDS.join(', ')}.`}
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
