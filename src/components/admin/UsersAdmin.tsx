import { useEffect, useState } from 'react';
import { withBase } from '@lib/base-path';
import { EDITOR_ASSIGNABLE_SECTIONS, ROLE_LABELS, type Role } from '@lib/authz';
import { COLLECTIONS } from '@lib/config/sites';
import styles from './UsersAdmin.module.scss';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  allowedSections: string[] | null;
  banned: boolean | null;
  createdAt: string;
}

const SECTION_LABELS: Record<string, string> = Object.fromEntries(
  Object.values(COLLECTIONS).map((c) => [c.key, c.displayName]),
);

const api = (path: string) => withBase(`api/admin/${path}`);

export default function UsersAdmin({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [resetFor, setResetFor] = useState<AdminUser | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(api('users'));
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = (await res.json()) as { users: AdminUser[] };
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando usuarios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Usuarios</h1>
        <button type="button" className={styles.primary} onClick={() => setShowCreate(true)}>
          Crear usuario
        </button>
      </header>

      {error && <div className={styles.errorBanner}>{error}</div>}
      {loading ? (
        <p>Cargando…</p>
      ) : (
        <div className={styles.list}>
          {users.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              isSelf={u.id === currentUserId}
              onChanged={load}
              onReset={() => setResetFor(u)}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            void load();
          }}
        />
      )}

      {resetFor && (
        <ResetPasswordModal user={resetFor} onClose={() => setResetFor(null)} />
      )}
    </main>
  );
}

function UserRow({
  user,
  isSelf,
  onChanged,
  onReset,
}: {
  user: AdminUser;
  isSelf: boolean;
  onChanged: () => void;
  onReset: () => void;
}) {
  const [role, setRole] = useState<Role>(user.role);
  const [sections, setSections] = useState<string[]>(user.allowedSections ?? []);
  const [saving, setSaving] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const dirty =
    role !== user.role ||
    (role === 'editor' &&
      JSON.stringify([...sections].sort()) !==
        JSON.stringify([...(user.allowedSections ?? [])].sort()));

  const toggleSection = (key: string) => {
    setSections((prev) =>
      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key],
    );
  };

  const save = async () => {
    setSaving(true);
    setRowError(null);
    try {
      const res = await fetch(api(`users/${user.id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, allowedSections: sections }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `Error ${res.status}`);
      }
      onChanged();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : 'Error guardando.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm(`¿Eliminar a ${user.email}? Esta acción no se puede deshacer.`)) return;
    setSaving(true);
    setRowError(null);
    try {
      const res = await fetch(api(`users/${user.id}`), { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `Error ${res.status}`);
      }
      onChanged();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : 'Error eliminando.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.row}>
      <div className={styles.identity}>
        <strong>{user.name}</strong>
        <span className={styles.email}>{user.email}</span>
      </div>

      <div className={styles.controls}>
        <label className={styles.roleSelect}>
          <span>Rol</span>
          <select
            value={role}
            disabled={isSelf}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>

        {role === 'editor' && (
          <div className={styles.sections}>
            <span className={styles.sectionsLabel}>Secciones permitidas</span>
            <div className={styles.sectionChips}>
              {EDITOR_ASSIGNABLE_SECTIONS.map((key) => (
                <label key={key} className={styles.chip}>
                  <input
                    type="checkbox"
                    checked={sections.includes(key)}
                    onChange={() => toggleSection(key)}
                  />
                  {SECTION_LABELS[key] ?? key}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={onReset}>
          Restablecer contraseña
        </button>
        <button
          type="button"
          className={styles.primary}
          disabled={!dirty || saving}
          onClick={save}
        >
          {saving ? '…' : 'Guardar'}
        </button>
        {!isSelf && (
          <button type="button" className={styles.danger} disabled={saving} onClick={remove}>
            Eliminar
          </button>
        )}
      </div>

      {rowError && <p className={styles.rowError}>{rowError}</p>}
      {isSelf && <p className={styles.selfNote}>Esta es tu cuenta.</p>}
    </div>
  );
}

function CreateUserModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('editor');
  const [sections, setSections] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleSection = (key: string) =>
    setSections((prev) =>
      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key],
    );

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(api('users'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role, allowedSections: sections }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `Error ${res.status}`);
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creando usuario.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.modalBackdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modalCard}>
        <h2>Crear usuario</h2>
        <p className={styles.modalHint}>
          Se crea con una contraseña temporal. Compártela con la persona por un canal
          interno; podrá cambiarla en su panel de cuenta.
        </p>
        <label className={styles.field}>
          <span>Nombre</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>Correo</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>Contraseña temporal (mín. 10 caracteres)</span>
          <input
            type="text"
            minLength={10}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>Rol</span>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>

        {role === 'editor' && (
          <div className={styles.sections}>
            <span className={styles.sectionsLabel}>Secciones permitidas</span>
            <div className={styles.sectionChips}>
              {EDITOR_ASSIGNABLE_SECTIONS.map((key) => (
                <label key={key} className={styles.chip}>
                  <input
                    type="checkbox"
                    checked={sections.includes(key)}
                    onChange={() => toggleSection(key)}
                  />
                  {SECTION_LABELS[key] ?? key}
                </label>
              ))}
            </div>
          </div>
        )}

        {error && <p className={styles.rowError}>{error}</p>}

        <div className={styles.modalActions}>
          <button type="button" className={styles.secondary} onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className={styles.primary} disabled={saving} onClick={submit}>
            {saving ? 'Creando…' : 'Crear'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResetPasswordModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const [mode, setMode] = useState<'A' | 'B'>('A');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneA, setDoneA] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const submitA = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(api(`users/${user.id}/password`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `Error ${res.status}`);
      }
      setDoneA(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error.');
    } finally {
      setSaving(false);
    }
  };

  const submitB = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(api(`users/${user.id}/reset-link`), { method: 'POST' });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `Error ${res.status}`);
      }
      const data = (await res.json()) as { token: string; expiresAt: string };
      const url = `${window.location.origin}${withBase('reset-password')}?token=${data.token}`;
      setLink(url);
      setExpiresAt(data.expiresAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error.');
    } finally {
      setSaving(false);
    }
  };

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.modalBackdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modalCard}>
        <h2>Restablecer contraseña</h2>
        <p className={styles.modalHint}>
          Usuario: <strong>{user.email}</strong>
        </p>

        <div className={styles.modeTabs}>
          <button
            type="button"
            className={mode === 'A' ? styles.tabActive : styles.tab}
            onClick={() => setMode('A')}
          >
            Contraseña temporal
          </button>
          <button
            type="button"
            className={mode === 'B' ? styles.tabActive : styles.tab}
            onClick={() => setMode('B')}
          >
            Generar enlace
          </button>
        </div>

        {mode === 'A' ? (
          doneA ? (
            <p className={styles.success}>
              Contraseña actualizada. Compártela con la persona por un canal interno.
            </p>
          ) : (
            <>
              <label className={styles.field}>
                <span>Nueva contraseña temporal (mín. 10 caracteres)</span>
                <input
                  type="text"
                  minLength={10}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              {error && <p className={styles.rowError}>{error}</p>}
              <div className={styles.modalActions}>
                <button type="button" className={styles.secondary} onClick={onClose}>
                  Cerrar
                </button>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={saving}
                  onClick={submitA}
                >
                  {saving ? '…' : 'Establecer'}
                </button>
              </div>
            </>
          )
        ) : link ? (
          <>
            <p className={styles.modalHint}>
              Comparte este enlace por un canal interno. Es de un solo uso y expira
              {expiresAt ? ` el ${new Date(expiresAt).toLocaleString('es-MX')}` : ' en 24 horas'}.
            </p>
            <div className={styles.linkBox}>
              <code>{link}</code>
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.secondary} onClick={onClose}>
                Cerrar
              </button>
              <button type="button" className={styles.primary} onClick={copy}>
                {copied ? '¡Copiado!' : 'Copiar enlace'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className={styles.modalHint}>
              Genera un enlace de restablecimiento de un solo uso (válido 24 h) que la
              persona puede abrir para definir su propia contraseña. No se envía correo.
            </p>
            {error && <p className={styles.rowError}>{error}</p>}
            <div className={styles.modalActions}>
              <button type="button" className={styles.secondary} onClick={onClose}>
                Cerrar
              </button>
              <button type="button" className={styles.primary} disabled={saving} onClick={submitB}>
                {saving ? '…' : 'Generar enlace'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
