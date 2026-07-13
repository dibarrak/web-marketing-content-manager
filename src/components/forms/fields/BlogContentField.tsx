import { withBase } from '@lib/base-path';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useRef, useState } from 'react';
import styles from './fields.module.scss';

interface Props {
  label: string;
  value: string;
  onChange: (html: string) => void;
  /** Collection whose site receives uploaded images (resolves siteId + token). */
  collectionId: string;
  required?: boolean;
  error?: string;
  help?: string;
}

interface UploadResponse {
  url: string;
  error?: string;
}

/**
 * Full rich-text editor for blog post content. Beyond text formatting it can
 * embed images two ways, both of which avoid inlining base64 (Webflow rejects
 * oversized field values):
 *   - Upload: file is sent to /api/assets/upload, converted to WEBP server-side,
 *     hosted on the Cash site, and inserted as <img src="hostedUrl">.
 *   - By URL: an external image URL is inserted directly as <img>.
 */
export default function BlogContentField({
  label,
  value,
  onChange,
  collectionId,
  required,
  error,
  help,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener' } }),
      Image.configure({ inline: false, HTMLAttributes: { loading: 'lazy' } }),
    ],
    content: value || '',
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Sync external value updates (e.g. when editing an existing post).
  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) editor.commands.setContent(value || '', false);
  }, [value, editor]);

  const toggleLink = () => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('URL del enlace (vacío para quitar):', prev ?? '');
    if (url === null) return;
    if (url === '') editor.chain().focus().extendMarkRange('link').unsetLink().run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const insertImageByUrl = () => {
    if (!editor) return;
    const url = window.prompt('URL de la imagen:');
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  };

  async function uploadImage(file: File) {
    if (!editor) return;
    setLocalError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('collectionId', collectionId);
      form.append('maxDimension', '1600');
      const res = await fetch(withBase('api/assets/upload'), { method: 'POST', body: form });
      const data = (await res.json().catch(() => null)) as UploadResponse | null;
      if (!res.ok || !data?.url) {
        throw new Error(data?.error ?? `Error al subir (${res.status})`);
      }
      editor.chain().focus().setImage({ src: data.url }).run();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Error al subir la imagen');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className={styles.field}>
      <span className={styles.label}>
        {label} {required && <em className={styles.req}>*</em>}
      </span>
      {editor && (
        <div className={styles.rich}>
          <div className={styles.richToolbar}>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBold().run()}
              aria-pressed={editor.isActive('bold')}
              title="Negrita"
            >
              <strong>B</strong>
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              aria-pressed={editor.isActive('italic')}
              title="Cursiva"
            >
              <em>I</em>
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              aria-pressed={editor.isActive('heading', { level: 2 })}
              title="Encabezado 2"
            >
              H2
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              aria-pressed={editor.isActive('heading', { level: 3 })}
              title="Encabezado 3"
            >
              H3
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              aria-pressed={editor.isActive('bulletList')}
            >
              • lista
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              aria-pressed={editor.isActive('orderedList')}
            >
              1. lista
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              aria-pressed={editor.isActive('blockquote')}
              title="Cita"
            >
              ❝
            </button>
            <button type="button" onClick={toggleLink} aria-pressed={editor.isActive('link')}>
              link
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              title="Subir imagen (se convierte a WEBP)"
            >
              {uploading ? 'subiendo…' : '⬆ imagen'}
            </button>
            <button type="button" onClick={insertImageByUrl} title="Insertar imagen por URL">
              🔗 imagen URL
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
              title="Limpiar formato"
            >
              limpiar
            </button>
          </div>
          <EditorContent editor={editor} className={styles.richContent} />
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadImage(f);
            }}
          />
        </div>
      )}
      {help && !error && !localError && <small className={styles.help}>{help}</small>}
      {(error || localError) && <small className={styles.error}>{error ?? localError}</small>}
    </div>
  );
}
