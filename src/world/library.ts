/**
 * URLs into the delivered pottery-v1 library (public/assets/pottery-v1, see
 * docs/art-direction/asset-library-handoff.md) for the DOM interface and
 * audio. The world renderer reads its art through the delivery contract in
 * assets.ts instead.
 */
const ROOT = `${import.meta.env.BASE_URL}assets/pottery-v1`;

export const artUrl = (id: string): string => `${ROOT}/art/${id}.png`;
export const iconUrl = (id: string): string => `${ROOT}/icons/${id}.svg`;
export const audioUrl = (id: string): string => `${ROOT}/audio/${id}.wav`;
/** Any image asset by id: raster art (works, portraits) or a vector symbol. */
export const imageUrl = (id: string): string => (/^(work|portrait|stone|scene)_/.test(id) ? artUrl(id) : iconUrl(id));

const MUSIC: Record<string, string> = {
  first_hill: 'music_early_labor',
  tartarus_rim: 'music_underworld_enterprise',
  leaking_heights: 'music_underworld_enterprise',
  bronze_pass: 'music_underworld_enterprise',
  skyward_escarpment: 'music_approach_to_olympus',
  olympian_approach: 'music_approach_to_olympus',
};
export const siteMusic = (siteId: string): string => MUSIC[siteId] ?? MUSIC.first_hill;

const METAL_STONES = new Set(['bronze_pass', 'skyward_escarpment', 'olympian_approach']);
export const siteImpact = (siteId: string): string => (METAL_STONES.has(siteId) ? 'sfx_impact_bronze' : 'sfx_impact_pottery');

/** Who delivers each story's decree; Zeus unless the chapter's figure speaks. */
const STORY_PORTRAIT: Record<string, string> = {
  daedalus_purchase: 'daedalus',
  ixion_purchase: 'ixion',
  leaking_offer: 'danaids',
  talos_purchase: 'talos',
  bronze_offer: 'talos',
  skyward_offer: 'atlas',
  first_prestige: 'thanatos',
};
export const storyPortrait = (storyId: string): string => artUrl(`portrait_${STORY_PORTRAIT[storyId] ?? 'zeus'}`);
export const storyPortraitName = (storyId: string): string => {
  const who = STORY_PORTRAIT[storyId] ?? 'zeus';
  return who === 'danaids' ? 'The Danaids' : who[0].toUpperCase() + who.slice(1);
};
