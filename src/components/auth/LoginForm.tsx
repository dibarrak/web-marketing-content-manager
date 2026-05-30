import { useState, type FormEvent } from 'react';
import { signIn, signUp } from '@lib/auth-client';
import styles from './LoginForm.module.scss';

type Mode = 'signin' | 'signup';

export default function LoginForm({ next = '/dashboard' }: { next?: string }) {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res =
        mode === 'signin'
          ? await signIn.email({ email, password })
          : await signUp.email({ email, password, name });
      if (res.error) {
        setError(res.error.message ?? 'Unable to authenticate.');
      } else {
        window.location.href = next;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <h1 className={styles.title}>
        {mode === 'signin' ? 'Iniciar sesión' : 'Crear cuenta'}
      </h1>

      {mode === 'signup' && (
        <label className={styles.field}>
          <span>Nombre</span>
          <input
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
      )}

      <label className={styles.field}>
        <span>Correo</span>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>

      <label className={styles.field}>
        <span>Contraseña</span>
        <input
          type="password"
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          required
          minLength={10}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>

      {error && <p className={styles.error}>{error}</p>}

      <button type="submit" className={styles.submit} disabled={loading}>
        {loading ? '…' : mode === 'signin' ? 'Entrar' : 'Registrarme'}
      </button>

      <button
        type="button"
        className={styles.toggle}
        onClick={() => {
          setError(null);
          setMode(mode === 'signin' ? 'signup' : 'signin');
        }}
      >
        {mode === 'signin'
          ? '¿No tienes cuenta? Crea una'
          : '¿Ya tienes cuenta? Inicia sesión'}
      </button>
    </form>
  );
}
