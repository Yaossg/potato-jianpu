import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import run from 'vite-plugin-run'
import nearleyc from './plugins/nearleyc'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nearleyc(),
    run({
      name: 'Generate grammar railroad',
      run: ['nearley-railroad', './src/parser/grammar.ne', '-o', './public/grammar.html'],
      condition: (file) => file.includes('grammar.ne'),
    })
  ],
  base: './',
  resolve: {
    alias: {
        "@": path.resolve(__dirname, "./src"),
    },
},
})
