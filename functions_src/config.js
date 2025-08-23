import { defineConfig } from 'vite'
import nearleyc from '../plugins/nearleyc'
import path from 'path'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    nodePolyfills(),
    nearleyc(),
  ],
  base: './',
  build: {
    outDir: 'functions',
    copyPublicDir: false,
    lib: {
        entry: './functions_src/server.js',
        formats: ['es'],
        fileName: 'api'
    }
  },
  resolve: {
    alias: {
        "@": path.resolve(__dirname, "../src"),
    },
},
})
