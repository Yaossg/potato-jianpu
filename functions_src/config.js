import { defineConfig } from 'vite'
import nearleyc from '../plugins/nearleyc'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
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
