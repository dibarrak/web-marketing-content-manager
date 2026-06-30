import { useState, type FormEvent } from 'react';
import { changePassword } from '@lib/auth-client';
import { ROLE_LABELS } from '@lib/authz';
import styles from './AccountView.module.scss';

interface Props {
  name: string;
  email: string;
  role: string;
}

export default function AccountView({ name, email, role }: Props) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (next !== confirm) {
      setError('La nueva contraseña y su confirmación no coinciden.');
      return;
    }
    if (next.length < 10) {
      setError('La nueva contraseña debe tener al menos 10 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const res = await changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true,
      });
      if (res.error) {
        setError(res.error.message ?? 'No se pudo cambiar la contraseña.');
      } else {
        setSuccess(true);
        setCurrent('');
        setNext('');
        setConfirm('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Mi cuenta</h1>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Datos</h2>
        <dl className={styles.dataList}>
          <div>
            <dt>Nombre</dt>
            <dd>{name}</dd>
          </div>
          <div>
            <dt>Correo</dt>
            <dd>{email}</dd>
          </div>
          <div>
            <dt>Rol</dt>
            <dd>
              <span className={styles.roleBadge}>{ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role}</span>
            </dd>
          </div>
        </dl>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Cambiar contraseña</h2>
        <form className={styles.form} onSubmit={onSubmit} noValidate>
          <label className={styles.field}>
            <span>Contraseña actual</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span>Nueva contraseña</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span>Confirmar nueva contraseña</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>

          {error && <p className={styles.error}>{error}</p>}
          {success && (
            <p className={styles.success}>Contraseña actualizada correctamente.</p>
          )}

          <button type="submit" className={styles.submit} disabled={loading}>
            {loading ? 'Guardando…' : 'Cambiar contraseña'}
          </button>
        </form>
      </section>
    </main>
  );
}
