import { zodResolver } from '@hookform/resolvers/zod';
import { referenceCollectionId } from '@lib/config/sites';
import { MERCHANT_TYPES } from '@lib/featured-merchants';
import { slugify } from '@lib/slug';
import { useEffect, useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import fieldStyles from './fields/fields.module.scss';
import { ReferenceField } from './fields/ReferenceField';
import { SelectField } from './fields/SelectField';
import { TextField } from './fields/TextField';
import styles from './form.module.scss';
import FormErrorSummary from './FormErrorSummary';
import { featuredMerchantSchema, type FeaturedMerchantFields } from './schemas';

interface Props {
  defaultValues?: Partial<FeaturedMerchantFields>;
  onSubmit: (data: FeaturedMerchantFields) => Promise<void> | void;
  onCancel?: () => void;
  submitting?: boolean;
  isEditing?: boolean;
}

const refFor = (fieldSlug: string) => referenceCollectionId('featuredMerchants', fieldSlug);

const EMPTY: FeaturedMerchantFields = {
  name: '',
  slug: '',
  orden: 0,
  'nombre-del-comercio': '',
  categoria: '',
  'tipo-de-comercio': 'en-linea',
};

export default function FeaturedMerchantForm({
  defaultValues,
  onSubmit,
  onCancel,
  submitting,
  isEditing,
}: Props) {
  const editMode = useRef(!!isEditing);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FeaturedMerchantFields>({
    resolver: zodResolver(featuredMerchantSchema),
    defaultValues: { ...EMPTY, ...defaultValues },
    mode: 'onBlur',
    shouldFocusError: false,
  });

  // Slug is derived from the Merchant ID on create, then frozen when editing so
  // published URLs don't break.
  const nameValue = watch('name');
  const slugValue = watch('slug');
  useEffect(() => {
    if (editMode.current) return;
    setValue('slug', slugify(nameValue ?? ''), { shouldValidate: true });
  }, [nameValue, setValue]);

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
      <FormErrorSummary errors={errors} />

      <fieldset className={styles.fieldset}>
        <legend>Identificación</legend>
        <div className={styles.grid}>
          <TextField
            label="Merchant ID"
            required
            {...register('name')}
            error={errors.name?.message}
            help="Identificador del comercio. Es el campo Name del item en Webflow."
          />
          <div className={fieldStyles.field}>
            <span className={fieldStyles.label}>Slug</span>
            <div className={fieldStyles.slugPreview}>{slugValue || '—'}</div>
            <small className={fieldStyles.help}>
              {editMode.current
                ? 'El slug original se conserva al editar para no romper URLs existentes.'
                : 'Se genera automáticamente desde el Merchant ID.'}
            </small>
            {errors.slug?.message && (
              <small className={fieldStyles.error}>{errors.slug.message}</small>
            )}
          </div>
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Comercio y categoría</legend>
        <div className={styles.grid}>
          <Controller
            control={control}
            name="nombre-del-comercio"
            render={({ field }) => (
              <ReferenceField
                label="Nombre del comercio"
                required
                refCollectionId={refFor('nombre-del-comercio')}
                value={field.value || null}
                onChange={(id) => field.onChange(id ?? '')}
                error={errors['nombre-del-comercio']?.message}
                help="Toma toda la información del comercio desde el CMS de Merchants."
              />
            )}
          />
          <Controller
            control={control}
            name="categoria"
            render={({ field }) => (
              <ReferenceField
                label="Categoría"
                required
                refCollectionId={refFor('categoria')}
                value={field.value || null}
                onChange={(id) => field.onChange(id ?? '')}
                error={errors.categoria?.message}
                help="Referencia al CMS de Merchant Categories."
              />
            )}
          />
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Presentación</legend>
        <div className={styles.grid}>
          <TextField
            label="Orden"
            required
            type="number"
            min={0}
            step={1}
            {...register('orden', {
              setValueAs: (v) => (v === '' || v == null ? undefined : Number(v)),
            })}
            error={errors.orden?.message}
            help="Determina el orden en el que aparecen los comercios en el grid."
          />
          <SelectField
            label="Tipo de comercio"
            required
            options={MERCHANT_TYPES}
            {...register('tipo-de-comercio')}
            error={errors['tipo-de-comercio']?.message}
            help="Define si el usuario va a la web del comercio o al mapa de tiendas."
          />
        </div>
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
