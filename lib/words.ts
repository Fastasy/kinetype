export const ENGLISH_WORDS: string[] = [
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "i",
  "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
  "this", "but", "his", "by", "from", "they", "we", "say", "her", "she",
  "or", "an", "will", "my", "one", "all", "would", "there", "their", "what",
  "so", "up", "out", "if", "about", "who", "get", "which", "go", "me",
  "when", "make", "can", "like", "time", "no", "just", "him", "know", "take",
  "people", "into", "year", "your", "good", "some", "could", "them", "see", "other",
  "than", "then", "now", "look", "only", "come", "its", "over", "think", "also",
  "back", "after", "use", "two", "how", "our", "work", "first", "well", "way",
  "even", "new", "want", "because", "any", "these", "give", "day", "most", "us",
  "word", "where", "long", "little", "very", "great", "right", "mean", "old", "same",
  "tell", "boy", "follow", "came", "want", "show", "also", "around", "form", "three",
  "small", "set", "put", "end", "does", "another", "well", "large", "must", "big",
  "even", "such", "because", "turn", "here", "why", "ask", "went", "men", "read",
  "need", "land", "different", "home", "us", "move", "try", "kind", "hand", "picture",
  "again", "change", "off", "play", "spell", "air", "away", "animal", "house", "point",
  "page", "letter", "mother", "answer", "found", "study", "still", "learn", "should", "world",
  "every", "school", "grow", "food", "keep", "begin", "thought", "four", "head", "fire",
  "under", "story", "left", "few", "while", "along", "might", "close", "something", "seem",
  "next", "hard", "open", "example", "begin", "life", "always", "those", "both", "paper",
];

export const AFRIKAANS_WORDS: string[] = [
  "die", "en", "van", "ek", "jou", "is", "in", "dit", "nie", "hy",
  "sy", "ons", "julle", "hulle", "met", "vir", "dat", "het", "was", "sal",
  "kan", "maar", "ook", "as", "wat", "soos", "hierdie", "daardie", "daar", "hier",
  "waar", "wanneer", "hoekom", "hoe", "baie", "net", "nog", "al", "reeds", "mooi",
  "groot", "klein", "goed", "sleg", "dag", "nag", "jaar", "maand", "week", "uur",
  "minuut", "mense", "kind", "huis", "werk", "skool", "lewe", "tyd", "geld", "water",
  "brood", "koffie", "tee", "vleis", "vrugte", "groente", "reën", "son", "wind", "see",
  "berg", "pad", "motor", "fiets", "vliegtuig", "trein", "stad", "dorp", "land", "Suid-Afrika",
  "Pretoria", "Kaapstad", "Johannesburg", "Durban", "Gqeberha", "dankie", "asseblief", "jammer", "ja", "nee",
  "miskien", "vandag", "môre", "gister", "nou", "later", "vroeg", "laat", "vinnig", "stadig",
  "hardop", "stil", "reg", "verkeerd", "links", "regs", "bo", "onder", "binne", "buite",
  "eerste", "laaste", "volgende", "vorige", "saam", "alleen", "altyd", "nooit", "soms", "gewoonlik",
];

export const CODE_SNIPPETS: string[] = [
  `function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

for (let i = 0; i < 10; i++) {
  console.log(fibonacci(i));
}`,
  `def word_count(text):
    words = text.lower().split()
    counts = {}
    for word in words:
        counts[word] = counts.get(word, 0) + 1
    return counts

print(word_count("the quick brown fox jumps over the lazy dog"))`,
  `const fetchUser = async (id) => {
  const res = await fetch("/api/users/" + id);
  if (!res.ok) throw new Error("Request failed");
  return res.json();
};

fetchUser(42).then((user) => console.log(user.name));`,
  `class BankAccount {
  constructor(owner, balance) {
    this.owner = owner;
    this.balance = balance;
  }

  deposit(amount) {
    this.balance += amount;
    return this.balance;
  }

  withdraw(amount) {
    if (amount > this.balance) return false;
    this.balance -= amount;
    return true;
  }
}`,
  `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Typing Speed</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <h1>Test your typing speed</h1>
  <p>Start typing when you are ready.</p>
</body>
</html>`,
];
