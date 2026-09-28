// Word pools by tier. Lowercase a-z only, no proper nouns, no punctuation.
// Length bands are load-bearing: tier decides damage and knockback scaling, so a
// word must never be moved between pools without re-checking the balance table.
// game/tests/words.test.mjs asserts every word sits inside its band.

import type { WordTier } from "./types";

/** 3-4 characters. Fast, low damage, high base knockback. Creates space. */
export const LIGHT_WORDS = [
  "the", "and", "you", "for", "not", "are", "but", "all", "can", "had",
  "her", "was", "one", "our", "out", "day", "get", "has", "him", "his",
  "how", "man", "new", "now", "old", "see", "two", "way", "who", "boy",
  "did", "its", "let", "put", "say", "she", "too", "use", "run", "hit",
  "jam", "key", "lap", "map", "nap", "oak", "pad", "rag", "sap", "tap",
  "arc", "bay", "cod", "dip", "elm", "fig", "gap", "hue", "ivy", "jug",
  "keg", "lid", "mud", "nib", "orb", "pit", "rim", "sip", "tug", "urn",
  "van", "web", "yak", "zip", "bolt", "dash", "grip", "hash", "jolt", "knob",
  "lush", "mist", "nova", "pace", "quiz", "rush", "snap", "tide", "vibe", "warp",
  "yarn", "zone", "blur", "clap", "drum", "echo", "fist", "glow", "hook", "iron",
] as const;

/** 5-7 characters. Balanced. */
export const MID_WORDS = [
  "about", "after", "again", "below", "carry", "catch", "circuit", "click",
  "could", "count", "cover", "crash", "drive", "every", "field", "fight",
  "first", "float", "focus", "found", "frame", "fresh", "front", "given",
  "glass", "grand", "grant", "grass", "great", "green", "group", "guard",
  "guess", "heart", "heavy", "horse", "house", "human", "ideal", "image",
  "index", "inner", "input", "issue", "joint", "known", "large", "laser",
  "learn", "level", "light", "limit", "local", "logic", "loose", "lucky",
  "major", "match", "mayor", "metal", "might", "minor", "model", "mount",
  "mouse", "music", "never", "night", "noble", "noise", "north", "novel",
  "offer", "order", "other", "outer", "paint", "panel", "paper", "party",
  "peace", "phase", "phone", "photo", "pilot", "pitch", "place", "plain",
  "plane", "plant", "plate", "point", "pound", "power", "press", "price",
  "pride", "prime", "print", "prize", "proof", "pulse", "quick", "quiet",
  "radio", "raise", "range", "rapid", "reach", "ready", "relay", "rider",
  "right", "river", "round", "route", "royal", "scale", "scene", "scope",
  "score", "sense", "serve", "seven", "shape", "share", "sharp", "shift",
  "shine", "shock", "short", "sight", "skill", "slate", "slide", "smart",
  "smile", "solid", "solve", "sound", "south", "space", "spark", "speak",
  "speed", "spend", "spike", "spine", "spite", "split", "sport", "stage",
  "stake", "stand", "start", "state", "steam", "steel", "stick", "still",
  "stock", "stone", "store", "storm", "story", "strip", "style", "swift",
  "swing", "table", "taste", "teach", "tense", "there", "thick", "thing",
  "think", "three", "throw", "tight", "timer", "title", "today", "token",
  "topic", "total", "touch", "tough", "tower", "track", "trade", "trail",
  "train", "treat", "trend", "trial", "tribe", "trick", "trust", "truth",
  "twist", "uncle", "under", "union", "unity", "until", "upper", "urban",
  "usual", "value", "video", "virus", "visit", "vital", "voice", "voltage",
  "watch", "water", "wheel", "where", "which", "while", "white", "whole",
  "whose", "width", "woman", "world", "worry", "worth", "would", "write",
  "wrong", "young",
] as const;

/** 8+ characters. Slow, high damage, high knockback scaling. */
export const HEAVY_WORDS = [
  "absolute", "abstract", "accurate", "activity", "addition", "advanced",
  "aircraft", "alliance", "although", "analysis", "announce", "anything",
  "apparent", "approach", "argument", "assembly", "attitude", "audience",
  "balanced", "baseball", "bathroom", "birthday", "boundary", "building",
  "business", "calendar", "campaign", "capacity", "category", "ceremony",
  "champion", "character", "chemical", "children", "civilian", "classify",
  "climbing", "clothing", "collapse", "colonial", "commence", "commerce",
  "complete", "compound", "computer", "conclude", "concrete", "conflict",
  "confused", "congress", "consider", "constant", "consumer", "contract",
  "contrast", "convince", "corridor", "coverage", "creative", "criminal",
  "critical", "cultural", "currency", "customer", "database", "daughter",
  "decision", "decrease", "definite", "delicate", "delivery", "describe",
  "designer", "detailed", "diabetes", "dialogue", "diameter", "director",
  "disaster", "discover", "dispatch", "distance", "distinct", "district",
  "division", "dominant", "dramatic", "duration", "dynamics", "economic",
  "educator", "election", "electric", "elemental", "elephant", "emergency",
  "emission", "employee", "engineer", "enormous", "entrance", "envelope",
  "equality", "estimate", "evaluate", "eventual", "evidence", "exchange",
  "exercise", "explicit", "exposure", "extended", "external", "facility",
  "familiar", "favorite", "feathers", "festival", "fighting", "finished",
  "firewall", "flexible", "floating", "football", "forecast", "foremost",
  "fraction", "fragment", "frequent", "friendly", "frontier", "function",
  "generate", "generous", "gentleman", "graduate", "graphics", "grateful",
  "guardian", "guidance", "hardware", "headline", "heritage", "historic",
  "hospital", "hundreds", "identify", "identity", "immediate", "incident",
  "increase", "indicate", "industry", "informal", "initiate", "innocent",
  "inspired", "instance", "integral", "interact", "interior", "internal",
  "interval", "involved", "judgment", "keyboard", "landscape", "language",
  "laughter", "learning", "leverage", "likewise", "location", "magnetic",
  "maintain", "majority", "mandated", "manuscript", "material", "mechanics",
  "medicine", "memorial", "mentally", "midnight", "military", "minerals",
  "minority", "momentum", "monument", "mortgage", "mountain", "movement",
  "multiple", "national", "negative", "neighbor", "notebook", "numbered",
  "observer", "occasion", "offering", "official", "operator", "opponent",
  "ordinary", "organize", "original", "outdoors", "overcome", "overhead",
  "parallel", "parental", "particle", "passenger", "password", "patience",
  "peaceful", "periodic", "personal", "persuade", "physical", "platform",
  "pleasure", "politics", "portrait", "position", "positive", "possible",
  "powerful", "practice", "precious", "precisely", "predicts", "premiere",
  "presence", "pressure", "previous", "priority", "prisoner", "probably",
  "producer", "professor", "profound", "progress", "prohibit", "property",
  "proposal", "prospect", "protocol", "province", "publicly", "punished",
  "purchase", "quantity", "question", "reaction", "receiver", "recently",
  "recovery", "regional", "register", "relative", "relevant", "reliable",
  "remember", "reminder", "removing", "repeated", "reporter", "research",
  "resemble", "resident", "resource", "response", "restrict", "retailer",
  "revealed", "revenues", "reversed", "reviewer", "rigorous", "romantic",
  "sandwich", "scenario", "schedule", "scientist", "scramble", "seasonal",
  "sections", "security", "sensible", "sentence", "separate", "sequence",
  "sergeant", "sessions", "shortage", "shoulder", "simplify", "situated",
  "sketches", "slightly", "software", "solution", "somebody", "southern",
  "speaking", "specific", "spelling", "spirited", "splendid", "sponsors",
  "squadron", "standard", "standing", "statement", "steering", "straight",
  "strategy", "strength", "stressed", "strictly", "stronger", "struggle",
  "students", "stunning", "suburban", "suddenly", "superior", "supposed",
  "surprise", "survival", "sweeping", "symbolic", "sympathy", "talented",
  "taxpayer", "teaching", "teammate", "tendency", "terminal", "terrible",
  "thousand", "together", "tomorrow", "tracking", "training", "transfer",
  "traveler", "treasure", "triangle", "tropical", "troubled", "ultimate",
  "universe", "unlikely", "unstable", "upcoming", "vacation", "valuable",
  "variable", "vertical", "violence", "warriors", "weakness", "weaponry",
  "whatever", "whenever", "wherever", "wildlife", "wireless", "withdraw",
  "workshop", "yourself",
] as const;

/** Exactly GUARD_WORD_LENGTH (5) characters. Short enough to be a real parry window. */
export const GUARD_WORDS = [
  "block", "brace", "cover", "guard", "parry", "plant", "press", "shade",
  "shell", "stand", "steel", "still", "stone", "stoop", "tower", "wield",
] as const;

/** Exactly RECOVERY_WORD_LENGTH (5) characters. Typed while falling, must be easy. */
export const RECOVERY_WORDS = [
  "catch", "climb", "cling", "float", "glide", "grasp", "hoist", "hover",
  "latch", "ledge", "mount", "perch", "reach", "solid", "swing", "vault",
] as const;

export const POOLS: Record<WordTier, readonly string[]> = {
  light: LIGHT_WORDS,
  mid: MID_WORDS,
  heavy: HEAVY_WORDS,
};

export const TIER_ORDER: readonly WordTier[] = ["light", "mid", "heavy"];
