export type GameNameStyle = "mixed" | "fun" | "competitive" | "basketball" | "chaos";

const adjectives = [
  "Clutch",
  "Rapid",
  "Wild",
  "Prime",
  "Elite",
  "Turbo",
  "Savage",
  "Electric",
  "Locked",
  "Frozen",
  "Hot",
  "Maximum",
  "Final",
  "Crunch",
  "Street",
  "Midnight",
  "Unreal",
  "Epic",
  "Bold",
  "Fearless",
  "Fire",
  "Flash",
  "Neon",
  "Golden",
  "Shadow",
  "Victory",
  "Rogue",
  "Skyline",
  "Velocity",
  "Relentless",
  "Iron",
  "Heavy",
  "Sharp",
  "Clean",
  "Ice",
  "Storm",
  "Thunder",
  "Rocket",
  "Supreme",
  "Alpha",
  "Next",
  "Full Court",
  "Half Court",
  "Deep Range",
  "Fastbreak",
  "High Stakes",
  "Last Shot",
  "Game Day",
  "Pressure",
  "Overtime",
] as const;

const basketballWords = [
  "Buckets",
  "Hoops",
  "Swish",
  "Splash",
  "Dimes",
  "Boards",
  "Rim",
  "Net",
  "Glass",
  "Handles",
  "Break",
  "Fastbreak",
  "Jumper",
  "Three",
  "Arc",
  "Paint",
  "Layup",
  "Fadeaway",
  "Crossover",
  "Shot",
  "Buzzer",
  "Backboard",
  "Bounce",
  "Tipoff",
  "Possession",
  "And-One",
  "Heat Check",
  "Poster",
  "Rebound",
  "Steal",
] as const;

const competitionWords = [
  "Clash",
  "Showdown",
  "Battle",
  "Rush",
  "Grind",
  "Challenge",
  "Quest",
  "Storm",
  "Attack",
  "Streak",
  "Series",
  "Match",
  "Mode",
  "Run",
  "League",
  "Trial",
  "Circuit",
  "Frenzy",
  "Gauntlet",
  "Race",
  "Faceoff",
  "Arena",
  "Cup",
  "Brawl",
  "Throwdown",
  "Takeover",
  "Pressure",
  "Finale",
  "Contest",
  "Derby",
] as const;

const bringaWords = [
  "Bingra",
  "Bang",
  "Boom",
  "Cookout",
  "Bucketfest",
  "Shotstorm",
  "Winwave",
  "Hoopla",
  "Ballblast",
  "Netfest",
  "Rimrush",
  "Swishfest",
  "Playstorm",
  "Scoreline",
  "Fireball",
  "Hype",
  "Showtime",
  "Runup",
  "Glowup",
] as const;

const funWords = [
  "Chaos",
  "Madness",
  "Vibes",
  "Party",
  "Fever",
  "Energy",
  "Mayhem",
  "Hustle",
  "Thunder",
  "Lightning",
  "Wave",
  "Pulse",
  "Buzz",
  "Freeze",
  "Flare",
  "Blaze",
  "Spark",
  "Noise",
  "Motion",
  "Juice",
] as const;

const templatesByStyle: Record<GameNameStyle, Array<(rng: () => number) => string>> = {
  mixed: [
    (rng) => `${pick(adjectives, rng)} ${pick(basketballWords, rng)}`,
    (rng) => `${pick(adjectives, rng)} ${pick(competitionWords, rng)}`,
    (rng) => `${pick(bringaWords, rng)} ${pick(competitionWords, rng)}`,
    (rng) => `${pick(basketballWords, rng)} ${pick(competitionWords, rng)}`,
    (rng) => `${pick(adjectives, rng)} ${pick(funWords, rng)}`,
    (rng) => `${pick(adjectives, rng)} ${pick(bringaWords, rng)}`,
  ],
  fun: [
    (rng) => `${pick(bringaWords, rng)} ${pick(funWords, rng)}`,
    (rng) => `${pick(funWords, rng)} ${pick(basketballWords, rng)}`,
    (rng) => `${pick(adjectives, rng)} ${pick(bringaWords, rng)}`,
    (rng) => `${pick(bringaWords, rng)} ${pick(competitionWords, rng)}`,
  ],
  competitive: [
    (rng) => `${pick(adjectives, rng)} ${pick(competitionWords, rng)}`,
    (rng) => `${pick(basketballWords, rng)} ${pick(competitionWords, rng)}`,
    (rng) => `${pick(adjectives, rng)} ${pick(basketballWords, rng)}`,
  ],
  basketball: [
    (rng) => `${pick(adjectives, rng)} ${pick(basketballWords, rng)}`,
    (rng) => `${pick(basketballWords, rng)} ${pick(competitionWords, rng)}`,
    (rng) => `${pick(adjectives, rng)} ${pick(competitionWords, rng)}`,
  ],
  chaos: [
    (rng) => `${pick(funWords, rng)} ${pick(competitionWords, rng)}`,
    (rng) => `${pick(adjectives, rng)} ${pick(funWords, rng)}`,
    (rng) => `${pick(bringaWords, rng)} ${pick(funWords, rng)}`,
    (rng) => `${pick(adjectives, rng)} ${pick(competitionWords, rng)}`,
  ],
};

export interface GenerateGameNameOptions {
  style?: GameNameStyle;
  usedNames?: Iterable<string>;
  maxAttempts?: number;
  fallbackPrefix?: string;
}

export function generateGameName(options: GenerateGameNameOptions = {}): string {
  const {
    style = "mixed",
    usedNames,
    maxAttempts = 30,
    fallbackPrefix = "Game",
  } = options;

  const used = new Set(
    Array.from(usedNames ?? []).map((name) => normalizeName(name)),
  );

  for (let i = 0; i < maxAttempts; i++) {
    const template = pick(templatesByStyle[style], Math.random);
    const candidate = cleanName(template(Math.random));

    if (!used.has(normalizeName(candidate))) {
      return candidate;
    }
  }

  return `${fallbackPrefix} ${randomNumber(100, 999)}`;
}

export function generateGameNames(
  count: number,
  options: Omit<GenerateGameNameOptions, "usedNames"> & {
    usedNames?: Iterable<string>;
    unique?: boolean;
  } = {},
): string[] {
  const { unique = true, usedNames, ...rest } = options;
  const results: string[] = [];
  const seen = new Set(Array.from(usedNames ?? []).map((n) => normalizeName(n)));

  for (let i = 0; i < count; i++) {
    const name = generateGameName({
      ...rest,
      usedNames: unique ? [...seen] : usedNames,
    });

    results.push(name);

    if (unique) {
      seen.add(normalizeName(name));
    }
  }

  return results;
}

export function getRandomPrefillName(currentName?: string): string {
  return generateGameName({
    style: "mixed",
    usedNames: currentName ? [currentName] : undefined,
  });
}

function pick<T>(items: readonly T[], rng: () => number): T {
  return items[Math.floor(rng() * items.length)];
}

function randomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function cleanName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}