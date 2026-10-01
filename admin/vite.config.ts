import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// ADMIN_BASE lets the panel live under a sub-path (e.g. /admin/ inside the website). Default: domain root.
export default defineConfig({ base: process.env.ADMIN_BASE ?? '/', plugins: [react()], resolve: { alias: { '@': '/src' } } });
