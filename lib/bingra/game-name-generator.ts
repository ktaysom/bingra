const ADJECTIVES = [
  "Clutch",
  "Rapid",
  "Savage",
  "Prime",
  "Elite",
  "Turbo",
  "Wild",
  "Electric",
  "Chaos",
  "Pressure",
  "Bounce",
  "Deep",
  "Pure",
  "Locked",
  "Final",
  "Crunch",
  "Overtime",
  "Street",
  "Midnight",
  "Fastbreak",
  "Full Court",
  "Half Court",
  "High Stakes",
  "Cold Blooded",
  "Heat Check",
  "Next Level",
  "Maximum",
  "Zero Chill",
  "All In",
  "Game Day",
  "Bucket",
  "Swish",
  "Net",
  "Rim",
  "Backboard",
  "Jump Ball",
  "Crossover",
  "Baseline",
  "Transition",
  "Playoff",
  "Underdog",
  "Champion",
  "Victory",
  "Battle",
  "Arena",
  "Hustle",
  "Relentless",
  "Skyline",
  "Shadow",
  "Concrete",
  "Golden",
  "Fierce",
  "Untamed",
  "Charged",
  "Fearless",
  "Dynamic",
  "Explosive",
  "Unreal",
  "Supreme",
  "Flash",
  "Frenzy",
  "Thunder",
  "Velocity",
  "Rally",
  "Momentum",
  "Drive",
  "Launch",
  "Snap",
  "Rise",
  "Storm",
  "Fire",
  "Ice",
  "Blaze",
  "Rush",
  "Phantom",
  "Alpha",
  "Top Seed",
  "Sudden Death",
  "Last Shot",
  "Triple Threat",
  "No Mercy",
  "Money Time",
  "Winner's",
  "Legacy",
  "Rival",
  "Hardwood",
  "Paint",
  "Blacktop",
  "Downtown",
  "Breakaway",
  "Skyhook",
  "Bank Shot",
  "Dagger",
  "Buzzer",
  "Poster",
  "And-One",
  "Shot Clock",
  "Full Send",
  "Red Zone",
  "Blue Flame",
];

const NOUNS = [
  "Bingra",
  "Buckets",
  "Ball",
  "Hoops",
  "Battle",
  "Showdown",
  "Shootout",
  "Challenge",
  "Grind",
  "Arena",
  "Clash",
  "Rush",
  "Quest",
  "Zone",
  "Attack",
  "Streak",
  "Series",
  "Match",
  "Drive",
  "Shot",
  "Break",
  "Fever",
  "Storm",
  "Madness",
  "Mayhem",
  "Heat",
  "Thunder",
  "Fury",
  "Frenzy",
  "Burst",
  "Bounce",
  "Splash",
  "Swish",
  "Bang",
  "Boom",
  "Arc",
  "Net",
  "Rim",
  "Glass",
  "Board",
  "Dime",
  "Handles",
  "Takeover",
  "Dynasty",
  "Kings",
  "Legends",
  "Titans",
  "Warriors",
  "Raiders",
  "Squad",
  "Crew",
  "Mob",
  "Mode",
  "Run",
  "Race",
  "Circuit",
  "Cup",
  "League",
  "Trial",
  "Gauntlet",
  "Barrage",
  "Battlefield",
  "Burst",
  "Blitz",
  "Jam",
  "Session",
  "Summit",
  "Collision",
  "Contest",
  "Carnage",
  "Firestorm",
  "Show",
  "Spectacle",
  "Rise",
  "Grudge",
  "Quest",
  "Peak",
  "Pulse",
  "Rally",
  "Strike",
  "Charge",
  "Wave",
  "Spin",
  "Snap",
  "Edge",
  "Point",
  "Possession",
  "Tipoff",
  "Drill",
  "Duel",
  "Hustle",
  "Dash",
  "Jump",
  "Flight",
  "Breakout",
  "Finale",
  "Victory",
  "Crown",
];

const SPECIAL_NAMES = [
  "Nothing But Net",
  "Winner Stays",
  "Game On",
  "Buckets Only",
  "Ball Don't Lie",
  "Heat Check",
  "Crunch Time",
  "Last Shot",
  "Clutch Mode",
  "Full Court Press",
  "Fastbreak Fever",
  "Swish City",
  "Rim Rocker",
  "Bucket Blitz",
  "Overtime Chaos",
  "Paint Battle",
  "Dime Drop",
  "Buzzer Beat",
  "Net Gain",
  "Jump Ball Jam",
  "Hardwood Havoc",
  "Court Chaos",
  "Bracket Buster",
  "And-One Energy",
  "Bingra Blitz",
  "Deep Range",
  "Final Possession",
  "Battle Tested",
  "Shot Caller",
  "Splash Zone",
  "Arc Attack",
  "Money Time",
  "No Mercy",
  "Playoff Pulse",
  "Rally Point",
  "Top Seed",
  "Blacktop Battle",
  "Glass Cleaners",
  "Handle Season",
  "Poster Time",
];

function randomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function maybeAddSuffix(name: string): string {
  const roll = Math.random();

  if (roll < 0.08) {
    return `${name} ${Math.floor(Math.random() * 90) + 10}`;
  }

  if (roll < 0.12) {
    return `${name} XL`;
  }

  return name;
}

function titleCase(input: string): string {
  return input
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      if (word.toUpperCase() === word) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

export function generateGameName(): string {
  const roll = Math.random();

  let name: string;

  if (roll < 0.18) {
    name = randomItem(SPECIAL_NAMES);
  } else if (roll < 0.72) {
    name = `${randomItem(ADJECTIVES)} ${randomItem(NOUNS)}`;
  } else {
    const first = randomItem(ADJECTIVES);
    const second = randomItem(NOUNS);

    if (first === second) {
      name = `${first} Clash`;
    } else {
      name = `${second} ${first}`;
    }
  }

  return titleCase(maybeAddSuffix(name));
}

export function generateUniqueGameName(
  existingNames: Iterable<string>,
  maxAttempts = 25,
): string {
  const used = new Set(
    Array.from(existingNames, (name) => name.trim().toLowerCase()),
  );

  for (let i = 0; i < maxAttempts; i += 1) {
    const candidate = generateGameName();
    if (!used.has(candidate.trim().toLowerCase())) {
      return candidate;
    }
  }

  return `${generateGameName()} ${Math.floor(Math.random() * 900) + 100}`;
}