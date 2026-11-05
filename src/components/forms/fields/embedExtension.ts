import { mergeAttributes, Node } from '@tiptap/core';

/**
 * Hosts allowed inside an embedded <iframe>. The editor schema drops any other
 * iframe, so pasting arbitrary HTML in "modo HTML" cannot inject foreign pages.
 */
const ALLOWED_HOSTS = [
  'www.youtube.com',
  'www.youtube-nocookie.com',
  'player.vimeo.com',
  'www.instagram.com',
];

const INSTAGRAM_PATH = /^\/(?:[\w.-]+\/)?(p|reel|reels|tv)\/([\w-]+)/;

/** Returns a safe https src for the iframe, or null if the URL is not allowed. */
export function normalizeEmbedSrc(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;

  if (url.hostname === 'instagram.com' || url.hostname === 'www.instagram.com') {
    const m = INSTAGRAM_PATH.exec(url.pathname);
    if (!m) return null;
    const kind = m[1] === 'reels' ? 'reel' : m[1];
    return `https://www.instagram.com/${kind}/${m[2]}/embed`;
  }

  if (url.hostname === 'youtu.be') {
    const id = url.pathname.slice(1);
    return /^[\w-]+$/.test(id) ? `https://www.youtube.com/embed/${id}` : null;
  }
  if (url.hostname === 'youtube.com' || url.hostname === 'www.youtube.com') {
    if (url.pathname === '/watch') {
      const id = url.searchParams.get('v');
      return id && /^[\w-]+$/.test(id) ? `https://www.youtube.com/embed/${id}` : null;
    }
  }

  if (url.hostname === 'vimeo.com') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
  }

  return ALLOWED_HOSTS.includes(url.hostname) ? url.toString() : null;
}

/**
 * Block node that round-trips an <iframe> (YouTube, Vimeo, Instagram). It also
 * converts a pasted Instagram `<blockquote class="instagram-media">` snippet
 * into the equivalent iframe, since Webflow strips the <script> that snippet
 * depends on.
 */
export const Embed = Node.create({
  name: 'embed',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      height: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'iframe[src]',
        getAttrs: (el) => {
          const node = el as HTMLElement;
          const src = normalizeEmbedSrc(node.getAttribute('src') ?? '');
          if (!src) return false;
          return { src, height: node.getAttribute('height') };
        },
      },
      {
        tag: 'blockquote[data-instgrm-permalink]',
        priority: 100,
        getAttrs: (el) => {
          const src = normalizeEmbedSrc(
            (el as HTMLElement).getAttribute('data-instgrm-permalink') ?? '',
          );
          return src ? { src } : false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const isInstagram = String(HTMLAttributes.src ?? '').includes('instagram.com');
    return [
      'iframe',
      mergeAttributes(
        {
          src: HTMLAttributes.src,
          width: isInstagram ? '400' : '560',
          height: HTMLAttributes.height ?? (isInstagram ? '480' : '315'),
          frameborder: '0',
          loading: 'lazy',
          allowfullscreen: 'true',
          ...(isInstagram ? { scrolling: 'no' } : {}),
        },
        {},
      ),
    ];
  },

  addCommands() {
    return {
      setEmbed:
        (src: string) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { src } }),
    };
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    embed: {
      setEmbed: (src: string) => ReturnType;
    };
  }
}
