/**
 * Cutscenes: short, skippable scenes staged from the existing art (scene
 * paintings, portraits, figures and props). Each plays once, then waits in the
 * Archive for a rewatch. The simulation keeps running underneath (spec §01).
 *
 * A scene is a list of beats. A beat names who speaks; `bg`, `cast` and `prop`
 * carry over from the previous beat until a beat changes them. Voice and
 * accuracy rules are the ones in strings.ts.
 */

export interface SceneActor {
  name: string;
  /**
   * Art id: a portrait bust looms from the sky; a figure stands on the ground.
   * A voice has no art: it speaks from offstage until a portrait exists.
   */
  art: string;
  kind: 'bust' | 'figure' | 'voice';
}

export type SceneFx = 'bolt' | 'seal' | 'thud';

export interface Beat {
  /** An actor id, or omitted for the narrator. */
  who?: string;
  text: string;
  /** Scene painting id. */
  bg?: string;
  /** Actor ids on stage: the first stands left, any others on the right. */
  cast?: string[];
  /** A prop (art id), or null to clear it. */
  prop?: string | null;
  /** Where the prop sits: between the speakers, or at Sisyphus's hands. */
  propAt?: 'center' | 'hands';
  /** Swap a figure's art for this beat (e.g. rest to push). */
  pose?: Record<string, string>;
  fx?: SceneFx;
}

export interface Scene {
  id: string;
  title: string;
  /** When it plays, for the Archive. */
  when: string;
  beats: Beat[];
}

export const ACTORS: Record<string, SceneActor> = {
  sisyphus: { name: 'Sisyphus', art: 'sisyphus_rest', kind: 'figure' },
  zeus: { name: 'Zeus', art: 'portrait_zeus', kind: 'bust' },
  thanatos: { name: 'Thanatos', art: 'portrait_thanatos', kind: 'bust' },
  hermes: { name: 'Hermes', art: 'portrait_hermes', kind: 'bust' },
  danaids: { name: 'The Danaids', art: 'portrait_danaids', kind: 'bust' },
  talos: { name: 'Talos', art: 'portrait_talos', kind: 'bust' },
  daedalus: { name: 'Daedalus', art: 'portrait_daedalus', kind: 'bust' },
  ixion: { name: 'Ixion', art: 'portrait_ixion', kind: 'bust' },
  atlas: { name: 'Atlas', art: 'portrait_atlas', kind: 'bust' },
  hades: { name: 'Hades', art: '', kind: 'voice' },
};

/** In story order, as the Archive lists them. */
export const SCENES: Scene[] = [
  {
    id: 'sentence',
    title: 'The Sentence',
    when: 'A new game',
    beats: [
      { bg: 'scene_olympian_approach', cast: [], text: 'Olympus. The court of the gods is in session. The defendant is late.' },
      { cast: ['sisyphus', 'zeus'], who: 'zeus', fx: 'bolt', text: 'SISYPHUS, KING OF CORINTH. You stand before the court of Olympus.' },
      { who: 'sisyphus', text: 'Stand is generous. Hermes dragged me up four thousand steps.' },
      { who: 'zeus', text: 'Charge the first. You told the river god Asopus where I had taken his daughter.' },
      { who: 'sisyphus', text: 'He gave Corinth a fresh spring for it. Fair trade. You never gave me anything.' },
      { who: 'zeus', text: 'Charge the second. When I sent Death to collect you, you put him in chains.' },
      { cast: ['sisyphus', 'thanatos'], who: 'thanatos', text: 'For weeks. Nobody died. Not even in battle. Ares had to come and get me.' },
      { who: 'sisyphus', text: 'Best weeks the world ever had. You’re welcome, everyone.' },
      { cast: ['sisyphus', 'zeus'], who: 'zeus', text: 'Charge the third. You talked Persephone into sending you back to the living.' },
      { who: 'sisyphus', text: 'To scold my wife for skipping my funeral rites. Which I told her to skip. It was a plan.' },
      { who: 'zeus', text: 'And then you did not come back.' },
      { who: 'sisyphus', text: 'The weather was lovely.' },
      { who: 'zeus', fx: 'bolt', prop: 'stone_decree', text: 'ENOUGH. Your sentence: roll this stone to the top of a hill.' },
      { who: 'sisyphus', text: 'And then?' },
      { who: 'zeus', text: 'Then it rolls back down. And you begin again. Forever.' },
      { who: 'sisyphus', text: 'No end date, no pay, no promotion track. Do I at least get a title?' },
      { who: 'zeus', prop: null, text: '…HERMES.' },
      { cast: ['sisyphus', 'hermes'], who: 'hermes', text: 'On it. Mind the steps, your majesty. All of them.' },
      { bg: 'scene_first_hill', cast: ['sisyphus'], prop: 'stone_limestone', propAt: 'hands', text: 'The First Hill. Day one of forever.' },
      { who: 'sisyphus', text: 'A stone, a hill and eternity. How hard can it be?' },
    ],
  },
  {
    id: 'tartarus',
    title: 'The Larger Stone',
    when: 'The Tartarus Rim decree',
    beats: [
      { bg: 'scene_first_hill', cast: [], text: 'The First Hill. Business is good. Olympus has noticed.' },
      { cast: ['sisyphus', 'zeus'], who: 'zeus', fx: 'bolt', text: 'SISYPHUS. Your stone rolls itself. Your dead push for you. This is not suffering.' },
      { who: 'sisyphus', text: 'It’s delegation. You do it with lightning. I do it with shades.' },
      { who: 'zeus', prop: 'stone_basalt', text: 'Your stone is insufficiently burdensome. Tartarus has a larger one.' },
      { who: 'sisyphus', text: 'You’re punishing competence with a promotion. Olympus has invented middle management.' },
      { bg: 'scene_tartarus_rim', cast: ['sisyphus', 'hades'], prop: null, text: 'The Tartarus Rim. The ground is warm. The dark is listening.' },
      { who: 'hades', text: 'So. The mortal who put my Death in chains.' },
      { who: 'sisyphus', text: 'Lord Hades. I’d bow, but I can’t tell which way you are.' },
      { who: 'hades', text: 'Down. I am always down. Zeus sends you to my pit. Nobody asked me.' },
      { who: 'sisyphus', text: 'Then we’re both under a contract neither of us signed. Let me make it worth your while.' },
      { who: 'hades', text: 'Explain.' },
      { who: 'sisyphus', text: 'The basalt rolls down into your pit. Something has to catch it. I build that, and the heat is free.' },
      { who: 'hades', text: 'And my share?' },
      { who: 'sisyphus', text: 'A cut of everything that falls. Down is your department, after all.' },
      { who: 'hades', text: '…Build quietly. Persephone is home this season.' },
      { cast: ['sisyphus'], pose: { sisyphus: 'sisyphus_push' }, prop: 'stone_basalt', propAt: 'hands', fx: 'thud', text: 'A bigger stone. A silent partner. The Tartarus Rim opens for business.' },
    ],
  },
  {
    id: 'daedalus',
    title: 'The Workshop',
    when: 'Buying the Daedalus Workshop',
    beats: [
      { bg: 'scene_tartarus_rim', cast: [], text: 'The Tartarus Rim. A new shade has arrived, carrying a toolbox and a grudge against King Minos.' },
      { cast: ['sisyphus', 'daedalus'], who: 'daedalus', text: 'Daedalus of Athens. I built the Labyrinth. I built the wings. I have read your plans.' },
      { who: 'sisyphus', text: 'And?' },
      { who: 'daedalus', text: 'Your pulley is simpler than the Labyrinth. Mostly. Don’t go into the gearbox.' },
      { who: 'sisyphus', text: 'What’s in the gearbox?' },
      { who: 'daedalus', text: 'Nothing. A little something. It’s fine. Don’t go in.' },
      { who: 'sisyphus', text: 'I hear you taught your son to fly.' },
      { who: 'daedalus', text: 'I told him: not too high, not too low. He was a teenager. He heard “high”.' },
      { who: 'sisyphus', text: 'Then you’ll like this job. Everything here is supposed to go down.' },
      { who: 'daedalus', prop: 'work_daedalus', text: 'Gears for the drum, a rope that doubles back, and a lever for the lever. Sign here.' },
      { who: 'sisyphus', text: 'Another contract. I’m starting a collection.' },
      { who: 'daedalus', text: 'One condition. If Hephaestus ever asks who built the gearbox, it was you.' },
      { who: 'sisyphus', text: 'Naturally.' },
      { cast: ['sisyphus'], text: 'The Daedalus Workshop opens. Nobody goes into the gearbox.' },
    ],
  },
  {
    id: 'ixion',
    title: 'The Burning Wheel',
    when: 'Buying the Ixion Drive',
    beats: [
      { bg: 'scene_tartarus_rim', cast: [], text: 'Deeper in Tartarus, something is turning. It has been turning for a very long time.' },
      { cast: ['sisyphus', 'ixion'], who: 'ixion', text: 'Strapped to a burning wheel for all eternity. Want me to plug it into something?' },
      { who: 'sisyphus', text: 'Ixion. I’ve heard. You made eyes at Hera.' },
      { who: 'ixion', text: 'Zeus made a cloud in her shape to test me. I fell for a cloud. It happens.' },
      { who: 'sisyphus', text: 'It happens to you.' },
      { who: 'ixion', text: 'Then he bound me to this. It never stops. It never cools. It never goes anywhere.' },
      { who: 'sisyphus', text: 'Never stops? You’re describing my ideal employee.' },
      { who: 'ixion', text: 'I am describing torment.' },
      { who: 'sisyphus', prop: 'work_ixion', text: 'Same thing, better lighting. A belt from your rim to my drum. You keep spinning; the spin goes somewhere.' },
      { who: 'ixion', text: 'And I go free?' },
      { who: 'sisyphus', text: 'No. Zeus would notice. But you’d be the most useful man in Tartarus.' },
      { who: 'ixion', text: '…Useful. Nobody has called me that since the cloud.' },
      { cast: ['sisyphus'], prop: null, text: 'The Ixion Drive turns. It has not missed a revolution since.' },
    ],
  },
  {
    id: 'lethe',
    title: 'The Waters of Lethe',
    when: 'The first Begin Again',
    beats: [
      { bg: 'scene_tartarus_rim', cast: [], text: 'Tartarus. The machines have gone quiet. Someone has come to collect.' },
      { cast: ['sisyphus', 'thanatos'], who: 'thanatos', text: 'Sisyphus.' },
      { who: 'sisyphus', text: 'Thanatos! You look well. Rested. Noticeably unchained.' },
      { who: 'thanatos', text: 'Hades can hear your flywheels from his throne room. He asks why a punishment has a payroll.' },
      { who: 'sisyphus', text: 'Because it works. Hermes has the numbers. Most of them.' },
      { who: 'thanatos', text: 'Your works stay here. Your hills stay here. You go back to the bottom.' },
      { who: 'sisyphus', text: 'Let me guess. First I drink from the Lethe and forget all of it.' },
      { who: 'thanatos', text: 'That is the custom.' },
      { who: 'sisyphus', text: 'Hard pass. I’ve read the label. I’m keeping what I learned.' },
      { who: 'thanatos', text: '…Fine. Remember, then. It will only make the climb longer.' },
      { who: 'sisyphus', text: 'No, it makes it shorter. That’s the whole trick.' },
      { bg: 'scene_first_hill', cast: ['sisyphus'], pose: { sisyphus: 'sisyphus_push' }, prop: 'stone_limestone', propAt: 'hands', text: 'Sisyphus begins again. This time, he remembers.' },
    ],
  },
  {
    id: 'leaking',
    title: 'The Leaking Heights',
    when: 'The Leaking Heights decree',
    beats: [
      { bg: 'scene_leaking_heights', cast: [], text: 'The Leaking Heights. Fifty sisters, one jar, and a sound like a very patient drain.' },
      { cast: ['sisyphus', 'danaids'], who: 'danaids', text: 'We are the Danaids. This jar will never be full. We have checked. For millennia.' },
      { who: 'sisyphus', text: 'Sisyphus. Stone, hill, forever. I think we’re in the same support group.' },
      { who: 'danaids', text: 'We were sentenced for our wedding night. We do not discuss the wedding night.' },
      { who: 'sisyphus', text: 'Understood. Nobody here discusses the wedding night.' },
      { who: 'danaids', text: 'The water pours in. The water pours out. The jar stays empty. Forever.' },
      { who: 'sisyphus', text: 'So the water never stops moving. Downhill. Past my hill. Hm.' },
      { who: 'danaids', text: 'He is doing sums. Sister, he is doing sums at us.' },
      { who: 'sisyphus', text: 'Keep pouring. The jar stays empty, I promise. I just want a wheel under the leak.' },
      { who: 'danaids', text: 'It will not fill?' },
      { who: 'sisyphus', prop: 'stone_marble', propAt: 'hands', text: 'Never. That’s the beauty of it. Your curse is my running water.' },
    ],
  },
  {
    id: 'bronze',
    title: 'The Bronze Pass',
    when: 'The Bronze Pass decree',
    beats: [
      { bg: 'scene_bronze_pass', cast: [], fx: 'thud', text: 'The Bronze Pass. The ground shakes on a schedule.' },
      { cast: ['sisyphus', 'talos'], who: 'talos', fx: 'thud', text: 'HALT. TALOS GUARDS THIS PASS. TALOS WALKS CRETE THREE TIMES A DAY.' },
      { who: 'sisyphus', text: 'This isn’t Crete.' },
      { who: 'talos', text: 'HEPHAESTUS SAYS: WALK. TALOS WALKS. TALOS HAS WALKED OFF THE MAP.' },
      { who: 'sisyphus', text: 'Happens to the best of us. I once walked out of the underworld.' },
      { who: 'talos', text: 'MORTAL STRENGTH IS BELOW SPEC FOR THIS PASS. THE STONE IS BRONZE.' },
      { who: 'sisyphus', prop: 'stone_bronze', propAt: 'hands', text: 'So I see. Heavy. Shiny. Very you. Do you ever get tired?' },
      { who: 'talos', text: 'TALOS DOES NOT KNOW TIRED. TALOS KNOWS WALKING, GUARDING AND ONE VEIN.' },
      { who: 'sisyphus', text: 'Tireless, bronze and already doing laps. You’re not an obstacle. You’re staff.' },
      { who: 'talos', text: 'TALOS WILL CONSIDER THIS. TALOS WILL WALK WHILE CONSIDERING.' },
      { cast: ['sisyphus'], text: 'Hephaestus has not been informed. Hephaestus will be informed.' },
    ],
  },
  {
    id: 'skyward',
    title: 'The Skyward Escarpment',
    when: 'The Skyward Escarpment decree',
    beats: [
      { bg: 'scene_skyward_escarpment', cast: [], text: 'The Skyward Escarpment, where the hill runs out and the sky begins. Someone is holding it.' },
      { cast: ['sisyphus', 'atlas'], who: 'atlas', text: 'I have held up the sky since the Titans lost. Your little rock is adorable.' },
      { who: 'sisyphus', text: 'Respect. Also, every statue shows you holding a globe. Want me to sue somebody?' },
      { who: 'atlas', text: 'The heavens. I hold the heavens. The globe was a sculptor’s idea. I hate the globe.' },
      { who: 'sisyphus', text: 'Noted. Do you ever put it down?' },
      { who: 'atlas', text: 'Once. Heracles held it for an afternoon while I fetched apples. He tricked me into taking it back.' },
      { who: 'sisyphus', text: 'A trick. That’s the problem. You needed a contract.' },
      { who: 'atlas', text: 'A what?' },
      { who: 'sisyphus', prop: 'stone_star', propAt: 'hands', text: 'Scaffold, bracing, fair rate. You keep the sky up. The frame takes some of the strain.' },
      { who: 'atlas', text: 'And the sky stays exactly where it is?' },
      { who: 'sisyphus', text: 'Exactly where it is. I’m ambitious, not suicidal.' },
    ],
  },
  {
    id: 'olympus',
    title: 'The Personal Touch',
    when: 'The Olympian Approach decree',
    beats: [
      { bg: 'scene_olympian_approach', cast: [], text: 'The Olympian Approach. Marble steps, gold leaf, and a stone with a seal on it.' },
      { cast: ['sisyphus', 'zeus'], who: 'zeus', fx: 'bolt', text: 'Enough. Your punishment will now be administered by Olympus. By me. Personally.' },
      { who: 'sisyphus', text: 'The king of the gods doing inspections himself. That’s how you know it’s going badly.' },
      { who: 'zeus', prop: 'stone_decree', text: 'This stone bears my seal. It is the heaviest thing in creation, after my patience.' },
      { who: 'sisyphus', text: 'Your patience broke in the first week. I was there.' },
      { who: 'zeus', text: 'Hermes says you pay the shades. Hera says you pay them better than I pay Hermes.' },
      { cast: ['sisyphus', 'hermes'], who: 'hermes', text: 'Since it’s come up, I would like to discuss that.' },
      { cast: ['sisyphus', 'zeus'], who: 'zeus', fx: 'bolt', text: 'NOT NOW.' },
      { who: 'sisyphus', text: 'Five hills, a Titan, a bronze giant and fifty sisters. You’re not stopping me. You’re auditing me.' },
      { who: 'zeus', text: 'Then I am the audit. Every step of this slope is watched.' },
      { who: 'sisyphus', text: 'Good. I’ve always wanted a witness.' },
      { cast: ['sisyphus'], pose: { sisyphus: 'sisyphus_push' }, prop: 'stone_decree', propAt: 'hands', fx: 'thud', text: 'The last hill. The heaviest stone. The most attentive audience.' },
    ],
  },
  {
    id: 'charter',
    title: 'The Eternal Labor Charter',
    when: 'Buying the Charter',
    beats: [
      { bg: 'scene_olympian_approach', cast: [], text: 'Olympus. The gods are in emergency session. The agenda has one item.' },
      { cast: ['sisyphus', 'zeus'], who: 'zeus', text: 'Sisyphus. Six hills. Seven works. A flywheel in Tartarus and a Titan on retainer.' },
      { who: 'sisyphus', text: 'Don’t forget the Danaids. They’re very proud of the leak.' },
      { who: 'zeus', text: 'Hera wants you stopped. Hades wants a cut. Hephaestus wants to know who built the gearbox.' },
      { who: 'sisyphus', text: 'Daedalus. Tell him it was Daedalus. He’ll love that.' },
      { who: 'zeus', text: 'I threw lightning at your pulleys. Now they glow.' },
      { who: 'sisyphus', text: 'Brighter shifts. Thank you for your contribution.' },
      { who: 'zeus', text: 'So Olympus will do what Olympus does when it cannot win.' },
      { who: 'sisyphus', text: 'Smite me?' },
      { who: 'zeus', fx: 'bolt', text: 'Hire you.' },
      { cast: ['sisyphus', 'hermes'], who: 'hermes', prop: 'work_charter', text: 'The Eternal Labor Charter. Sign here, here, and under the thunderbolt.' },
      { who: 'sisyphus', text: '“The contractor shall administer its own punishment, in perpetuity, at a fair rate.” Who wrote fair rate?' },
      { who: 'hermes', text: 'I did. God of merchants. Also of thieves. Read the small print.' },
      { who: 'sisyphus', fx: 'seal', text: 'Signed. On one condition.' },
      { cast: ['sisyphus', 'zeus'], who: 'zeus', prop: null, text: '…What.' },
      { who: 'sisyphus', text: 'I still push the stone sometimes. Keeps me humble.' },
      { who: 'zeus', text: 'You are the worst mortal I have ever met.' },
      { who: 'sisyphus', text: 'Craftiest. Homer’s word. Look it up in a few centuries.' },
      { bg: 'scene_first_hill', cast: ['sisyphus'], pose: { sisyphus: 'sisyphus_push' }, prop: 'stone_limestone', propAt: 'hands', fx: 'thud', text: 'The stone still rolls. Sisyphus is still, technically, participating.' },
      { cast: [], prop: null, text: 'One must imagine Sisyphus invoicing.' },
    ],
  },
];

export const sceneById = (id: string): Scene | undefined => SCENES.find((s) => s.id === id);

/** The story beat each scene replaces on first viewing. */
export const SCENE_FOR_STORY: Record<string, string> = {
  first_prestige: 'lethe',
  charter_purchase: 'charter',
  tartarus_offer: 'tartarus',
  daedalus_purchase: 'daedalus',
  ixion_purchase: 'ixion',
  leaking_offer: 'leaking',
  bronze_offer: 'bronze',
  skyward_offer: 'skyward',
  olympus_offer: 'olympus',
};

/** The tutorial flag that records a scene as watched. */
export const sceneSeenId = (id: string): string => `scene_${id}`;
