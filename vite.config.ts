import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  // O site é estático: não há servidor, nada é enviado a lugar nenhum.
  build: { target: 'es2022', outDir: 'dist' },
});
