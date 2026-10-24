import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// Reads the repo-root .env, but only exposes the two public Supabase values to the browser.
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, '..', ''), ...process.env }
  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || ''
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || ''
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@fixtures': path.resolve(__dirname, '../contract/fixtures'),
      },
    },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
    },
    server: {
      port: 5173,
      proxy: { '/api': 'http://localhost:8000', '/mcp': 'http://localhost:8000' },
    },
  }
})
