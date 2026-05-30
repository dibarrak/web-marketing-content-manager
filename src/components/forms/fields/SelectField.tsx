import { forwardRef, type SelectHTMLAttributes } from 'react';
import styles from './fields.module.scss';

interface Props extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label: string;
  options: readonly string[] | readonly { value: string; label: string }[];
  error?: string;
  help?: string;
  required?: boolean;
  placeholder?: string;
}

export const SelectField = forwardRef<HTMLSelectElement, Props>(
  ({ label, options, error, help, required, placeholder, ...rest }, ref) => {
    const norm = options.map((o) =>
      typeof o === 'string' ? { value: o, label: o } : o,
    );
    return (
      <label className={styles.field}>
        <span className={styles.label}>
          {label} {required && <em className={styles.req}>*</em>}
        </span>
        <select ref={ref} className={styles.input} aria-invalid={!!error} {...rest}>
          {placeholder && <option value="">{placeholder}</option>}
          {norm.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {help && !error && <small className={styles.help}>{help}</small>}
        {error && <small className={styles.error}>{error}</small>}
      </label>
    );
  },
);
SelectField.displayName = 'SelectField';
