import type { Metadata } from "next";
import Link from "next/link";

import JsonLd from "@/components/JsonLd";

export const metadata: Metadata = {
 title: "How to Play Kinetype: Typing Fighting Game Controls and Strategy",
 description:
 "How the Kinetype typing fighter works: typing a sentence where every word is a move, blocking and parrying, reading damage, saving yourself off the edge, and picking a bot speed from 20 to 120 words per minute.",
 alternates: { canonical: "/how-to-play" },
};

const STEPS = [
 {
   h: "Read the sentence, because it is your next few moves",
   p: "You get one sentence at a time and you type it straight through. Every word in it is a move, decided by how difficult the word is: a small word blocks, an ordinary word punches, and a long word kicks. The kick is the one that ends rounds, the punch is the workhorse, and the block is what keeps you alive. You cannot skip a word, so the sentence you were handed is the hand you have to play. Read it before you start typing and you will know when your block lands.",
 },
 {
   h: "Type it, starting with the first letter",
   p: "There is nothing to click and nothing to select. Type the sentence straight through, including the space between each pair of words — the space is a real key here and the game will not move on to the next word until you press it. Every move fires on the final letter of its word, and every keystroke counts from the first press. There is no space needed after the last word; the sentence ends there and the next one is already on screen.",
 },
 {
   h: "Build a chain for extra damage",
   p: "Every word you type without a single mistake builds your chain. Three clean words in a row and every move you land hits 15 percent harder, up to 60 percent at a chain of twelve. The screen gets louder as it climbs, so you can feel it without looking. One slip and the chain is gone: a wrong letter, a missed space, anything. It resets each round, so every round is a fresh climb.",
 },
 {
 h: "Watch the damage colour, not a health bar",
 p: "There is no health bar, because damage does not knock you out on its own. It makes you easier to knock out. Your outline shifts from white to yellow to orange to red as it climbs, and the same kick throws you further at 100 percent than it did at 10. Once you are deep in the red, one kick ends the round.",
 },
 {
 h: "Block and parry the kicks",
 p: "A block lasts about a second, and you raise it by finishing a small word. When your opponent commits to a kick you get a KICK INCOMING warning: if your block is up when that kick connects, you parry it and take about a third of the knockback, and you get a counter window that doubles your next hit. Blocking at the wrong moment is not free, because you spent the time typing a word that did no damage.",
 },
 {
 h: "Type the save word if you go off the edge",
 p: "Going past the red line does not end the round straight away. A large SAVE word appears with a short timer. Complete it and you climb back onto the stage with a brief moment of invulnerability. Miss it and the round is over. This is the most important word in the match, so keep an eye on the timer.",
 },
];

const FAQ = [
 {
 q: "Do I need to be fast to win?",
 a: "Speed helps, but blocking and damage decide more fights than raw words per minute. A player who reads the incoming kick and parries it beats a faster player who never blocks. The bot ladder lets you test that: try beating the 70 word per minute bot while you type at 45.",
 },
 {
 q: "What do I lose if I make a mistake?",
 a: "By default, only the bonus on that one word. A wrong letter clears that word's precision bonus, and you carry on from where you were once you press the right key. You do not start the word again, you are not stunned, and the rest of the sentence still earns its own bonus. Turn on Strict mistakes if you want a wrong letter to cost you about half a second of movement.",
 },
 {
 q: "How do I choose the difficulty?",
 a: "You set the bot's typing speed directly, from 20 to 120 words per minute, rather than picking easy or normal. Typing speed and gaming skill are not the same thing, so a number tells you far more about what you are in for. Your sentences also get longer as the speed goes up, so the slow bots hand you short sentences you can actually finish.",
 },
 {
 q: "How many rounds is a match?",
 a: "Best of three. Rounds also have a 90 second limit, and if the clock runs out the player with less damage wins the round.",
 },
 {
 q: "Why do words sometimes look different?",
 a: "Each word carries a coloured underline and the word you are typing is highlighted: teal blocks, purple punches, red kicks. So you can see the next few moves at a glance. A large amber SAVE word replaces your sentence when you are knocked off the edge.",
 },
];

export default function HowToPlayPage() {
 return (
 <>
 <JsonLd
 data={[
 {
 "@context": "https://schema.org",
 "@type": "FAQPage",
 mainEntity: FAQ.map((f) => ({
 "@type": "Question",
 name: f.q,
 acceptedAnswer: { "@type": "Answer", text: f.a },
 })),
 },
 {
 "@context": "https://schema.org",
 "@type": "BreadcrumbList",
 itemListElement: [
 { "@type": "ListItem", position: 1, name: "Play", item: "https://kinetype.app/" },
 {
 "@type": "ListItem",
 position: 2,
 name: "How to play",
 item: "https://kinetype.app/how-to-play",
 },
 ],
 },
 ]}
 />

 <article className="mx-auto max-w-3xl px-4 sm:px-6">
 <h1 className="font-mono text-3xl font-black leading-tight text-ink sm:text-4xl">
 How to play Kinetype
 </h1>
 <p className="mt-4 text-sm leading-relaxed text-ink-faint sm:text-base">
 Kinetype looks like a fighting game and plays like a typing test with consequences. One
 sentence at a time, one move per word. These five things decide almost every exchange, and
 they are worth two minutes before your first match.
 </p>

 <div className="mt-8 space-y-6">
 {STEPS.map((s, i) => (
 <section key={s.h} className="rounded-2xl border border-line bg-card/40 p-5">
 <h2 className="flex items-baseline gap-3 font-semibold text-ink">
 <span className="font-mono text-sm text-brand-bright">{i + 1}</span>
 {s.h}
 </h2>
 <p className="mt-2 text-sm leading-relaxed text-ink-faint">{s.p}</p>
 </section>
 ))}
 </div>

 <section className="mt-10" aria-labelledby="controls">
 <h2 id="controls" className="font-mono text-xl font-bold text-ink">
 Controls
 </h2>
 <div className="mt-4 overflow-hidden rounded-xl border border-line">
 <table className="w-full text-left text-sm">
 <thead className="bg-card/60 text-xs uppercase tracking-wider text-ink-faint">
 <tr>
 <th className="px-4 py-2 font-semibold">Key</th>
 <th className="px-4 py-2 font-semibold">Does</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-line text-ink-soft">
 <tr>
   <td className="px-4 py-2 font-mono text-brand-bright">A to Z</td>
   <td className="px-4 py-2">Types the word in front of you. Every word is a move</td>
</tr>
 <tr>
   <td className="px-4 py-2 font-mono text-brand-bright">Esc</td>
   <td className="px-4 py-2">Quits the match</td>
 </tr>
 </tbody>
 </table>
 </div>
 <p className="mt-3 text-xs text-ink-faint">
 That is the whole control scheme. There is no jump, no block button and no movement keys,
 because typing is the only verb in the game: your block comes from finishing a small word,
 not from pressing another key. You do not need to type spaces either.
 </p>
 </section>

 <section className="mt-10" aria-labelledby="faq">
 <h2 id="faq" className="font-mono text-xl font-bold text-ink">
 Common questions
 </h2>
 <dl className="mt-4 divide-y divide-line border-y border-line">
 {FAQ.map((f) => (
 <div key={f.q} className="py-4">
 <dt className="font-semibold text-ink">{f.q}</dt>
 <dd className="mt-1.5 text-sm leading-relaxed text-ink-faint">{f.a}</dd>
 </div>
 ))}
 </dl>
 </section>

 <div className="mt-10 flex flex-wrap gap-3 text-sm">
 <Link
 href="/play"
 className="rounded-xl bg-brand px-5 py-2.5 font-bold text-brand-deep transition hover:bg-brand-bright"
 >
 Play now
 </Link>
 <Link
 href="/shop"
 className="rounded-xl border border-line-strong px-5 py-2.5 font-semibold text-ink-soft transition hover:border-brand/60 hover:text-brand-bright"
 >
 See the skins
 </Link>
 </div>
 </article>
 </>
 );
}
