import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      // Tauri expects a fixed port, and we'll use clearScreen: false to avoid conflicts
      server: {
        port: 5173,
        strictPort: true,
        host: '0.0.0.0',
        hmr: {
          port: 5174,
        },
      },
      // Environment variables for backward compatibility
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      // Prevent vite from obscuring rust errors
      clearScreen: false,
      // Tauri uses Chromium on Windows and WebKit on macOS and Linux
      envPrefix: ['VITE_', 'TAURI_'],
      build: {
        // Tauri supports es2021
        target: process.env.TAURI_PLATFORM == 'windows' ? 'chrome105' : 'safari13',
        // Don't minify for debug builds
        minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
        // Produce sourcemaps for debug builds
        sourcemap: !!process.env.TAURI_DEBUG,
      },
    };
});
