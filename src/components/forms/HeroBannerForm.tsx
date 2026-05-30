import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { heroBannerSchema, type HeroBannerFields } from './schemas';
import { TextField } from './fields/TextField';
import { SelectField } from './fields/SelectField';
import { SwitchField } from './fields/SwitchField';
import { ColorField } from './fields/ColorField';
import SingleImageField from './fields/SingleImageField';
import HeaderImageField from './fields/HeaderImageField';
import RichTextField from './fields/RichTextField';
import CouponDisplayField from './fields/CouponDisplayField';
import AlternateColorField from './fields/AlternateColorField';
import FormErrorSummary from './FormErrorSummary';
import { slugify } from '@lib/slug';
import styles from './form.module.scss';
import fieldStyles from './fields/fields.module.scss';

interface Props {
  collectionId: string;
  defaultValues?: Partial<HeroBannerFields>;
  onSubmit: (data: HeroBannerFields) => Promise<void> | void;
  onCancel?: () => void;
  submitting?: boolean;
}

const PAGE_OPTIONS = ['Home', 'Amazon', 'Temu', 'Promociones', 'Prototype'] as const;
const BUTTON_VARIANTS = [
  'primary',
  'secondary',
  'primary - transparent',
  'secondary - outline',
  'beat',
  'beat - primary transparent',
  'beat - secondary transparent',
] as const;
const GRADIENT_VARIANTS = [
  'Variante 1 - Naranja',
  'Variante 2 - Azul',
  'Variante 3 - Cian-Cobalto',
  'Variante 4 - Acero-Glacial',
  'Variante 5 - La vida no espera',
] as const;

const EMPTY: HeroBannerFields = {
  name: '',
  slug: '',
  titulo: '',
  descripcion: '',
  'imagen-2': '',
  'fechas-despliegue': '',
  'pagina-despliegue': 'Home',
  'imagen-cabecera': '',
  'texto-descripcion-auxiliar': '',
  'texto-copy-auxiliar': '',
  'texto-disclaimer': '',
  'mostrar-boton-creacion-cuenta': false,
  'copy-personalizado-boton-creacion-cuenta': '',
  'url-personalizada-boton-creacion-cuenta': '',
  'variante-boton-creacion-cuenta': undefined,
  'copy-boton-extra': '',
  'url-boton-extra': '',
  'variante-boton-extra': undefined,
  'color-fondo-2': '',
  'color-texto-alterno': '',
  'imagen-mobile': '',
  'slide-order': undefined,
  'logo-de-merchant': '',
  'texto-alterno-logo-merchant': '',
  'variante-de-gradiente': undefined,
};

export default function HeroBannerForm({
  collectionId,
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
  } = useForm<HeroBannerFields>({
    resolver: zodResolver(heroBannerSchema),
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
      <fieldset className={styles.fieldset}>
        <legend>Identificación</legend>
        <div className={styles.grid}>
          <TextField label="Name" required {...register('name')} error={errors.name?.message} />
          <div className={fieldStyles.field}>
            <span className={fieldStyles.label}>Slug</span>
            <div className={fieldStyles.slugPreview}>{slugValue || '—'}</div>
            <small className={fieldStyles.help}>Se genera automáticamente desde Name.</small>
          </div>
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Contenido principal</legend>
        <Controller
          control={control}
          name="titulo"
          render={({ field }) => (
            <RichTextField
              label="Título"
              required
              compact
              value={field.value ?? ''}
              onChange={field.onChange}
              error={errors.titulo?.message}
              help="Usa el botón ↵ br para insertar un salto de línea."
            />
          )}
        />
        <Controller
          control={control}
          name="descripcion"
          render={({ field }) => (
            <RichTextField
              label="Descripción"
              required
              compact
              value={field.value ?? ''}
              onChange={field.onChange}
              error={errors.descripcion?.message}
              help="Usa el botón ↵ br para insertar un salto de línea."
            />
          )}
        />
        <div className={styles.grid}>
          <Controller
            control={control}
            name="pagina-despliegue"
            render={({ field }) => (
              <SelectField
                label="Página despliegue"
                required
                options={PAGE_OPTIONS}
                value={field.value ?? ''}
                onChange={field.onChange}
                error={errors['pagina-despliegue']?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="fechas-despliegue"
            render={({ field }) => (
              <CouponDisplayField
                label="Fechas despliegue"
                required
                value={field.value ?? ''}
                onChange={field.onChange}
                error={errors['fechas-despliegue']?.message}
              />
            )}
          />
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Imágenes</legend>
        <Controller
          control={control}
          name="imagen-2"
          render={({ field }) => (
            <SingleImageField
              label="Imagen (principal)"
              collectionId={collectionId}
              required
              value={field.value ?? ''}
              onChange={field.onChange}
              maxDimension={1920}
              error={errors['imagen-2']?.message as string | undefined}
            />
          )}
        />
        <Controller
          control={control}
          name="imagen-mobile"
          render={({ field }) => (
            <SingleImageField
              label="Imagen mobile"
              collectionId={collectionId}
              value={field.value ?? ''}
              onChange={field.onChange}
              maxDimension={1200}
            />
          )}
        />
        <Controller
          control={control}
          name="imagen-cabecera"
          render={({ field }) => (
            <HeaderImageField
              label="Imagen cabecera"
              collectionId={collectionId}
              value={field.value ?? ''}
              onChange={field.onChange}
              error={errors['imagen-cabecera']?.message}
              help="Sube la imagen y define un ancho máximo en px o déjalo en automático."
            />
          )}
        />
        <Controller
          control={control}
          name="logo-de-merchant"
          render={({ field }) => (
            <SingleImageField
              label="Logo de merchant"
              collectionId={collectionId}
              value={field.value ?? ''}
              onChange={field.onChange}
              maxDimension={400}
            />
          )}
        />
        <TextField
          label="Texto alterno logo merchant"
          {...register('texto-alterno-logo-merchant')}
          error={errors['texto-alterno-logo-merchant']?.message}
        />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Textos enriquecidos</legend>
        <Controller
          control={control}
          name="texto-descripcion-auxiliar"
          render={({ field }) => (
            <RichTextField
              label="Texto descripción auxiliar"
              value={field.value ?? ''}
              onChange={field.onChange}
            />
          )}
        />
        <Controller
          control={control}
          name="texto-copy-auxiliar"
          render={({ field }) => (
            <RichTextField
              label="Texto copy auxiliar"
              value={field.value ?? ''}
              onChange={field.onChange}
            />
          )}
        />
        <Controller
          control={control}
          name="texto-disclaimer"
          render={({ field }) => (
            <RichTextField
              label="Texto disclaimer"
              value={field.value ?? ''}
              onChange={field.onChange}
            />
          )}
        />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Botón creación de cuenta</legend>
        <Controller
          control={control}
          name="mostrar-boton-creacion-cuenta"
          render={({ field }) => (
            <SwitchField
              label="Mostrar botón creación cuenta"
              checked={!!field.value}
              onChange={(e) => field.onChange(e.target.checked)}
            />
          )}
        />
        <div className={styles.grid}>
          <TextField
            label="Copy personalizado"
            {...register('copy-personalizado-boton-creacion-cuenta')}
          />
          <TextField
            label="URL personalizada"
            {...register('url-personalizada-boton-creacion-cuenta')}
          />
          <Controller
            control={control}
            name="variante-boton-creacion-cuenta"
            render={({ field }) => (
              <SelectField
                label="Variante"
                options={BUTTON_VARIANTS}
                placeholder="—"
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value || undefined)}
              />
            )}
          />
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Botón extra</legend>
        <div className={styles.grid}>
          <TextField label="Copy botón extra" {...register('copy-boton-extra')} />
          <TextField label="URL botón extra" {...register('url-boton-extra')} />
          <Controller
            control={control}
            name="variante-boton-extra"
            render={({ field }) => (
              <SelectField
                label="Variante"
                options={BUTTON_VARIANTS}
                placeholder="—"
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value || undefined)}
              />
            )}
          />
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Estilo</legend>
        <div className={styles.grid}>
          <Controller
            control={control}
            name="color-fondo-2"
            render={({ field }) => (
              <ColorField
                label="Color fondo"
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value)}
              />
            )}
          />
          <Controller
            control={control}
            name="color-texto-alterno"
            render={({ field }) => (
              <AlternateColorField
                label="Color texto alterno"
                value={field.value ?? ''}
                onChange={field.onChange}
                error={errors['color-texto-alterno']?.message}
                help="Aplica a todos los textos o solo a elementos específicos (h1, h2, h3, p, all)."
              />
            )}
          />
          <Controller
            control={control}
            name="variante-de-gradiente"
            render={({ field }) => (
              <SelectField
                label="Variante de gradiente"
                options={GRADIENT_VARIANTS}
                placeholder="—"
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value || undefined)}
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
