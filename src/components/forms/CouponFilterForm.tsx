import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { couponFilterSchema, type CouponFilterFields } from './schemas';
import { TextField } from './fields/TextField';
import CouponDisplayField from './fields/CouponDisplayField';
import FormErrorSummary from './FormErrorSummary';
import { slugify } from '@lib/slug';
import styles from './form.module.scss';
import fieldStyles from './fields/fields.module.scss';

interface Props {
  defaultValues?: Partial<CouponFilterFields>;
  onSubmit: (data: CouponFilterFields) => Promise<void> | void;
  onCancel?: () => void;
  submitting?: boolean;
}

const EMPTY: CouponFilterFields = { name: '', slug: '', 'coupon-display': '' };

export default function CouponFilterForm({
  defaultValues,
  onSubmit,
  onCancel,
  submitting,
}: Props) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CouponFilterFields>({
    resolver: zodResolver(couponFilterSchema),
    defaultValues: { ...EMPTY, ...defaultValues },
    mode: 'onBlur',
    shouldFocusError: false,
  });

  const nameValue = watch('name');
  const slugValue = watch('slug');
  useEffect(() => {
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
        />
        <div className={fieldStyles.field}>
          <span className={fieldStyles.label}>Slug</span>
          <div className={fieldStyles.slugPreview}>{slugValue || '—'}</div>
          <small className={fieldStyles.help}>Se genera automáticamente desde Name.</small>
          {errors.slug?.message && (
            <small className={fieldStyles.error}>{errors.slug.message}</small>
          )}
        </div>
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
