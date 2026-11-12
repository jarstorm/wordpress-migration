/**
 * Bloques de Gutenberg con componente propio.
 * Los que no aparecen aquí se pintan con el HTML de WordPress (ver Block.astro).
 * Añade aquí los bloques que necesiten lógica en Astro (dinámicos, de plugins…).
 */
import LatestPosts from './LatestPosts.astro';
import ShortcodeBlock from './ShortcodeBlock.astro';

export const blockComponents: Record<string, any> = {
  'core/latest-posts': LatestPosts,
  'core/shortcode': ShortcodeBlock,
};
