/**
 * Mythology archive (spec §03 "Mythology archive"). Each subject entry is a
 * short paraphrase of the ancient association, one sentence on our
 * adaptation, a source link, and a note where variants materially differ.
 * Reading it never grants a production advantage.
 */
export interface ArchiveSubject {
  id: string;
  title: string;
  /** Portrait art id (art/portrait_*.png) where one exists. */
  portrait?: string;
  body: string;
  adaptation: string;
  variants?: string;
  source: { label: string; url: string };
}

export const ARCHIVE_SUBJECTS: ArchiveSubject[] = [
  {
    id: 'sisyphus',
    title: 'Sisyphus',
    body:
      'In the Odyssey, Odysseus sees Sisyphus in the underworld straining with hands and feet to push a huge stone up a hill. Each time he nears the top, the weight turns it back and the stone rolls down to the plain, and he begins again.',
    adaptation: 'We keep the returning stone, and let him make use of the trip down.',
    variants: 'Later writers give different reasons for the punishment, most famously his tricks against Death.',
    source: { label: 'Homer, Odyssey 11.593 (Theoi)', url: 'https://www.theoi.com/Text/HomerOdyssey11.html' },
  },
  {
    id: 'thanatos',
    title: 'Thanatos',
    portrait: 'thanatos',
    body:
      'Thanatos is Death personified, twin brother of Hypnos, Sleep. In one tradition Sisyphus tricked and bound him, so that no one died until the gods set Death free. In another, Sisyphus talked his way back from the underworld and lived on for a time.',
    adaptation: 'Here Thanatos administers Begin Again, returning Sisyphus to the foot of the hill with what he has learned.',
    variants: 'Accounts differ on who freed Death and how Sisyphus returned to the living.',
    source: { label: 'Thanatos (Theoi)', url: 'https://www.theoi.com/Daimon/Thanatos.html' },
  },
  {
    id: 'zeus',
    title: 'Zeus',
    portrait: 'zeus',
    body:
      'Zeus is king of the Olympian gods and ruler of the sky. One tradition says Sisyphus told the river god Asopus that Zeus had carried off his daughter Aegina, and that Zeus sent Death to punish the informer, setting the whole story in motion.',
    adaptation: 'Here he issues decrees, and each one somehow expands the business.',
    source: { label: 'Apollodorus, Library 1.9.3 (Theoi)', url: 'https://www.theoi.com/Text/Apollodorus1.html' },
  },
  {
    id: 'hermes',
    title: 'Hermes',
    portrait: 'hermes',
    body:
      'Hermes is the herald and messenger of the gods, patron of travellers, merchants and thieves, and the guide who leads souls down to the underworld. Vase painters mark him with winged sandals, a traveller’s hat and a herald’s staff, always on an errand.',
    adaptation: 'Our Hermes runs a dispatch service and stamps every delivery docket.',
    source: { label: 'Hermes (Theoi)', url: 'https://www.theoi.com/Olympios/Hermes.html' },
  },
  {
    id: 'daedalus',
    title: 'Daedalus',
    portrait: 'daedalus',
    body:
      'Daedalus was the legendary Athenian craftsman and inventor. For King Minos of Crete he built the labyrinth that held the Minotaur. Imprisoned, he made wings of feathers and wax to escape with his son Icarus, who flew too near the sun.',
    adaptation: 'He is our engineer by adaptation; no ancient source puts him on a hill of stones.',
    variants: 'Do not confuse the bronze giant Talos with Daedalus’s nephew of the same name.',
    source: { label: 'Minotaur and the labyrinth (Theoi)', url: 'https://www.theoi.com/Ther/Minotauros.html' },
  },
  {
    id: 'ixion',
    title: 'Ixion',
    portrait: 'ixion',
    body:
      'Ixion, king of the Lapiths, murdered his father-in-law and was later purified and welcomed by Zeus, only to try to seduce Hera. Zeus deceived him with a cloud shaped like her, then bound him to a wheel that turns forever.',
    adaptation: 'Ixion Drive turns that endless motion into belt power. He remains bound.',
    variants: 'Sources place the wheel in the sky or in Tartarus, and some describe it as fiery.',
    source: { label: 'Apollodorus, Epitome 1.20 (Theoi)', url: 'https://www.theoi.com/Text/ApollodorusE.html' },
  },
  {
    id: 'danaids',
    title: 'The Danaids',
    portrait: 'danaids',
    body:
      'The Danaids were the fifty daughters of Danaus. Forced to marry their cousins, all but one killed their husbands on the wedding night. In the underworld they are punished by carrying water to fill a vessel that can never be filled.',
    adaptation: 'Our waterworks keeps the vessel empty and drives a paddle wheel on the escaping water.',
    variants: 'Hypermnestra spared her husband; retellings differ over the leaking jars and the vessel.',
    source: { label: 'The Danaids (Theoi)', url: 'https://www.theoi.com/Heroine/Danaides.html' },
  },
  {
    id: 'talos',
    title: 'Talos',
    portrait: 'talos',
    body:
      'Talos was a giant of bronze who guarded Crete, striding round the island three times a day and hurling stones at approaching ships. A single vein ran from his neck to his ankle, closed by a nail; when it was opened, his ichor drained away.',
    adaptation: 'Talos Heavy Labor moves the great lever. The ankle fitting stays sealed.',
    variants: 'Accounts differ on his maker, often Hephaestus, and on whether Medea or Poeas brought him down.',
    source: { label: 'Talos (Theoi)', url: 'https://www.theoi.com/Gigante/GiganteTalos.html' },
  },
  {
    id: 'hephaestus',
    title: 'Hephaestus',
    body:
      'Hephaestus is the god of fire, the forge and metalwork, the lame smith of Olympus. He made the armour of Achilles, golden attendants that moved by themselves, and, in several accounts, the bronze guardian Talos as a gift for Minos.',
    adaptation: 'He appears here through the Talos entry and has not yet submitted an invoice.',
    source: { label: 'Hephaestus (Theoi)', url: 'https://www.theoi.com/Olympios/Hephaistos.html' },
  },
  {
    id: 'ichor',
    title: 'Ichor',
    body:
      'Ichor is the ethereal fluid that runs in the veins of the gods instead of blood; Homer describes it flowing from the wounded Aphrodite. In the Talos story, the same vital fluid fills the bronze giant’s single vein, and losing it ends him.',
    adaptation: 'The Sealed Ichor Ampoule is a relic. The stopper stays in.',
    source: { label: 'Homer, Iliad 5 (Theoi)', url: 'https://www.theoi.com/Text/HomerIliad5.html' },
  },
  {
    id: 'atlas',
    title: 'Atlas',
    portrait: 'atlas',
    body:
      'Atlas is a Titan whom Zeus condemned, after the war between the Titans and the Olympians, to stand at the ends of the earth and hold up the wide sky on his head and tireless hands. He bears the heavens, not the Earth.',
    adaptation: 'Our support contract gives the route a frame. Atlas still bears the sky.',
    variants: 'The familiar globe on his shoulders comes from later art, where it is the celestial sphere.',
    source: { label: 'Hesiod, Theogony 507 (Theoi)', url: 'https://www.theoi.com/Text/HesiodTheogony.html' },
  },
  {
    id: 'vase_painting',
    title: 'Greek vase painting',
    body:
      'Athenian potters decorated vases in two main techniques. In black-figure, figures were painted in a slip that fired black, with details incised through to the clay. From about 530 BC red-figure reversed this: the ground was painted black and the figures left in clay.',
    adaptation: 'Our palette blends both: dark figures, clay grounds and incised line.',
    source: {
      label: 'Athenian Vase Painting: Black- and Red-Figure Techniques (The Met)',
      url: 'https://www.metmuseum.org/toah/hd/vase/hd_vase.htm',
    },
  },
];
