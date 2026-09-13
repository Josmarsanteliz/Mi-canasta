
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  // Agrega esta línea para habilitar el modo SSR en todo el proyecto
  output: 'server',
  adapter: node({
    mode: 'standalone'
  }),
    vite: {
    plugins: [tailwindcss()]
  }
});
