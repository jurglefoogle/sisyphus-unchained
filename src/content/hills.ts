/**
 * Each hill's cast (docs/hill-workshops-plan.md §3). Machines, sealed devices,
 * whispers and visitors join these entries as each hill's phase lands.
 */
export interface HillCast {
  /** The crew: the hill's level track, named for who does the work. */
  crew: string;
  crewQuip: string;
  steward: string;
  stewardQuip: string;
  /** What the steward's standing order does, in a phrase. */
  order: string;
}

export const HILLS: Record<string, HillCast> = {
  first_hill: {
    crew: 'Shades on Loan',
    crewQuip: 'Dead, bored, and technically on the clock.',
    steward: 'the Shade Superintendent',
    stewardQuip: 'The foreman, promoted. He has a clipboard now.',
    order: 'reinvests every Obol in the hill',
  },
  tartarus_rim: {
    crew: 'Titans on Work Release',
    crewQuip: 'Former rulers of the cosmos. Now paid in Cinders.',
    steward: 'the Erinyes',
    stewardQuip: 'Motivational consultants. Methods unregulated.',
    order: 'reinvests every Cinder in the rim',
  },
  leaking_heights: {
    crew: 'Naiads (Seasonal)',
    crewQuip: 'Spring nymphs, paid by the bucket.',
    steward: 'Danaus',
    stewardQuip: 'Management experience: fifty daughters, one plan.',
    order: 'reinvests every Dram in the heights',
  },
  bronze_pass: {
    crew: 'the Golden Maidens',
    crewQuip: 'Self-moving, gold-plated, unimpressed by you.',
    steward: 'Talos',
    stewardQuip: 'Three laps a day. Won\'t take the stairs.',
    order: 'reinvests every Ingot in the pass',
  },
  skyward_escarpment: {
    crew: 'the Pleiades, Night Shift',
    crewQuip: 'Your in-laws. They work nights.',
    steward: 'Atlas',
    stewardQuip: 'Holding the sky. Cannot shrug, contractually or physically.',
    order: 'reinvests all the Starlight, under protest',
  },
  olympian_approach: {
    crew: 'Petitioners, Minor Divine',
    crewQuip: 'River gods, wind gods, a god of one specific hill.',
    steward: 'the Moirai',
    stewardQuip: 'They already know how this ends. They\'re billing anyway.',
    order: 'reinvest the Ambrosia; they knew you would ask',
  },
};

export const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
