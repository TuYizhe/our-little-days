import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/our-little-days/',
  plugins: [react()],
  build: { target: 'es2022' },
})
