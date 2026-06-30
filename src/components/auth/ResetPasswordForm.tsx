import { useState, type FormEvent } from 'react';
import { withBase } from '@lib/base-path';
import styles from './LoginForm.module.scss';

export default function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Enlace inválido: falta el token.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (password.length < 10) {
      setError('La contraseña debe tener al menos 10 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(withBase('api/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `Error ${res.status}`);
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className={styles.form}>
        <h1 className={styles.title}>Contraseña actualizada</h1>
        <p>Tu contraseña se cambió correctamente. Ya puedes iniciar sesión.</p>
        <a className={styles.submit} href={withBase('login')} style={{ textAlign: 'center' }}>
          Ir a iniciar sesión
        </a>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <h1 className={styles.title}>Restablecer contraseña</h1>

      <label className={styles.field}>
        <span>Nueva contraseña</span>
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>

      <label className={styles.field}>
        <span>Confirmar contraseña</span>
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

      <button type="submit" className={styles.submit} disabled={loading}>
        {loading ? '…' : 'Guardar contraseña'}
      </button>
    </form>
  );
}
