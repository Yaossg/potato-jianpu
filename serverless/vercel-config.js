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
    outDir: 'api-impl',
    copyPublicDir: false,
    lib: {
        entry: './serverless/server.js',
        formats: ['es'],
        fileName: 'index'
    }
  },
  resolve: {
    alias: {
        "@": path.resolve(__dirname, "../src"),
    },
},
})
