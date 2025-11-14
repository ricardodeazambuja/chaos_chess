import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // <-- ADD THIS

// https://vitejs.dev/config/
export default defineConfig({
  base: './', 
  plugins: [
    react(),
    tailwindcss(), // <-- AND ADD THIS
  ],
})