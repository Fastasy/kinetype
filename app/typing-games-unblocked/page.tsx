import type { Metadata } from "next";
import Link from "next/link";

import JsonLd from "@/components/JsonLd";

export const metadata: Metadata = {
 title: "Typing Games Unblocked: Play Kinetype in a Browser",
 description:
 "Kinetype runs in the browser with no install, no account and no download, which makes it a practical option on school and work machines. What it needs, what it does not, and how to play quietly.",
 alternates: { canonical: "/typing-games-unblocked" },
};

const FAQ = [
 {
 q: "Does Kinetype need a download or an install?",
 a: "No. It is a web page. There is no app, no extension, no plugin and no account, so there is nothing for an administrator to install and nothing to remove afterwards. You open the page and start typing.",
 },
 {
 q: "Will it work on a school Chromebook?",
 a: "Anywhere a modern browser runs. The game uses canvas and JavaScript only, no Flash and no special APIs, so Chromebooks, Windows laptops and Macs all work. It needs a physical keyboard, which a Chromebook has.",
 },
 {
 q: "Can I play it without sound?",
 a: "Yes. There is a Sound on button next to the difficulty selector. Turn it off and the game is completely silent apart from what is on screen, which matters in a quiet room. The setting is remembered on that device.",
 },
 {
 q: "Does Kinetype try to get around network filters?",
 a: "No. It is an ordinary web page served over HTTPS, and it does not proxy, tunnel or disguise traffic. If your school or workplace blocks the domain, that is their decision and it applies. This is simply a game that happens not to require an install.",
 },
 {
 q: "How long is a match?",
 a: "Best of three rounds, and each round caps at 90 seconds, so a full match is a few minutes. That is short by design, because sustained fast typing is tiring and long sessions stop being useful practice.",
 },
 {
 q: "Is this good typing practice?",
 a: "It trains the same thing a typing test does, with two additions. You have to choose between accuracy and speed under pressure, and you have to keep going after a mistake instead of stopping. Most typing tests let you reset. This one does not.",
 },
];

export default function UnblockedPage() {
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
 name: "Unblocked",
 item: "https://kinetype.app/typing-games-unblocked",
 },
 ],
 },
 ]}
 />

 <article className="mx-auto max-w-3xl px-4 sm:px-6">
 <h1 className="font-mono text-3xl font-black leading-tight text-ink sm:text-4xl">
 Typing games unblocked: what matters
 </h1>
 <p className="mt-4 text-sm leading-relaxed text-ink-faint sm:text-base">
 Most pages that promise unblocked games are vague about what they mean. Here is the
 specific version. Kinetype is a single web page with no installer, no account and no
 background downloads, and it needs nothing installed on the machine you are using.
 </p>

 <section className="mt-8" aria-labelledby="needs">
 <h2 id="needs" className="font-mono text-xl font-bold text-ink">
 What it needs and what it does not
 </h2>
 <div className="mt-4 grid gap-4 sm:grid-cols-2">
 <div className="rounded-2xl border border-brand-deep/50 bg-brand-deep/10 p-5">
 <h3 className="text-sm font-semibold text-brand-soft">Needs</h3>
 <ul className="mt-2 space-y-1.5 text-sm text-ink-faint">
 <li>A modern browser with JavaScript and canvas</li>
 <li>A physical keyboard, so a laptop is ideal</li>
 <li>About a second to load, on any connection</li>
 </ul>
 </div>
 <div className="rounded-2xl border border-line bg-card/40 p-5">
 <h3 className="text-sm font-semibold text-ink-soft">Does not need</h3>
 <ul className="mt-2 space-y-1.5 text-sm text-ink-faint">
 <li>An install, extension or plugin</li>
 <li>An account, email or login</li>
 <li>A download of any kind</li>
 <li>Sound, if you turn it off</li>
 </ul>
 </div>
 </div>
 </section>

 <section className="mt-10" aria-labelledby="quiet">
 <h2 id="quiet" className="font-mono text-xl font-bold text-ink">
 Playing quietly
 </h2>
 <p className="mt-3 text-sm leading-relaxed text-ink-faint">
 A typing game makes noise by design, because hearing your own keystrokes is how you catch
 mistakes when you are not looking at the screen. If you are somewhere quiet, hit the
 Sound on button next to the difficulty selector and it toggles to Sound off. Your
 preference is saved on the device, so you only do it once. The visual feedback is
 complete without audio: the next letter is boxed, committed letters turn green, and a
 mistake flashes the word red.
 </p>
 </section>

 <section className="mt-10" aria-labelledby="short">
 <h2 id="short" className="font-mono text-xl font-bold text-ink">
 Short sessions, which is the point
 </h2>
 <p className="mt-3 text-sm leading-relaxed text-ink-faint">
 A match is best of three rounds with a 90 second cap per round. That is roughly three to
 five minutes. Sustained typing at speed gets sloppy after a few minutes, and practising
 sloppily trains mistakes, so the structure deliberately stops you. If you want a longer
 session, the honest approach is three matches with a break between them rather than one
 long one.
 </p>
 </section>

 <section className="mt-10" aria-labelledby="practice">
 <h2 id="practice" className="font-mono text-xl font-bold text-ink">
 If you are using this to get faster
 </h2>
 <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink-faint">
 <p>
 Set the bot a little slower than you type and win on accuracy first. Speed follows
 accuracy, and a sloppy habit learned at speed is harder to unlearn than a slow one.
 </p>
 <p>
 Leave Strict mistakes off until you are finishing words cleanly. The forgiving default is
 better for learning, and the penalty is there for when the game stops challenging you.
 </p>
 <p>
 Practise parrying on purpose. Winning by parry teaches you to read the screen before you
 type, which is the part that carries over to real typing.
 </p>
 <p>
 Check your numbers after each match. If accuracy is dropping while speed climbs, you have
 gone too fast.
 </p>
 </div>
 </section>

 <section className="mt-10" aria-labelledby="faq">
 <h2 id="faq" className="font-mono text-xl font-bold text-ink">
 Questions
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
 href="/"
 className="rounded-xl bg-brand px-5 py-2.5 font-bold text-page transition hover:bg-brand-bright"
 >
 Play Kinetype
 </Link>
 <Link
 href="/typing-speed-test"
 className="rounded-xl border border-line-strong px-5 py-2.5 font-semibold text-ink-soft transition hover:border-brand/60 hover:text-brand-bright"
 >
 Check your WPM first
 </Link>
 </div>
 </article>
 </>
 );
}
