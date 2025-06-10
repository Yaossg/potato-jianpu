import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import run from 'vite-plugin-run'
import nearleyc from './plugins/nearleyc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nearleyc(),
    run({
      name: 'Generate grammar railroad',
      run: ['nearley-railroad', './src/grammar/grammar.ne', '-o', './public/grammar.html'],
      condition: (file) => file.includes('/grammar/'),
    })
  ],
  base: './'
})
