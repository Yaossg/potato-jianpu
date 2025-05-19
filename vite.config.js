import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import run from 'vite-plugin-run'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    run({
      name: 'Generate grammar source',
      run: ['nearleyc', './grammar/grammar.ne', '-o', './src/generated/grammar.js'],
      condition: (file) => file.includes('/grammar/'),
    }),
    run({
      name: 'Generate grammar railroad',
      run: ['nearley-railroad', './grammar/grammar.ne', '-o', './public/grammar.html'],
      condition: (file) => file.includes('/grammar/'),
    })
  ],
  base: './'
})
