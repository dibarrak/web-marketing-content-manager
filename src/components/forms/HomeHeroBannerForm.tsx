import { zodResolver } from '@hookform/resolvers/zod';
import {
  type ContentField,
  hasDuplicateCampaignId,
  HOME_HERO_SEGMENT_LABELS,
  HOME_HERO_USER_SEGMENTS,
  homeHeroBannerSchema,
  isMerchantIdLikelyValid,
  suggestTemplate,
  TEMPLATE_IDS,
  TEMPLATE_LABELS,
  templateVariantFor,
  type HomeHeroBannerFields,
} from '@lib/csv-modules/homeHeroBanners';
import { useEffect, useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { CheckboxGroupField } from './fields/CheckboxGroupField';
import fieldStyles from './fields/fields.module.scss';
import MerchantIdField from './fields/MerchantIdField';
import { SelectField } from './fields/SelectField';
import { SwitchField } from './fields/SwitchField';
import { TextField } from './fields/TextField';
import styles from './form.module.scss';
import FormErrorSummary from './FormErrorSummary';

interface Props {
  defaultValues?: Partial<HomeHeroBannerFields>;
  onSubmit: (data: HomeHeroBannerFields) => void;
  onCancel?: () => void;
  submitting?: boolean;
  isEditing?: boolean;
  /** campaign_id of every other row currently loaded — powers the
   * non-blocking duplicate hint. */
  existingCampaignIds?: string[];
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
  template_id: 'template_1',
  has_cta: false,
};

/** Label + input type for each template-conditional content field. */
const CONTENT_FIELD_CONFIG: Record<ContentField, { label: string; type?: string }> = {
  title: { label: 'Título' },
  subtitle: { label: 'Subtítulo' },
  caption: { label: 'Caption' },
  discount_amount: { label: 'Discount amount', type: 'number' },
  discount_percentage: { label: 'Discount percentage', type: 'number' },
  cashback_amount: { label: 'Cashback amount', type: 'number' },
  cashback_percentage: { label: 'Cashback percentage', type: 'number' },
  coupon: { label: 'Coupon' },
  coupon_caption: { label: 'Coupon caption' },
  logo_url: { label: 'Logo URL', type: 'url' },
  cta: { label: 'CTA' },
  click_url: { label: 'Click URL' },
};
const CONTENT_FIELD_KEYS = Object.keys(CONTENT_FIELD_CONFIG) as ContentField[];

export default function HomeHeroBannerForm({
  defaultValues,
  onSubmit,
  onCancel,
  submitting,
  isEditing,
  existingCampaignIds = [],
}: Props) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<HomeHeroBannerFields>({
    resolver: zodResolver(homeHeroBannerSchema),
    defaultValues: { ...EMPTY, ...defaultValues },
    // onChange (not onBlur, unlike the other CSV forms) so template
    // mismatch/required-field errors surface in real time as the user
    // switches template/CTA or types content, per stakeholder request.
    mode: 'onChange',
    shouldFocusError: false,
  });

  const backgroundUrl = watch('background_url');
  const logoUrl = watch('logo_url');
  const templateId = watch('template_id');
  const hasCta = watch('has_cta');
  const campaignId = watch('campaign_id');
  const merchantId = watch('merchant_id');
  const contentValues = watch(CONTENT_FIELD_KEYS);

  const variant = templateVariantFor(templateId, hasCta);
  const allowedFields = new Set(variant.fields);
  const requiredFields = new Set(variant.fields.filter((f) => !variant.optionalFields?.includes(f)));

  const filledFields = new Set<ContentField>(
    CONTENT_FIELD_KEYS.filter((_field, i) => (contentValues[i] ?? '').trim() !== ''),
  );
  const isExactMatch =
    filledFields.size === requiredFields.size && [...requiredFields].every((f) => filledFields.has(f));
  const suggested = suggestTemplate(filledFields, hasCta);
  const showSuggestion = !!suggested && suggested !== templateId && !isExactMatch;

  // Clear content fields that no longer apply when the template/CTA toggle
  // changes, so a stale value from a previous template can't sneak into the
  // submit — same pattern as OfferwallBannerForm's action-dependent fields.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    CONTENT_FIELD_KEYS.forEach((field) => {
      if (!allowedFields.has(field)) setValue(field, '', { shouldValidate: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, hasCta]);

  const campaignIdDuplicate = hasDuplicateCampaignId(campaignId, existingCampaignIds);
  const merchantIdWarning = !isMerchantIdLikelyValid(merchantId);

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
        {campaignIdDuplicate && (
          <small className={fieldStyles.warning}>
            Ya existe otro registro con este Campaign ID — revisa si es intencional (ej. campaña BAU con varios
            tramos de fecha).
          </small>
        )}
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Template</legend>
        <SelectField
          label="Template ID"
          required
          options={TEMPLATE_IDS.map((id) => ({ value: id, label: TEMPLATE_LABELS[id] }))}
          {...register('template_id')}
          error={errors.template_id?.message}
        />
        <SwitchField label="¿Tiene CTA?" {...register('has_cta')} />
        {showSuggestion && suggested && (
          <div className={styles.suggestion}>
            <span>
              El contenido que llenaste coincide con <strong>{TEMPLATE_LABELS[suggested]}</strong>.
            </span>
            <button
              type="button"
              className={styles.suggestionApply}
              onClick={() => setValue('template_id', suggested, { shouldValidate: true })}
            >
              Cambiar a este template
            </button>
          </div>
        )}
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Contenido</legend>
        {CONTENT_FIELD_KEYS.filter((field) => allowedFields.has(field))
          .map((field) => {
            const cfg = CONTENT_FIELD_CONFIG[field];
            return (
              <TextField
                key={field}
                label={cfg.label}
                type={cfg.type}
                step={cfg.type === 'number' ? 'any' : undefined}
                required={requiredFields.has(field)}
                {...register(field)}
                error={errors[field]?.message}
              />
            );
          })}
        {allowedFields.size === 0 && (
          <small className={fieldStyles.help}>Este template no define campos de contenido.</small>
        )}
        {logoUrl && allowedFields.has('logo_url') && (
          <img
            src={logoUrl}
            alt=""
            className={fieldStyles.urlPreviewImg}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Imagen de fondo</legend>
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
        {merchantIdWarning && (
          <small className={fieldStyles.warning}>Normalmente es numérico — verifica que sea correcto.</small>
        )}
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
