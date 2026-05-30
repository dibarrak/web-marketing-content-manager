/**
 * Image → WEBP conversion.
 *
 * Two implementations behind a single API:
 *   • dev (Node):   `sharp` — robust, handles every format users throw at it.
 *   • prod (Workers): `@cf-wasm/photon` — WASM, the only option on the edge.
 *
 * Vite tree-shakes the unused branch at build time based on `import.meta.env.DEV`,
 * so the production bundle never references `sharp` (which doesn't run on
 * Workers anyway).
 */

export interface WebpResult {
  bytes: Uint8Array;
  contentType: 'image/webp';
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
}

export interface WebpOptions {
  /** Resize so neither dimension exceeds this. Skipped if undefined. */
  maxDimension?: number;
  /** Hard cap on input bytes; throws above this. Default 10 MB. */
  maxInputBytes?: number;
  /** WEBP quality 0–100. Default 82. */
  quality?: number;
}

async function toWebpSharp(bytes: Uint8Array, opts: WebpOptions): Promise<WebpResult> {
  const sharp = (await import('sharp')).default;
  let pipe = sharp(bytes, { failOn: 'none' }).rotate(); // honor EXIF orientation
  if (opts.maxDimension) {
    pipe = pipe.resize({
      width: opts.maxDimension,
      height: opts.maxDimension,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }
  const out = await pipe.webp({ quality: opts.quality ?? 82 }).toBuffer({ resolveWithObject: true });
  return {
    bytes: new Uint8Array(out.data),
    contentType: 'image/webp',
    width: out.info.width,
    height: out.info.height,
    originalSize: bytes.byteLength,
    compressedSize: out.data.byteLength,
  };
}

async function toWebpPhoton(bytes: Uint8Array, opts: WebpOptions): Promise<WebpResult> {
  const { PhotonImage } = await import('@cf-wasm/photon');
  let image: InstanceType<typeof PhotonImage> | null = null;
  let resized: InstanceType<typeof PhotonImage> | null = null;
  try {
    image = PhotonImage.new_from_byteslice(bytes);
    const w = image.get_width();
    const h = image.get_height();

    let outImage: InstanceType<typeof PhotonImage> = image;
    let outW = w;
    let outH = h;

    if (opts.maxDimension && (w > opts.maxDimension || h > opts.maxDimension)) {
      const ratio = Math.min(opts.maxDimension / w, opts.maxDimension / h);
      outW = Math.round(w * ratio);
      outH = Math.round(h * ratio);
      resized = image.resize(outW, outH, 1); // 1 = Lanczos3
      outImage = resized;
    }

    const webp = outImage.get_bytes_webp();
    return {
      bytes: webp,
      contentType: 'image/webp',
      width: outW,
      height: outH,
      originalSize: bytes.byteLength,
      compressedSize: webp.byteLength,
    };
  } finally {
    image?.free();
    resized?.free();
  }
}

export async function toWebp(
  input: ArrayBuffer | Uint8Array,
  opts: WebpOptions = {},
): Promise<WebpResult> {
  const maxInput = opts.maxInputBytes ?? 10 * 1024 * 1024;
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength > maxInput) {
    throw new Error(`Image exceeds max size: ${bytes.byteLength} bytes (limit ${maxInput}).`);
  }

  if (import.meta.env.DEV) {
    try {
      return await toWebpSharp(bytes, opts);
    } catch (err) {
      throw new Error(
        `Image conversion failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  return toWebpPhoton(bytes, opts);
}

export function replaceExtensionWithWebp(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '') + '.webp';
}
