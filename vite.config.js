// vite.config.js
import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    server: {
        watch: {
            usePolling: true,
            interval: 100,
        },
        proxy: {
            '/store': {
                target: 'https://store.steampowered.com',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/store/, ''),
            },
        },
    },
})
