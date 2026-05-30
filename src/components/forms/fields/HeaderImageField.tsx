import { useEffect, useState } from 'react';
import ImageDropzone, { type UploadedImage } from './ImageDropzone';
import styles from './fields.module.scss';

/**
 * Encodes header-image config into the string the frontend JS expects:
 *   "{<url>, <pixels|auto>}"
 *
 * Examples:
 *   {https://cdn.example.com/foo.webp, 150}
 *   {https://cdn.example.com/foo.webp, auto}
 */

interface Props {
  label: string;
  collectionId: string;
  value: string;
  onChange: (next: string) => void;
  required?: boolean;
  error?: string;
  help?: string;
}

const RE = /^\{\s*([^,}\s][^,}]*?)\s*,\s*(\d+|auto)\s*\}$/;

function parse(raw: string): { url: string; width: string } {
  const m = RE.exec((raw ?? '').trim());
  if (m) return { url: m[1], width: m[2] };
  return { url: '', width: 'auto' };
}

function encode(url: string, width: string): string {
  if (!url) return '';
  const w = width === '' || width === 'auto' ? 'auto' : String(parseInt(width, 10) || 'auto');
  return `{${url}, ${w}}`;
}

export default function HeaderImageField({
  label,
  collectionId,
  value,
  onChange,
  required,
  error,
  help,
}: Props) {
  const initial = parse(value);
  const [url, setUrl] = useState(initial.url);
  const [width, setWidth] = useState(initial.width);
  const [useAuto, setUseAuto] = useState(initial.width === 'auto');

  useEffect(() => {
    onChange(encode(url, useAuto ? 'auto' : width));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, width, useAuto]);

  const dropValue: UploadedImage[] = url ? [{ url, alt: '' }] : [];

  return (
    <div className={styles.field}>
      <span className={styles.label}>
        {label} {required && <em className={styles.req}>*</em>}
      </span>

      <ImageDropzone
        label=""
        collectionId={collectionId}
        value={dropValue}
        onChange={(next) => setUrl(next[0]?.url ?? '')}
        multiple={false}
        maxDimension={1920}
      />

      <div className={styles.headerWidthRow}>
        <label className={styles.radio}>
          <input
            type="checkbox"
            checked={useAuto}
            onChange={(e) => setUseAuto(e.target.checked)}
          />
          <span>Ancho automático</span>
        </label>
        <label className={styles.dateField} style={{ flex: 1 }}>
          <small>Ancho máximo (px)</small>
          <input
            type="number"
            min={1}
            step={1}
            className={styles.input}
            disabled={useAuto}
            value={useAuto ? '' : width}
            placeholder={useAuto ? 'auto' : '150'}
            onChange={(e) => setWidth(e.target.value)}
          />
        </label>
      </div>

      <small className={styles.help}>
        Resultado: <code>{encode(url, useAuto ? 'auto' : width) || '—'}</code>
      </small>

      {help && !error && <small className={styles.help}>{help}</small>}
      {error && <small className={styles.error}>{error}</small>}
    </div>
  );
}
