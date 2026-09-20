import { defineConfig } from 'vite';

export default defineConfig({
  // Caminhos relativos: o build funciona em qualquer hospedagem, inclusive
  // dentro de um subdiretorio, sem precisar reconfigurar nada.
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsDir: 'assets',
  },
  server: {
    // host: true expoe o servidor na rede local, para testar no celular real
    // durante o desenvolvimento.
    host: true,
    port: 5173,
  },
});
