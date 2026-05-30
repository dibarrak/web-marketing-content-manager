import { useRef, useState, type DragEvent, type ChangeEvent } from 'react';
import { withBase } from '@lib/base-path';
import styles from './fields.module.scss';

export interface UploadedImage {
  url: string;
  alt?: string;
}

interface Props {
  label: string;
  collectionId: string;
  value: UploadedImage[];
  onChange: (next: UploadedImage[]) => void;
  multiple?: boolean;
  maxDimension?: number;
  required?: boolean;
  error?: string;
  help?: string;
}

interface UploadResponse {
  id: string;
  url: string;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
}

export default function ImageDropzone({
  label,
  collectionId,
  value,
  onChange,
  multiple = false,
  maxDimension,
  required,
  error,
  help,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function uploadOne(file: File): Promise<UploadedImage> {
    const form = new FormData();
    form.append('file', file);
    form.append('collectionId', collectionId);
    if (maxDimension) form.append('maxDimension', String(maxDimension));

    const res = await fetch(withBase('api/assets/upload'), { method: 'POST', body: form });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? `Upload failed (${res.status})`);
    }
    const data = (await res.json()) as UploadResponse;
    return { url: data.url, alt: '' };
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setLocalError(null);
    setUploading(true);
    try {
      const list = Array.from(files);
      const uploaded: UploadedImage[] = [];
      for (const f of list) {
        if (!f.type.startsWith('image/')) {
          throw new Error(`Archivo no válido: ${f.name}`);
        }
        const u = await uploadOne(f);
        uploaded.push(u);
      }
      onChange(multiple ? [...value, ...uploaded] : uploaded.slice(0, 1));
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Upload error');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void handleFiles(e.dataTransfer.files);
  };

  return (
    <div className={styles.field}>
      <span className={styles.label}>
        {label} {required && <em className={styles.req}>*</em>}
      </span>
      <div
        className={`${styles.dropzone} ${dragging ? styles.dragging : ''} ${
          uploading ? styles.disabled : ''
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
      >
        <p style={{ margin: 0 }}>
          {uploading
            ? 'Subiendo y convirtiendo a WEBP…'
            : multiple
              ? 'Arrastra imágenes o haz click para seleccionar'
              : 'Arrastra una imagen o haz click para seleccionar'}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple={multiple}
          hidden
          onChange={(e: ChangeEvent<HTMLInputElement>) => void handleFiles(e.target.files)}
        />
      </div>

      {value.length > 0 && (
        <div className={styles.previews}>
          {value.map((img, i) => (
            <div key={`${img.url}-${i}`} className={styles.preview}>
              <img src={img.url} alt={img.alt ?? ''} />
              <button
                type="button"
                className={styles.previewRemove}
                onClick={() => remove(i)}
                aria-label="Eliminar"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {help && !error && !localError && <small className={styles.help}>{help}</small>}
      {(error || localError) && (
        <small className={styles.error}>{error ?? localError}</small>
      )}
    </div>
  );
}
