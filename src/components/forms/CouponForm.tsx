import { useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { couponSchema, type CouponFields } from './schemas';
import { TextField, TextAreaField } from './fields/TextField';
import ImageDropzone from './fields/ImageDropzone';
import CouponDisplayField from './fields/CouponDisplayField';
import FormErrorSummary from './FormErrorSummary';
import { slugify } from '@lib/slug';
import styles from './form.module.scss';
import fieldStyles from './fields/fields.module.scss';

interface Props {
  collectionId: string;
  defaultValues?: Partial<CouponFields>;
  onSubmit: (data: CouponFields) => Promise<void> | void;
  onCancel?: () => void;
  submitting?: boolean;
  isEditing?: boolean;
}

const EMPTY: CouponFields = {
  name: '',
  slug: '',
  'coupon-title': '',
  'coupon-description': '',
  'coupon-validity-text': '',
  'related-merchants': [],
  'coupon-display': '',
};

export default function CouponForm({
  collectionId,
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
  } = useForm<CouponFields>({
    resolver: zodResolver(couponSchema),
    defaultValues: { ...EMPTY, ...defaultValues },
    mode: 'onBlur',
    shouldFocusError: false,
  });

  const nameValue = watch('name');
  const slugValue = watch('slug');
  useEffect(() => {
    if (editMode.current) return;
    setValue('slug', slugify(nameValue ?? ''), { shouldValidate: true });
  }, [nameValue, setValue]);

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
      <FormErrorSummary errors={errors} />
      <div className={styles.grid}>
        <TextField
          label="Name"
          required
          {...register('name')}
          error={errors.name?.message}
          help="Nombre interno del cupón"
        />

        <div className={fieldStyles.field}>
          <span className={fieldStyles.label}>Slug</span>
          <div className={fieldStyles.slugPreview}>{slugValue || '—'}</div>
          <small className={fieldStyles.help}>
            {editMode.current
              ? 'El slug original se conserva al editar para no romper URLs existentes.'
              : 'Se genera automáticamente desde Name.'}
          </small>
          {errors.slug?.message && (
            <small className={fieldStyles.error}>{errors.slug.message}</small>
          )}
        </div>

        <TextField
          label="Coupon title"
          required
          {...register('coupon-title')}
          error={errors['coupon-title']?.message}
        />
        <TextField
          label="Coupon validity text"
          required
          {...register('coupon-validity-text')}
          error={errors['coupon-validity-text']?.message}
        />
        <TextAreaField
          label="Coupon description"
          required
          {...register('coupon-description')}
          error={errors['coupon-description']?.message}
        />

        <Controller
          control={control}
          name="coupon-display"
          render={({ field }) => (
            <CouponDisplayField
              label="Coupon display"
              required
              value={field.value ?? ''}
              onChange={field.onChange}
              error={errors['coupon-display']?.message}
            />
          )}
        />
      </div>

      <Controller
        control={control}
        name="related-merchants"
        render={({ field }) => (
          <ImageDropzone
            label="Related merchants"
            collectionId={collectionId}
            value={field.value ?? []}
            onChange={field.onChange}
            multiple
            maxDimension={1200}
            required
            error={errors['related-merchants']?.message as string | undefined}
            help="Sube los logos. Se convierten automáticamente a WEBP."
          />
        )}
      />

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
