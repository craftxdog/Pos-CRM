import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  externals: {
    pdfmake: 'pdfMake'
  },
  build: {
    // Los motores PDF y sus fuentes se cargan sólo al imprimir. El presupuesto
    // corresponde a ese chunk diferido, no al arranque de la aplicación.
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      external: ['pdfmake'],
    },
  },
})
