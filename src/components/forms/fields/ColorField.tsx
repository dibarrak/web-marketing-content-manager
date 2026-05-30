import { forwardRef, type InputHTMLAttributes } from 'react';
import styles from './fields.module.scss';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  help?: string;
  error?: string;
  required?: boolean;
}

export const ColorField = forwardRef<HTMLInputElement, Props>(
  ({ label, help, error, required, value, ...rest }, ref) => (
    <label className={styles.field}>
      <span className={styles.label}>
        {label} {required && <em className={styles.req}>*</em>}
      </span>
      <div className={styles.colorRow}>
        <input
          ref={ref}
          type="color"
          className={styles.colorSwatch}
          value={typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000'}
          {...rest}
        />
        <input
          type="text"
          className={styles.input}
          placeholder="#RRGGBB"
          value={typeof value === 'string' ? value : ''}
          onChange={rest.onChange as React.ChangeEventHandler<HTMLInputElement>}
        />
      </div>
      {help && !error && <small className={styles.help}>{help}</small>}
      {error && <small className={styles.error}>{error}</small>}
    </label>
  ),
);
ColorField.displayName = 'ColorField';
