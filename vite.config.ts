import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

/** Ship the third-party notices with every build (spec §06). */
function notices(): Plugin {
  return {
    name: 'third-party-notices',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'THIRD_PARTY_NOTICES.md', source: readFileSync('THIRD_PARTY_NOTICES.md', 'utf8') });
    },
  };
}

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

export default defineConfig({
  plugins: [svelte(), notices()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  build: {
    rollupOptions: {
      output: {
        // The renderer is most of the weight and changes least: its own file caches across releases.
        manualChunks(id: string) {
          if (id.includes('node_modules/pixi.js') || id.includes('node_modules/@pixi')) return 'pixi';
          if (id.includes('node_modules')) return 'vendor';
        },
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
