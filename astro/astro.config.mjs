// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { loadEnv } from 'vite';

const env = loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), '');
const wp = new URL(env.WP_URL || 'http://localhost:8080');

export default defineConfig({
  site: env.SITE_URL || 'http://localhost:4321',
  // WordPress usa /%postname%/ con barra final: mantenemos exactamente las mismas URLs.
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [sitemap()],
  image: {
    // Las imágenes se descargan de WordPress en el build y se convierten a WebP en varios tamaños.
    remotePatterns: [
      {
        protocol: wp.protocol.replace(':', ''),
        hostname: wp.hostname,
        ...(wp.port ? { port: wp.port } : {}),
      },
    ],
  },
});
