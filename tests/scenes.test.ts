import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ACTORS, SCENES, SCENE_FOR_STORY } from '../src/content/scenes';
import { en } from '../src/content/strings';

const manifest = JSON.parse(readFileSync('public/assets/pottery-v1/manifest.json', 'utf8')) as {
  assets: { id: string }[];
};
const art = new Set(manifest.assets.map((a) => a.id));

describe('cutscenes', () => {
  it('stages every scene from art that exists', () => {
    for (const actor of Object.values(ACTORS)) {
      if (actor.kind !== 'voice') expect(art.has(actor.art), actor.art).toBe(true);
    }
    for (const scene of SCENES) {
      for (const beat of scene.beats) {
        const ids = [beat.bg, beat.prop, ...Object.values(beat.pose ?? {})].filter((x): x is string => !!x);
        for (const id of ids) expect(art.has(id), `${scene.id}: ${id}`).toBe(true);
      }
    }
  });

  it('casts only known actors, and only speakers who are on stage', () => {
    for (const scene of SCENES) {
      expect(scene.beats[0].bg, scene.id).toBeTruthy();
      let cast: string[] = [];
      for (const beat of scene.beats) {
        cast = beat.cast ?? cast;
        for (const id of cast) expect(ACTORS[id], id).toBeTruthy();
        if (beat.who) expect(cast, `${scene.id}: ${beat.text}`).toContain(beat.who);
        for (const id of Object.keys(beat.pose ?? {})) expect(cast).toContain(id);
      }
    }
  });

  it('replaces only story beats that exist', () => {
    for (const [story, scene] of Object.entries(SCENE_FOR_STORY)) {
      expect(en[`story.${story}.god`], story).toBeTruthy();
      expect(SCENES.some((s) => s.id === scene), scene).toBe(true);
    }
  });

  it('keeps every line short enough for the scroll', () => {
    const long = SCENES.flatMap((s) => s.beats.map((b) => b.text)).filter((t) => t.length > 120);
    expect(long).toEqual([]);
  });
});
