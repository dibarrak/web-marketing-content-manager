import { zodResolver } from '@hookform/resolvers/zod';
import {
  AD_BANNER_ALL,
  AD_BANNER_SITES,
  parseSiteTarget,
  serializeSiteTarget,
  unwrapSingleParagraph,
} from '@lib/ad-banners';
import { slugify } from '@lib/slug';
import { useEffect, useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { CheckboxGroupField } from './fields/CheckboxGroupField';
import CouponDisplayField from './fields/CouponDisplayField';
import fieldStyles from './fields/fields.module.scss';
import RichTextField from './fields/RichTextField';
import SingleImageField from './fields/SingleImageField';
import { SwitchField } from './fields/SwitchField';
import { TextField } from './fields/TextField';
import styles from './form.module.scss';
import FormErrorSummary from './FormErrorSummary';
import { automatizedAdBannerSchema, type AutomatizedAdBannerFields } from './schemas';

interface Props {
  collectionId: string;
  defaultValues?: Partial<AutomatizedAdBannerFields>;
  onSubmit: (data: AutomatizedAdBannerFields) => Promise<void> | void;
  onCancel?: () => void;
  submitting?: boolean;
  isEditing?: boolean;
}

const SITE_OPTIONS = [
  ...AD_BANNER_SITES.map((s) => ({ value: s, label: s })),
  { value: AD_BANNER_ALL, label: 'Todos los sitios' },
] as const;

const EMPTY: AutomatizedAdBannerFields = {
  name: '',
  slug: '',
  title: '',
  href: '',
  'image-2': '',
  'show-dates': '',
  'site-target': '',
  body: '',
  'image-alt': '',
  'image-wide': false,
  'logo-2': '',
  'logo-alt': '',
  coupon: '',
  'coupon-label': '',
  cta: '',
  track: '',
  'new-tab': false,
  'slide-order': undefined,
};

/**
 * "Todos los sitios" excludes the individual sites and vice versa: toggling it
 * on clears the rest, and picking a site while it is on switches it off.
 */
function nextSelection(prev: string[], next: string[]): string[] {
  const hadAll = prev.includes(AD_BANNER_ALL);
  const hasAll = next.includes(AD_BANNER_ALL);
  if (hasAll && !hadAll) return [AD_BANNER_ALL];
  if (hasAll && hadAll && next.length > 1) return next.filter((s) => s !== AD_BANNER_ALL);
  return next;
}

export default function AutomatizedAdBannerForm({
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
  } = useForm<AutomatizedAdBannerFields>({
    resolver: zodResolver(automatizedAdBannerSchema),
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
    <form
      className={styles.form}
      // The component renders the title inline, so a lone <p> wrapper is dropped.
      onSubmit={handleSubmit((data) =>
        onSubmit({ ...data, title: unwrapSingleParagraph(data.title) }),
      )}
      noValidate
    >
      <FormErrorSummary errors={errors} />
      <fieldset className={styles.fieldset}>
        <legend>Identificación</legend>
        <div className={styles.grid}>
          <TextField label="Name" required {...register('name')} error={errors.name?.message} />
          <div className={fieldStyles.field}>
            <span className={fieldStyles.label}>Slug</span>
            <div className={fieldStyles.slugPreview}>{slugValue || '—'}</div>
            <small className={fieldStyles.help}>
              {editMode.current
                ? 'El slug original se conserva al editar para no romper URLs existentes.'
                : 'Se genera automáticamente desde Name.'}
            </small>
          </div>
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Contenido</legend>
        <Controller
          control={control}
          name="title"
          render={({ field }) => (
            <RichTextField
              label="Título"
              required
              compact
              value={field.value ?? ''}
              onChange={field.onChange}
              error={errors.title?.message}
              help="Admite negritas. Usa el botón ↵ br para insertar un salto de línea."
            />
          )}
        />
        <Controller
          control={control}
          name="body"
          render={({ field }) => (
            <RichTextField
              label="Cuerpo"
              compact
              value={field.value ?? ''}
              onChange={field.onChange}
              help="Texto debajo del título. Vacío = no se muestra."
            />
          )}
        />
        <TextField
          label="Enlace (URL)"
          required
          type="url"
          {...register('href')}
          error={errors.href?.message}
          help="Toda la card navega a este enlace."
        />
        <SwitchFieldController
          control={control}
          name="new-tab"
          label="Abrir el enlace en una pestaña nueva"
        />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Imagen y logo</legend>
        <Controller
          control={control}
          name="image-2"
          render={({ field }) => (
            <SingleImageField
              label="Imagen"
              collectionId={collectionId}
              required
              value={field.value ?? ''}
              onChange={field.onChange}
              maxDimension={800}
              error={errors['image-2']?.message as string | undefined}
              help="Se convierte a WEBP al subirla. 136 px de ancho, o 40% de la card si es imagen ancha."
            />
          )}
        />
        <TextField
          label="Texto alternativo de la imagen"
          {...register('image-alt')}
          help="Vacío = imagen decorativa."
        />
        <SwitchFieldController
          control={control}
          name="image-wide"
          label="Imagen ancha (40% de la card, variante cashback)"
        />
        <Controller
          control={control}
          name="logo-2"
          render={({ field }) => (
            <SingleImageField
              label="Logo"
              collectionId={collectionId}
              value={field.value ?? ''}
              onChange={field.onChange}
              maxDimension={400}
              help="Vacío = no se muestra el logo."
            />
          )}
        />
        <TextField label="Texto alternativo del logo" {...register('logo-alt')} />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Cupón y CTA</legend>
        <div className={styles.grid}>
          <TextField
            label="Cupón"
            {...register('coupon')}
            help="Si lo llenas, se muestra la fila de cupón."
          />
          <TextField label="Etiqueta del cupón" {...register('coupon-label')} help='Ej. "Cupón:"' />
          <TextField
            label="CTA"
            {...register('cta')}
            help="Texto ghost. No es un segundo enlace."
          />
          <TextField
            label="Track"
            {...register('track')}
            help="Valor de analítica (merchants, cashback…). Vacío = merchants."
          />
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Despliegue</legend>
        <Controller
          control={control}
          name="site-target"
          render={({ field }) => (
            <CheckboxGroupField
              label="Sitios de destino"
              required
              options={SITE_OPTIONS}
              value={parseSiteTarget(field.value)}
              onChange={(next) =>
                field.onChange(serializeSiteTarget(nextSelection(parseSiteTarget(field.value), next)))
              }
              error={errors['site-target']?.message}
              help="Puedes elegir varios para reutilizar la card en más de un sitio."
            />
          )}
        />
        <div className={styles.grid}>
          <Controller
            control={control}
            name="show-dates"
            render={({ field }) => (
              <CouponDisplayField
                label="Fechas de vigencia"
                required
                value={field.value ?? ''}
                onChange={field.onChange}
                error={errors['show-dates']?.message}
              />
            )}
          />
          <TextField
            label="Slide order"
            type="number"
            min={0}
            step={1}
            {...register('slide-order', {
              setValueAs: (v) => (v === '' || v == null ? undefined : Number(v)),
            })}
            error={errors['slide-order']?.message}
            help="Orden ascendente. Sin valor va al final."
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

/** Controller + SwitchField for a boolean form field. */
function SwitchFieldController({
  control,
  name,
  label,
}: {
  control: import('react-hook-form').Control<AutomatizedAdBannerFields>;
  name: 'new-tab' | 'image-wide';
  label: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <SwitchField
          label={label}
          checked={!!field.value}
          onChange={(e) => field.onChange(e.target.checked)}
        />
      )}
    />
  );
}
