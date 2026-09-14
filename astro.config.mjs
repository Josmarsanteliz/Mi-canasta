import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

import netlify from '@astrojs/netlify';

export default defineConfig({
  // Agrega esta línea para habilitar el modo SSR en todo el proyecto
  output: 'server',
  adapter: netlify(),
    vite: {
    plugins: [tailwindcss()]
  }
});