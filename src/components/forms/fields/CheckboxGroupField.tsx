import styles from './fields.module.scss';

interface Option {
  value: string;
  label: string;
}

interface Props {
  label: string;
  options: readonly Option[] | readonly string[];
  value: string[];
  onChange: (next: string[]) => void;
  required?: boolean;
  error?: string;
  help?: string;
}

/** Multi-select from a small, fixed/closed set of options, rendered as checkboxes. */
export function CheckboxGroupField({ label, options, value, onChange, required, error, help }: Props) {
  const norm: Option[] = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  const toggle = (v: string) => {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };

  return (
    <div className={styles.field}>
      <span className={styles.label}>
        {label} {required && <em className={styles.req}>*</em>}
      </span>
      <div className={styles.checkboxGroup} role="group" aria-invalid={!!error}>
        {norm.map((o) => (
          <label key={o.value} className={styles.checkboxItem}>
            <input
              type="checkbox"
              checked={value.includes(o.value)}
              onChange={() => toggle(o.value)}
            />
            {o.label}
          </label>
        ))}
      </div>
      {help && !error && <small className={styles.help}>{help}</small>}
      {error && <small className={styles.error}>{error}</small>}
    </div>
  );
}
