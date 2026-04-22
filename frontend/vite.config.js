import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs'
import { join, resolve } from 'path'

// 自定义插件：复制静态资源
function copyStaticAssets() {
  return {
    name: 'copy-static-assets',
    writeBundle() {
      const assetsDir = resolve(__dirname, '../app/ui')
      const imagesSource = resolve(__dirname, '../images')
      const configSource = resolve(__dirname, '../config_backup')
      
      // 复制images目录
      if (existsSync(imagesSource)) {
        const imagesDest = join(assetsDir, 'images')
        if (!existsSync(imagesDest)) {
          mkdirSync(imagesDest, { recursive: true })
        }
        
        const copyDir = (src, dest) => {
          const entries = readdirSync(src, { withFileTypes: true })
          entries.forEach(entry => {
            const srcPath = join(src, entry.name)
            const destPath = join(dest, entry.name)
            if (entry.isDirectory()) {
              mkdirSync(destPath, { recursive: true })
              copyDir(srcPath, destPath)
            } else {
              copyFileSync(srcPath, destPath)
            }
          })
        }
        
        copyDir(imagesSource, imagesDest)
        console.log('✓ Copied images directory')
      }
      
      // 复制config文件
      if (existsSync(configSource)) {
        const configDest = join(assetsDir, 'config')
        copyFileSync(configSource, configDest)
        console.log('✓ Copied config file')
      }
    }
  }
}

export default defineConfig({
  plugins: [react(), copyStaticAssets()],
  build: {
    outDir: '../app/ui',
    emptyOutDir: true,
    assetsDir: 'assets',
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3300',
        changeOrigin: true,
      }
    }
  }
})
