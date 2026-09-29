import { describe, expect, it } from 'vitest';
import { again, ambient, ambientWorks, arrivals, barks, en, recapLines, thanatos } from '../src/content/strings';
import { catalog } from '../src/content/catalog';

const storyIds = Object.keys(en)
  .filter((k) => k.startsWith('story.') && k.endsWith('.god'))
  .map((k) => k.slice('story.'.length, -'.god'.length));

describe('dialogue', () => {
  it('keeps every caption line within 80 characters (spec §03)', () => {
    const pools = [ambient, ambientWorks, arrivals, barks];
    const long = pools.flatMap((p) => Object.values(p).flat()).filter((l) => l.length > 80);
    expect(long).toEqual([]);
  });

  it('gives every hill its ambient pool and arrival lines', () => {
    for (const site of catalog.sites) {
      expect(ambient[site.id]?.length).toBeGreaterThan(0);
      expect(arrivals[site.id]?.length).toBeGreaterThan(0);
    }
  });

  it('gives every story beat a reply and a comeback for repeats', () => {
    for (const id of storyIds) {
      expect(en[`story.${id}.sis`], id).toBeTruthy();
      expect(again[id]?.length, id).toBeGreaterThan(0);
    }
  });

  it('covers every work with machinery commentary', () => {
    for (const w of catalog.works) expect(ambientWorks[w.id]?.length, w.id).toBeGreaterThan(0);
    expect(ambientWorks.foreman.length).toBeGreaterThan(0);
  });

  it('has Thanatos lines for runs two to four and a pool after', () => {
    expect(thanatos.length).toBeGreaterThan(4);
    expect(recapLines.length).toBeGreaterThan(0);
  });

  it('keeps programmer and gamer jargon rare, and out of story beats', () => {
    const jargon = /while\(|\bgit\b|firmware|uptime|save file|respawn|speedrun|\bAFK\b|natural 1|patch notes|controller|level up|as a service|legacy code|bug report|\bQA\b/i;
    const beats = Object.entries(en).filter(([k]) => k.startsWith('story.'));
    expect(beats.filter(([, v]) => jargon.test(v)).map(([k]) => k)).toEqual([]);
    const pools = [ambient, ambientWorks, arrivals, barks, again].flatMap((p) => Object.entries(p));
    for (const [id, lines] of pools) expect(lines.filter((l) => jargon.test(l)).length, id).toBeLessThanOrEqual(1);
  });

  it('never repeats a line within a pool', () => {
    const pools = [ambient, ambientWorks, arrivals, barks, again].flatMap((p) => Object.values(p));
    for (const lines of [...pools, thanatos, recapLines]) expect(new Set(lines).size).toBe(lines.length);
  });
});
