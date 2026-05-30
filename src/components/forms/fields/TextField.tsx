import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import styles from './fields.module.scss';

interface BaseProps {
  label: string;
  error?: string;
  help?: string;
  required?: boolean;
}

/**
 * forwardRef is required so react-hook-form's `register()` ref reaches the
 * underlying <input>. Without it, RHF cannot read the value and validation
 * sees `undefined` on every field.
 */
export const TextField = forwardRef<
  HTMLInputElement,
  BaseProps & InputHTMLAttributes<HTMLInputElement>
>(({ label, error, help, required, ...rest }, ref) => (
  <label className={styles.field}>
    <span className={styles.label}>
      {label} {required && <em className={styles.req}>*</em>}
    </span>
    <input ref={ref} className={styles.input} aria-invalid={!!error} {...rest} />
    {help && !error && <small className={styles.help}>{help}</small>}
    {error && <small className={styles.error}>{error}</small>}
  </label>
));
TextField.displayName = 'TextField';

export const TextAreaField = forwardRef<
  HTMLTextAreaElement,
  BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ label, error, help, required, ...rest }, ref) => (
  <label className={styles.field}>
    <span className={styles.label}>
      {label} {required && <em className={styles.req}>*</em>}
    </span>
    <textarea
      ref={ref}
      className={styles.textarea}
      aria-invalid={!!error}
      rows={3}
      {...rest}
    />
    {help && !error && <small className={styles.help}>{help}</small>}
    {error && <small className={styles.error}>{error}</small>}
  </label>
));
TextAreaField.displayName = 'TextAreaField';
