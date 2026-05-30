import type { FieldErrors } from 'react-hook-form';
import { labelFor } from './field-labels';
import styles from './form.module.scss';

/**
 * Top-of-form summary so users never miss a validation error hidden below
 * the fold inside the modal. Field slugs are translated to human labels.
 */
export default function FormErrorSummary({ errors }: { errors: FieldErrors }) {
  const flat = Object.entries(errors).flatMap(([field, err]) => {
    if (!err) return [];
    const msg =
      typeof (err as { message?: unknown }).message === 'string'
        ? (err as { message: string }).message
        : 'Inválido';
    return [{ field, msg }];
  });
  if (flat.length === 0) return null;

  return (
    <div className={styles.errorSummary} role="alert">
      <strong>Hay {flat.length} campo(s) con errores:</strong>
      <ul>
        {flat.map(({ field, msg }) => (
          <li key={field}>
            <span className={styles.fieldName}>{labelFor(field)}</span>: {msg}
          </li>
        ))}
      </ul>
    </div>
  );
}
