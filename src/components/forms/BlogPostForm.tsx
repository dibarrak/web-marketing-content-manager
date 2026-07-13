import { zodResolver } from '@hookform/resolvers/zod';
import { BLOG_POST_DEFAULTS, BLOG_REFERENCES } from '@lib/config/sites';
import { readingTimeMinutes } from '@lib/reading-time';
import { slugify } from '@lib/slug';
import { useEffect, useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import BlogContentField from './fields/BlogContentField';
import fieldStyles from './fields/fields.module.scss';
import { MultiReferenceField, ReferenceField } from './fields/ReferenceField';
import SingleImageField from './fields/SingleImageField';
import { SwitchField } from './fields/SwitchField';
import { TextAreaField, TextField } from './fields/TextField';
import styles from './form.module.scss';
import FormErrorSummary from './FormErrorSummary';
import { blogPostSchema, type BlogPostFields } from './schemas';

interface Props {
  collectionId: string;
  defaultValues?: Partial<BlogPostFields>;
  onSubmit: (data: BlogPostFields) => Promise<void> | void;
  onCancel?: () => void;
  submitting?: boolean;
  isEditing?: boolean;
}

/** Referenced collection id for a given blog field slug. */
const refCollection = (fieldSlug: string): string =>
  BLOG_REFERENCES.find((r) => r.fieldSlug === fieldSlug)!.collectionId;

const EMPTY: BlogPostFields = {
  name: '',
  slug: '',
  'post-h1': '',
  'post-title-tag': '',
  'post-meta-description': '',
  'post-content': '',
  'post-category': '',
  'post-short-description': '',
  'post-last-breadcrumb': '',
  'post-image': '',
  'post-image-alt-tex': '',
  'post-audio-link': '',
  'post-subcategory': null,
  'post-author-reviewer': BLOG_POST_DEFAULTS['post-author-reviewer'],
  'post-disclaimer': [...BLOG_POST_DEFAULTS['post-disclaimer']],
  'post-breadcrumbs': [],
  'post-featured-reviews': [],
  'post-cta': [],
  'post-featured': BLOG_POST_DEFAULTS['post-featured'],
  'post-featured-category': BLOG_POST_DEFAULTS['post-featured-category'],
  'post-highlighted-blog-index-2': BLOG_POST_DEFAULTS['post-highlighted-blog-index-2'],
  'post-reading-time': undefined,
  'post-carousel-highlighted-blog-index': undefined,
  'post-published-on': '',
  'post-date-visbility': BLOG_POST_DEFAULTS['post-date-visbility'],
};

export default function BlogPostForm({
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
  } = useForm<BlogPostFields>({
    resolver: zodResolver(blogPostSchema),
    defaultValues: { ...EMPTY, ...defaultValues },
    mode: 'onBlur',
    shouldFocusError: false,
  });

  // Auto-generate slug from name on create (kept stable when editing to avoid
  // breaking published URLs).
  const nameValue = watch('name');
  const slugValue = watch('slug');
  useEffect(() => {
    if (editMode.current) return;
    setValue('slug', slugify(nameValue ?? ''), { shouldValidate: true });
  }, [nameValue, setValue]);

  const submit = (data: BlogPostFields) => {
    const payload: BlogPostFields = {
      ...data,
      // Title tag defaults to H1 when the editor leaves it blank.
      'post-title-tag': data['post-title-tag']?.trim() || data['post-h1'],
      // Reading time is always derived from the content.
      'post-reading-time': readingTimeMinutes(data['post-content']),
    };
    return onSubmit(payload);
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit(submit)} noValidate>
      <FormErrorSummary errors={errors} />

      <fieldset className={styles.fieldset}>
        <legend>Identificación</legend>
        <div className={styles.grid}>
          <TextField
            label="Name (interno)"
            required
            {...register('name')}
            error={errors.name?.message}
            help="Nombre interno del post."
          />
          <div className={fieldStyles.field}>
            <span className={fieldStyles.label}>Slug</span>
            <div className={fieldStyles.slugPreview}>{slugValue || '—'}</div>
            <small className={fieldStyles.help}>
              {editMode.current
                ? 'El slug original se conserva al editar para no romper URLs existentes.'
                : 'Se genera automáticamente desde Name (no editable).'}
            </small>
          </div>
        </div>
        <TextField
          label="H1"
          required
          {...register('post-h1')}
          error={errors['post-h1']?.message}
          help="Encabezado visible del post (independiente del Name)."
        />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>SEO</legend>
        <TextField
          label="Title Tag"
          {...register('post-title-tag')}
          error={errors['post-title-tag']?.message}
          help="Si se deja vacío, se usa el H1."
        />
        <TextAreaField
          label="Meta Description"
          required
          {...register('post-meta-description')}
          error={errors['post-meta-description']?.message}
        />
        <TextAreaField
          label="Short Description"
          {...register('post-short-description')}
          error={errors['post-short-description']?.message}
        />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Contenido</legend>
        <Controller
          control={control}
          name="post-content"
          render={({ field }) => (
            <BlogContentField
              label="Contenido"
              required
              collectionId={collectionId}
              value={field.value ?? ''}
              onChange={field.onChange}
              error={errors['post-content']?.message}
              help="Puedes subir imágenes (se convierten a WEBP) o insertarlas por URL."
            />
          )}
        />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Clasificación</legend>
        <div className={styles.grid}>
          <Controller
            control={control}
            name="post-category"
            render={({ field }) => (
              <ReferenceField
                label="Categoría"
                required
                refCollectionId={refCollection('post-category')}
                value={field.value || null}
                onChange={(id) => field.onChange(id ?? '')}
                error={errors['post-category']?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="post-subcategory"
            render={({ field }) => (
              <ReferenceField
                label="Subcategoría"
                refCollectionId={refCollection('post-subcategory')}
                value={field.value ?? null}
                onChange={field.onChange}
              />
            )}
          />
          <Controller
            control={control}
            name="post-author-reviewer"
            render={({ field }) => (
              <ReferenceField
                label="Autor y revisor"
                refCollectionId={refCollection('post-author-reviewer')}
                value={field.value ?? null}
                onChange={field.onChange}
              />
            )}
          />
        </div>
        <Controller
          control={control}
          name="post-disclaimer"
          render={({ field }) => (
            <MultiReferenceField
              label="Disclaimer"
              refCollectionId={refCollection('post-disclaimer')}
              value={field.value ?? []}
              onChange={field.onChange}
            />
          )}
        />
        <Controller
          control={control}
          name="post-breadcrumbs"
          render={({ field }) => (
            <MultiReferenceField
              label="Breadcrumbs"
              refCollectionId={refCollection('post-breadcrumbs')}
              value={field.value ?? []}
              onChange={field.onChange}
            />
          )}
        />
        <TextField
          label="Last Breadcrumb"
          {...register('post-last-breadcrumb')}
          error={errors['post-last-breadcrumb']?.message}
        />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Multimedia</legend>
        <Controller
          control={control}
          name="post-image"
          render={({ field }) => (
            <SingleImageField
              label="Imagen destacada"
              collectionId={collectionId}
              value={field.value ?? ''}
              onChange={field.onChange}
              maxDimension={1600}
              error={errors['post-image']?.message as string | undefined}
            />
          )}
        />
        <TextField
          label="Texto alternativo de la imagen"
          {...register('post-image-alt-tex')}
          error={errors['post-image-alt-tex']?.message}
        />
        <TextField
          label="Audio Link"
          type="url"
          {...register('post-audio-link')}
          error={errors['post-audio-link']?.message}
          help="URL de audio opcional."
        />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Relacionados</legend>
        <Controller
          control={control}
          name="post-featured-reviews"
          render={({ field }) => (
            <MultiReferenceField
              label="Featured reviews"
              refCollectionId={refCollection('post-featured-reviews')}
              value={field.value ?? []}
              onChange={field.onChange}
            />
          )}
        />
        <Controller
          control={control}
          name="post-cta"
          render={({ field }) => (
            <MultiReferenceField
              label="CTA"
              refCollectionId={refCollection('post-cta')}
              value={field.value ?? []}
              onChange={field.onChange}
            />
          )}
        />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Publicación y destacados</legend>
        <div className={styles.grid}>
          <TextField
            label="Publicar el (fecha)"
            type="datetime-local"
            {...register('post-published-on')}
            error={errors['post-published-on']?.message}
            help="Fecha mostrada en el post."
          />
          <TextField
            label="Orden en carrusel de destacados"
            type="number"
            min={0}
            step={1}
            {...register('post-carousel-highlighted-blog-index', {
              setValueAs: (v) => (v === '' || v == null ? undefined : Number(v)),
            })}
            error={errors['post-carousel-highlighted-blog-index']?.message}
          />
        </div>
        <Controller
          control={control}
          name="post-featured"
          render={({ field }) => (
            <SwitchField
              label="Featured"
              checked={!!field.value}
              onChange={(e) => field.onChange(e.target.checked)}
            />
          )}
        />
        <Controller
          control={control}
          name="post-featured-category"
          render={({ field }) => (
            <SwitchField
              label="Featured Category"
              checked={!!field.value}
              onChange={(e) => field.onChange(e.target.checked)}
            />
          )}
        />
        <Controller
          control={control}
          name="post-highlighted-blog-index-2"
          render={({ field }) => (
            <SwitchField
              label="Highlighted Blog Index"
              checked={!!field.value}
              onChange={(e) => field.onChange(e.target.checked)}
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
