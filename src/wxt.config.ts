import { defineConfig } from 'wxt';
import { resolve } from 'path';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'FastBurp - API调试工具',
    description: '拦截、重放和分析网络请求，支持AI辅助分析',
    permissions: [
      'storage', 
      'debugger', 
      'tabs', 
      'notifications', 
      'webRequest',
      'scripting',
      'windows',
      'proxy'
    ],
    host_permissions: ["<all_urls>"],
    action: {
      default_popup: 'popup.html'
    },
    icons: {
      "16": "icon/16.png",
      "32": "icon/32.png",
      "48": "icon/48.png",
      "96": "icon/96.png",
      "128": "icon/128.png"
    }
  },
  vite: () => ({
    resolve: {
      alias: {
        '@': resolve(__dirname, './'),
        '@/*': resolve(__dirname, './entrypoints/popup/*')
      }
    },
    build: {
      rollupOptions: {
        output: {
          assetFileNames: 'assets/[name]-[hash][extname]',
          chunkFileNames: 'chunks/[name]-[hash].js',
          entryFileNames: '[name].js'
        }
      }
    },
    base: ''
  }),
  // 设置开发服务器端口
  dev: {
    server: {
      port: 3002
    }
  }
});
