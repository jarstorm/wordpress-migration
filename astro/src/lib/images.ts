/**
 * Optimización de imágenes de WordPress en el build.
 * Toda <img> que apunte a /wp-content/uploads se descarga, se convierte a WebP
 * en varios anchos y se reescribe con srcset, width/height y lazy loading.
 */
import { getImage } from 'astro:assets';
import { WP_URL } from './wp';
import type { Media } from './types';

const WIDTHS = [400, 800, 1200, 1600, 2000];

const WP_HOST = new URL(WP_URL).host;

function isWpUpload(src: string) {
  if (src.startsWith('/wp-content/')) return true;
  try {
    const u = new URL(src);
    return u.host === WP_HOST && u.pathname.includes('/wp-content/');
  } catch {
    return false;
  }
}

function absolute(src: string) {
  return src.startsWith('/') ? `${WP_URL}${src}` : src;
}

function attr(tag: string, name: string) {
  const m = tag.match(new RegExp(`\\s${name}=(["'])(.*?)\\1`, 'i'));
  return m ? m[2] : undefined;
}

function escapeAttr(v: string) {
  return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

export interface ImgOptions {
  /** Primera imagen visible (portada): carga inmediata y prioridad alta. */
  eager?: boolean;
  sizes?: string;
  className?: string;
}

/** Devuelve los atributos optimizados para una imagen de WordPress. */
export async function optimize(src: string, width?: number, height?: number, sizes = '(min-width: 1200px) 1200px, 100vw') {
  const url = absolute(src);
  const base = width && height ? { width, height } : { inferSize: true as const };
  const maxW = width ?? 2000;
  const widths = WIDTHS.filter((w) => w < maxW).concat(Math.min(maxW, 2000));
  const img = await getImage({ src: url, ...base, format: 'webp', widths, sizes } as any);
  return {
    src: img.src,
    srcset: img.srcSet.attribute,
    width: Number(img.attributes.width ?? width),
    height: Number(img.attributes.height ?? height),
    sizes,
  };
}

/** URL de una imagen convertida (para og:image, favicon…), servida desde el propio sitio. */
export async function imageUrl(src: string, width: number, format: 'jpg' | 'png' | 'webp' = 'jpg') {
  const img = await getImage({ src: absolute(src), width, inferSize: true, format } as any);
  return img.src;
}

/** HTML de una imagen optimizada a partir de un objeto Media del conector. */
export async function imgFromMedia(media: Media, opts: ImgOptions = {}) {
  const o = await optimize(media.url, media.width, media.height, opts.sizes);
  return `<img src="${o.src}" srcset="${o.srcset}" sizes="${o.sizes}" width="${o.width}" height="${o.height}" alt="${escapeAttr(media.alt ?? '')}"${opts.className ? ` class="${opts.className}"` : ''} ${opts.eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
}

/** Reescribe todas las <img> de WordPress dentro de un fragmento HTML. */
export async function optimizeHtml(html: string, opts: ImgOptions = {}) {
  if (!html || !html.includes('<img')) return html;
  const tags = html.match(/<img\b[^>]*>/gi) ?? [];
  let first = true;
  for (const tag of tags) {
    const src = attr(tag, 'src');
    if (!src || !isWpUpload(src) || /\.svg(\?|$)/i.test(src)) continue;
    const w = Number(attr(tag, 'width')) || undefined;
    const h = Number(attr(tag, 'height')) || undefined;
    try {
      const o = await optimize(src, w && h ? w : undefined, w && h ? h : undefined, opts.sizes);
      const cls = attr(tag, 'class');
      const alt = attr(tag, 'alt') ?? '';
      const style = attr(tag, 'style');
      const dataFit = attr(tag, 'data-object-fit');
      const eager = opts.eager && first;
      const out = `<img src="${o.src}" srcset="${o.srcset}" sizes="${o.sizes}" width="${o.width}" height="${o.height}" alt="${alt}"${cls ? ` class="${cls}"` : ''}${style ? ` style="${style}"` : ''}${dataFit ? ` data-object-fit="${dataFit}"` : ''} ${eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
      html = html.replace(tag, out);
    } catch (e) {
      console.warn(`[images] No se pudo optimizar ${src}: ${(e as Error).message}`);
    }
    first = false;
  }
  return html;
}
