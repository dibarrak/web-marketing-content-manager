import { forwardRef, type InputHTMLAttributes } from 'react';
import styles from './fields.module.scss';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  help?: string;
  error?: string;
}

export const SwitchField = forwardRef<HTMLInputElement, Props>(
  ({ label, help, error, ...rest }, ref) => (
    <label className={`${styles.field} ${styles.switchRow}`}>
      <input ref={ref} type="checkbox" {...rest} />
      <span className={styles.label}>{label}</span>
      {help && !error && <small className={styles.help}>{help}</small>}
      {error && <small className={styles.error}>{error}</small>}
    </label>
  ),
);
SwitchField.displayName = 'SwitchField';
