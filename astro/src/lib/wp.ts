/**
 * Cliente del conector de WordPress (plugin headless-connector).
 * Todas las llamadas se hacen en el build y se cachean en memoria.
 */
import type { Entry, Menus, RoutesResponse, Site, Summary, Term } from './types';

export const WP_URL = (import.meta.env.WP_URL || 'http://localhost:8080').replace(/\/$/, '');
const TOKEN = import.meta.env.WP_API_TOKEN;

const cache = new Map<string, Promise<unknown>>();

async function request<T>(path: string, attempt = 1): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${WP_URL}/wp-json/headless/v1${path}`, {
      headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {},
    });
  } catch (e) {
    throw new Error(`No se puede conectar con WordPress en ${WP_URL} (${(e as Error).message}). ¿Está arrancado? Revisa WP_URL en .env.`);
  }
  if (!res.ok) {
    if (attempt < 3 && res.status >= 500) return request<T>(path, attempt + 1);
    throw new Error(`WordPress respondió ${res.status} en ${path}. ¿Está activo el plugin headless-connector?`);
  }
  return res.json() as Promise<T>;
}

export function wp<T>(path: string): Promise<T> {
  if (!cache.has(path)) cache.set(path, request<T>(path));
  return cache.get(path) as Promise<T>;
}

export const getSite = () => wp<Site>('/site');
export const getMenus = () => wp<Menus>('/menus');
export const getRoutes = () => wp<RoutesResponse>('/routes');
export const getEntry = (id: number) => wp<Entry>(`/entry/${id}`);
export const getTerm = (taxonomy: string, id: number) => wp<Term>(`/term/${taxonomy}/${id}`);

export function getList(type: string, params: Record<string, string | number | undefined> = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '') as [string, string][],
  ).toString();
  return wp<Summary[]>(`/list/${type}${qs ? `?${qs}` : ''}`);
}

/** Menú por ubicación del tema (primary, footer_menu…) con alternativa por slug. */
export async function getMenu(location: string, fallbackSlug?: string) {
  const menus = await getMenus();
  const slug = menus.locations[location] ?? fallbackSlug;
  return (slug && menus.menus[slug]?.items) || [];
}

/** Sustituye la URL de WordPress por la del sitio nuevo (schema, canonical…). */
export function toSiteUrl<T>(value: T, siteUrl: string): T {
  const json = JSON.stringify(value);
  if (!json) return value;
  const from = WP_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // No se tocan las URLs de /wp-content/ (imágenes alojadas en WordPress).
  const re = new RegExp(`${from}(?!/wp-content/)`, 'g');
  return JSON.parse(json.replace(re, siteUrl.replace(/\/$/, '')));
}
