import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      // Avertissement pour chunks > 500 kB
      chunkSizeWarningLimit: 600,
      // Code splitting manuel — isole les librairies lourdes pour permettre
      // au navigateur de les cacher et de les charger en parallèle.
      // Vite 8 utilise Rolldown qui exige manualChunks sous forme de FONCTION.
      rollupOptions: {
        output: {
          manualChunks: (moduleId: string) => {
            if (moduleId.includes('node_modules')) {
              if (moduleId.includes('recharts') || moduleId.includes('d3-')) return 'charts-vendor';
              if (moduleId.includes('jspdf')) return 'pdf-vendor';
              if (moduleId.includes('motion') || moduleId.includes('framer-motion')) return 'motion-vendor';
              if (moduleId.includes('lucide-react')) return 'icons-vendor';
              if (moduleId.includes('dexie')) return 'db-vendor';
              if (moduleId.includes('zustand') || moduleId.includes('zod') || moduleId.includes('@tanstack/react-virtual')) return 'state-vendor';
              if (moduleId.includes('react') || moduleId.includes('scheduler')) return 'react-vendor';
            }
            return undefined;
          },
        },
      },
    },
  };
});
