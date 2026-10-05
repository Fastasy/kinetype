import type { Metadata } from "next";

import ProfileView from "@/components/profile/ProfileView";

/**
 * A player's public profile at /u/<handle>.
 *
 * Reachable by anyone with the link — that is the point of a shareable profile — but explicitly
 * NOINDEX: a profile carries someone's activity history, and appearing on the leaderboard is not
 * consent to being crawled and archived. It is also kept out of the sitemap for the same reason.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  return {
    title: `${handle} · Kinetype player profile`,
    description: `Typing stats, activity and loadout for the Kinetype player ${handle}.`,
    robots: { index: false, follow: false },
  };
}

export default async function ProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <ProfileView handle={handle} />
    </main>
  );
}
