import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// https://vitejs.dev/config/
export default defineConfig({
  base: './', 
  plugins: [
    react(),
    tailwindcss(),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/stockfish/src/stockfish-17.1-single-a496a04.js',
          dest: 'stockfish'
        },
        {
          src: 'node_modules/stockfish/src/stockfish-17.1-single-a496a04-part-0.wasm',
          dest: 'stockfish'
        },
        {
          src: 'node_modules/stockfish/src/stockfish-17.1-single-a496a04-part-1.wasm',
          dest: 'stockfish'
        },
        {
          src: 'node_modules/stockfish/src/stockfish-17.1-single-a496a04-part-2.wasm',
          dest: 'stockfish'
        },
        {
          src: 'node_modules/stockfish/src/stockfish-17.1-single-a496a04-part-3.wasm',
          dest: 'stockfish'
        },
        {
          src: 'node_modules/stockfish/src/stockfish-17.1-single-a496a04-part-4.wasm',
          dest: 'stockfish'
        },
        {
          src: 'node_modules/stockfish/src/stockfish-17.1-single-a496a04-part-5.wasm',
          dest: 'stockfish'
        }
      ]
    })
  ],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
})