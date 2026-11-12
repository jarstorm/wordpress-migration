/**
 * Plantillas propias del sitio. Devuelve un componente para sustituir a la
 * plantilla genérica (src/templates/SingleTemplate.astro) o null para usarla.
 */
import type { Entry } from '../lib/types';
import ProyectoTemplate from './templates/ProyectoTemplate.astro';
import ServicioTemplate from './templates/ServicioTemplate.astro';

export function siteTemplate(entry: Entry): any | null {
  if (entry.type === 'proyecto') return ProyectoTemplate;
  // Páginas hijas de "Servicios" con campos de precio/plazo.
  if (entry.type === 'page' && entry.parent && (entry.acf?.precio_desde || entry.acf?.plazo)) return ServicioTemplate;
  return null;
}
