import {defineConfig} from 'vite'
import tailwind from '@tailwindcss/vite'
export default defineConfig({define:{'process.env.NODE_ENV':JSON.stringify('production')},plugins:[tailwind()],resolve:{alias:{'@':new URL('./src',import.meta.url).pathname}},build:{outDir:'../public/ui',emptyOutDir:true,lib:{entry:'src/main.jsx',name:'PixStudyUI',formats:['iife'],fileName:()=> 'ui.js',cssFileName:'ui'}}})

