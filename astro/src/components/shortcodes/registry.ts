/**
 * Shortcodes con componente nativo en Astro.
 * Los genéricos (plugins habituales) están aquí; los propios del cliente se
 * registran en src/site/shortcodes.ts.
 * Un shortcode sin componente se pinta con el HTML que devolvió WordPress.
 */
import ContactForm7 from './ContactForm7.astro';
import { siteShortcodes } from '../../site/shortcodes';

export const shortcodeComponents: Record<string, any> = {
  'contact-form-7': ContactForm7,
  ...siteShortcodes,
};
