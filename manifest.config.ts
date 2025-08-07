import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

export default defineManifest({
  manifest_version: 3,
  name: pkg.name,
  version: pkg.version,
  icons: {
    16: 'public/logo-16.png',
    32: 'public/logo-32.png',
    48: 'public/logo-rounded.png',
    128: 'public/logo-128.png',
  },
  background: {
    service_worker: 'src/background/service-worker.ts',
  },
  action: {
    default_icon: {
      16: 'public/logo-16.png',
      32: 'public/logo-32.png',
      48: 'public/logo-rounded.png',
      128: 'public/logo-128.png',
    },
    default_popup: 'src/popup/index.html',
    default_title: 'Open CookieJar',
  },
  permissions: [
    'sidePanel',
    'contentSettings',
    'storage',
    'cookies',
    'alarms',
  ],
  content_scripts: [{
    js: ['src/content/main.tsx'],
    matches: ['https://*/*'],
  }],
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
})
