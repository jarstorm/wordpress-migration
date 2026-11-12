/**
 * Shortcodes propios de Nortia Reformas (definidos en su mu-plugin nortia-core.php).
 * Se reimplementan en Astro para no depender del HTML de WordPress.
 */
import ProyectosGrid from './components/ProyectosGrid.astro';
import EquipoGrid from './components/EquipoGrid.astro';

export const siteShortcodes: Record<string, any> = {
  nortia_proyectos: ProyectosGrid,
  nortia_equipo: EquipoGrid,
};
