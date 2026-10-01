/**
 * First-visit cards for each hill's machine, and the Guide entries they leave
 * behind. A card names the machine's one decision; the Guide keeps the longer
 * explanation. Both unlock on the tutorial flag `machine_<siteId>`.
 */
export interface MachineCard {
  siteId: string;
  machine: string;
  /** The one thing the player decides. */
  decision: string;
  /** What the machine does, in two or three sentences. */
  text: string;
  quip: string;
}

export const MACHINE_CARDS: MachineCard[] = [
  {
    siteId: 'first_hill',
    machine: 'The Counterweight',
    decision: 'Trim it until a climb takes about as long as a fall.',
    text: 'Each stone in the basket speeds the climb but brakes the fall. The best trim moves as the hill improves, so check it now and then. The Shade Superintendent keeps it trimmed once hired.',
    quip: 'Physics, but make it a chore for someone else.',
  },
  {
    siteId: 'tartarus_rim',
    machine: 'Ixion’s Wheel',
    decision: 'Vent near 80% heat. Past that the wheel overheats.',
    text: 'Every impact heats the wheel. Vent it and impacts pay more for several climbs, most of all at 80% heat. Past that it overheats, and a wheel left to blow at full heat pays a good deal less. Venting early gives a smaller eruption sooner. The Erinyes vent at a heat you set.',
    quip: 'It never stops turning, and neither does he.',
  },
  {
    siteId: 'leaking_heights',
    machine: 'The Danaids’ Jar',
    decision: 'Keep the jar just short of the brim.',
    text: 'Each impact pours water in, and only the leak pays. A fuller jar leaks harder, but water over the brim is spilled and pays nothing. Inflow rises every 25 crew levels: drill holes to keep up, patch them to run fuller. Danaus holds the level you set.',
    quip: 'It never fills. Management has stopped asking why.',
  },
  {
    siteId: 'bronze_pass',
    machine: 'The Foundry',
    decision: 'Set the split between selling and pouring, and pick the order of blueprints.',
    text: 'Part of every payout is poured as bronze into the current blueprint; the rest sells as Ingots. Poured pay still counts toward Defiance. Each finished blueprint changes this hill for the run. Until Talos is hired, the pour waits for your next pick.',
    quip: 'Casting is just shopping with extra steps.',
  },
  {
    siteId: 'skyward_escarpment',
    machine: 'The Orrery',
    decision: 'Mount constellations in the houses, and turn the sky when it helps.',
    text: 'The sky moves on one house every few climbs. A constellation works only while its house is overhead; empty houses are dark. Turn asks Atlas to skip to the next mounted house, then he rests for twelve climbs.',
    quip: 'Atlas would like to know who approved the rotation.',
  },
  {
    siteId: 'olympian_approach',
    machine: 'The Paperwork Mill',
    decision: 'Set how many clerks sit at their desks: let the backlog ripen, then keep pace.',
    text: 'Each summit files forms, clerks approve them, and only approved forms pay. A backlog earns late fees, up to the statute of limitations. Every hundred approvals, Zeus issues an Edict across the empire for five minutes. Every crew milestone anywhere adds 1% here (Due Process).',
    quip: 'The Moirai already know how this ends. They bill anyway.',
  },
];

export const machineCard = (siteId: string): MachineCard | undefined => MACHINE_CARDS.find((c) => c.siteId === siteId);
export const machineFlag = (siteId: string) => `machine_${siteId}`;
