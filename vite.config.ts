import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  // PWA/service-worker removed: it relied on a flaky workbox/ajv build dep and
  // its aggressive precache was serving stale pages (old logo, old pricing).
  // The marketing/landing/invite site doesn't need offline support.
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Enable code splitting and chunk optimization
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'router': ['react-router-dom'],
          'supabase': ['@supabase/supabase-js'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-popover', '@radix-ui/react-avatar'],
          'utils': ['date-fns', 'clsx', 'tailwind-merge'],
        },
      },
    },
    // Increase chunk size warning limit for better performance
    chunkSizeWarningLimit: 1000,
    // Use Vite's built-in esbuild minifier so production builds do not depend
    // on a separate terser install.
    minify: 'esbuild',
  },
  // Enable compression for assets
  define: {
    // Remove dev tools in production
    __DEV__: mode === 'development',
  },
}));
