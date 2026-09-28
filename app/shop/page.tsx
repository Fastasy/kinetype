import type { Metadata } from "next";
import Link from "next/link";

import JsonLd from "@/components/JsonLd";
import ShopClient from "@/components/game/ShopClient";

export const metadata: Metadata = {
  title: "Skins and HUD Overlays",
  description:
    "Spend the coins you earn in Kinetype on fighter skins, launch trails and HUD overlays. Every cosmetic is drawn in code, so there is nothing to download and the game stays fast.",
  alternates: { canonical: "/shop" },
};

export default function ShopPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Play", item: "https://kinetype.app/" },
            { "@type": "ListItem", position: 2, name: "Shop", item: "https://kinetype.app/shop" },
          ],
        }}
      />

      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <h1 className="font-mono text-3xl font-black leading-tight text-zinc-50 sm:text-4xl">
          Skins and overlays
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base">
          Every fighter, trail and HUD theme in Kinetype is drawn from code at runtime. There are no
          image files to download, which is why the game loads in under a second and why a new skin
          costs the site nothing to serve. You unlock them with coins you earn by playing.
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
          If you are short on coins, the fastest route is a clean win at a bot speed slightly above
          your own typing speed. Accuracy pays: the payout counts your best words per minute and your
          accuracy separately, and a losing streak still pays a little.
        </p>
      </div>

      <div className="mx-auto mt-8 max-w-5xl px-4 sm:px-6">
        <ShopClient />
      </div>

      <div className="mx-auto mt-10 max-w-5xl px-4 text-sm sm:px-6">
        <Link
          href="/"
          className="rounded-xl bg-emerald-500 px-5 py-2.5 font-bold text-zinc-950 transition hover:bg-emerald-400"
        >
          Earn coins in a match
        </Link>
      </div>
    </>
  );
}
