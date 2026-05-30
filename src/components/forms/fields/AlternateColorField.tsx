import { useEffect, useState } from 'react';
import styles from './fields.module.scss';

/**
 * Encodes one of three states into the canonical string the frontend expects:
 *   • "#RRGGBB"               → color applied to every text element
 *   • "{h1, #RRGGBB}"         → color applied to a single element
 *   • "{h1|h2|p, #RRGGBB}"    → color applied to multiple elements
 *
 * Allowed element tokens: h1, h2, h3, p, all.
 */

interface Props {
  label: string;
  value: string;
  onChange: (next: string) => void;
  required?: boolean;
  error?: string;
  help?: string;
}

const ELEMENTS = ['h1', 'h2', 'h3', 'p', 'all'] as const;
type ElementToken = (typeof ELEMENTS)[number];

type Mode = 'all' | 'specific';

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const SPECIFIC_RE = /^\{([^,}]+),\s*(#[0-9a-fA-F]{6})\}$/;

function parse(raw: string): { mode: Mode; color: string; elements: ElementToken[] } {
  const v = (raw ?? '').trim();
  const m = SPECIFIC_RE.exec(v);
  if (m) {
    const els = m[1]
      .split('|')
      .map((s) => s.trim())
      .filter((s): s is ElementToken => (ELEMENTS as readonly string[]).includes(s));
    return { mode: 'specific', color: m[2].toUpperCase(), elements: els };
  }
  if (HEX_RE.test(v)) return { mode: 'all', color: v.toUpperCase(), elements: [] };
  return { mode: 'all', color: '', elements: [] };
}

function encode(mode: Mode, color: string, elements: ElementToken[]): string {
  if (!color) return '';
  if (mode === 'all') return color;
  if (elements.length === 0) return '';
  return `{${elements.join('|')}, ${color}}`;
}

export default function AlternateColorField({
  label,
  value,
  onChange,
  required,
  error,
  help,
}: Props) {
  const initial = parse(value);
  const [enabled, setEnabled] = useState(() => !!(value ?? '').trim());
  const [mode, setMode] = useState<Mode>(initial.mode);
  const [color, setColor] = useState(initial.color || '#000000');
  const [elements, setElements] = useState<ElementToken[]>(initial.elements);

  useEffect(() => {
    onChange(enabled ? encode(mode, color, elements) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, mode, color, elements]);

  const toggleElement = (el: ElementToken) => {
    setElements((prev) => (prev.includes(el) ? prev.filter((e) => e !== el) : [...prev, el]));
  };

  return (
    <div className={styles.field}>
      <span className={styles.label}>
        {label} {required && <em className={styles.req}>*</em>}
      </span>

      <label className={styles.radio}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        <span>Activar color alterno</span>
      </label>

      {enabled && (
        <>
          <div className={styles.radioGroup}>
            <label className={styles.radio}>
              <input
                type="radio"
                name={`${label}-mode`}
                checked={mode === 'all'}
                onChange={() => setMode('all')}
              />
              <span>Aplicar a todos los textos</span>
            </label>
            <label className={styles.radio}>
              <input
                type="radio"
                name={`${label}-mode`}
                checked={mode === 'specific'}
                onChange={() => setMode('specific')}
              />
              <span>Aplicar solo a elementos específicos</span>
            </label>
          </div>

          {mode === 'specific' && (
            <div className={styles.elementGrid}>
              {ELEMENTS.map((el) => (
                <label key={el} className={styles.radio}>
                  <input
                    type="checkbox"
                    checked={elements.includes(el)}
                    onChange={() => toggleElement(el)}
                  />
                  <code>{el}</code>
                </label>
              ))}
            </div>
          )}

          <div className={styles.colorRow}>
            <input
              type="color"
              className={styles.colorSwatch}
              value={HEX_RE.test(color) ? color : '#000000'}
              onChange={(e) => setColor(e.target.value.toUpperCase())}
            />
            <input
              type="text"
              className={styles.input}
              placeholder="#RRGGBB"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </div>

          <small className={styles.help}>
            Resultado: <code>{encode(mode, color, elements) || '—'}</code>
          </small>
        </>
      )}

      {help && !error && <small className={styles.help}>{help}</small>}
      {error && <small className={styles.error}>{error}</small>}
    </div>
  );
}
