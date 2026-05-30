import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { useEffect } from 'react';
import styles from './fields.module.scss';

interface Props {
  label: string;
  value: string;
  onChange: (html: string) => void;
  required?: boolean;
  error?: string;
  help?: string;
  /** Compact = no headings/lists. Used for titles and descriptions. */
  compact?: boolean;
}

export default function RichTextField({
  label,
  value,
  onChange,
  required,
  error,
  help,
  compact,
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener' } }),
    ],
    content: value || '',
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Sync external value updates (e.g. when editing an existing item).
  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) editor.commands.setContent(value || '', { emitUpdate: false });
  }, [value, editor]);

  const toggleLink = () => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('URL del enlace (vacío para quitar):', prev ?? '');
    if (url === null) return;
    if (url === '') editor.chain().focus().extendMarkRange('link').unsetLink().run();
    else
      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink({ href: url })
        .run();
  };

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
              onClick={() => editor.chain().focus().setHardBreak().run()}
              title="Salto de línea (<br>)"
            >
              ↵ br
            </button>
            {!compact && (
              <>
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
              </>
            )}
            <button type="button" onClick={toggleLink} aria-pressed={editor.isActive('link')}>
              link
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
              title="Limpiar formato"
            >
              limpiar
            </button>
          </div>
          <EditorContent
            editor={editor}
            className={`${styles.richContent} ${compact ? styles.richCompact : ''}`}
          />
        </div>
      )}
      {help && !error && <small className={styles.help}>{help}</small>}
      {error && <small className={styles.error}>{error}</small>}
    </div>
  );
}
