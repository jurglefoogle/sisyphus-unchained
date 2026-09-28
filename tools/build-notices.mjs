// Regenerates THIRD_PARTY_NOTICES.md from the installed runtime dependencies
// (spec §06: attribution for dependencies, fonts, art and audio).
// Run with `npm run notices` after changing dependencies.
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Build-time packages that are compiled into the bundle, beyond the runtime tree. */
const BUNDLED = ['svelte'];
/** The desktop shell ships Electron; its Chromium notices travel as LICENSES.chromium.html. */
const SHELL = ['electron'];

const runtime = execSync('npm ls --omit=dev --all --parseable', { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter((line) => line.includes('node_modules'))
  .map((line) => line.slice(line.lastIndexOf('node_modules') + 'node_modules'.length + 1).replace(/\\/g, '/'));
const names = [...new Set([...runtime, ...BUNDLED, ...SHELL])]
  .filter((n) => !n.startsWith('@types/') && n !== '@webgpu/types')
  .sort();

function licenseText(dir) {
  const file = readdirSync(dir).find((f) => /^licen[cs]e(\.md|\.txt)?$/i.test(f));
  return file ? readFileSync(join(dir, file), 'utf8').trim() : null;
}

const sections = names.map((name) => {
  const dir = join('node_modules', name);
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const text = existsSync(dir) ? licenseText(dir) : null;
  const where = SHELL.includes(name) ? 'desktop shell' : BUNDLED.includes(name) ? 'compiled into the game' : 'runtime';
  return [
    `### ${pkg.name} ${pkg.version}`,
    '',
    `License: ${pkg.license ?? 'see below'} · ${where}${pkg.homepage ? ` · ${pkg.homepage}` : ''}`,
    '',
    text ? '```text\n' + text + '\n```' : '_No license file in the package; see its homepage._',
  ].join('\n');
});

const out = `# Third-party notices

Sisyphus: Unchained includes the following work by others. Thank you.

## Fonts

Cormorant Garamond (display) and EB Garamond (body) are bundled with the game
so it starts without a network connection. Both are licensed under the SIL
Open Font License 1.1; the full license text for each is reproduced below with
its package. The fonts are packaged by the Fontsource project.

## Art and audio

The pottery-v1 art and audio library was made for this project. Images were
produced with an image-generation tool from prompts recorded in
\`docs/art-direction/asset-generation-v1.json\`; vector art and the synthesized
audio come from \`tools/assets/build_library.py\`. The library contains no
downloaded stock assets, sampled recordings or copied compositions. It is a
first-pass library and not yet release-approved.

## Software

${sections.join('\n\n')}
`;

writeFileSync('THIRD_PARTY_NOTICES.md', out);
console.log(`THIRD_PARTY_NOTICES.md: ${names.length} packages`);
