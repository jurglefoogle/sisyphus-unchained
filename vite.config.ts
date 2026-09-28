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
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
