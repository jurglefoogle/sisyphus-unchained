import { describe, expect, it } from 'vitest';
import { again, ambient, ambientWorks, arrivals, barks, en, eternity, exchanges, recapLines, shades, thanatos } from '../src/content/strings';
import { catalog } from '../src/content/catalog';

const storyIds = Object.keys(en)
  .filter((k) => k.startsWith('story.') && k.endsWith('.god'))
  .map((k) => k.slice('story.'.length, -'.god'.length));

describe('dialogue', () => {
  it('keeps every caption line within 80 characters (spec §03)', () => {
    const pools = [ambient, ambientWorks, arrivals, barks];
    const long = pools.flatMap((p) => Object.values(p).flat()).filter((l) => l.length > 80);
    expect(long).toEqual([]);
    expect([...shades, ...eternity].filter((l) => l.length > 80)).toEqual([]);
    expect(exchanges.flatMap((x) => x.lines.map(([, l]) => l)).filter((l) => l.length > 80)).toEqual([]);
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
    pools.push(['shades', shades], ['eternity', eternity], ['exchanges', exchanges.flatMap((x) => x.lines.map(([, l]) => l))]);
    for (const [id, lines] of pools) expect(lines.filter((l) => jargon.test(l)).length, id).toBeLessThanOrEqual(1);
  });

  it('never repeats a line within a pool', () => {
    const pools = [ambient, ambientWorks, arrivals, barks, again].flatMap((p) => Object.values(p));
    for (const lines of [...pools, shades, eternity, thanatos, recapLines]) expect(new Set(lines).size).toBe(lines.length);
  });

  it('gives the dead exchanges: unique, two lines or more, some before the Foreman', () => {
    expect(new Set(exchanges.map((x) => x.id)).size).toBe(exchanges.length);
    for (const x of exchanges) expect(x.lines.length, x.id).toBeGreaterThanOrEqual(2);
    expect(exchanges.filter((x) => !x.crew).length).toBeGreaterThanOrEqual(6);
    expect(exchanges.filter((x) => x.crew).length).toBeGreaterThanOrEqual(6);
    // Only the Foreman's crew includes the foreman.
    for (const x of exchanges.filter((e) => !e.crew)) expect(x.lines.some(([who]) => who === 'The foreman'), x.id).toBe(false);
  });
});
