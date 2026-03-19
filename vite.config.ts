import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      '/openaq': {
        target: 'https://api.openaq.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/openaq/, ''),
      },
      '/owm': {
        target: 'https://api.openweathermap.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/owm/, ''),
      },
    },
  },

  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));