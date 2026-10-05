import type { MetadataRoute } from "next";

const SITE_URL = "https://kinetype.app";

const ROUTES: { path: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" }[] = [
  { path: "/", priority: 1.0, changeFrequency: "weekly" },
  { path: "/play", priority: 0.95, changeFrequency: "weekly" },
  { path: "/bosses", priority: 0.85, changeFrequency: "weekly" },
  { path: "/leaderboard", priority: 0.6, changeFrequency: "daily" },
  { path: "/how-to-play", priority: 0.9, changeFrequency: "monthly" },
  { path: "/shop", priority: 0.7, changeFrequency: "monthly" },
  { path: "/typing-games-unblocked", priority: 0.8, changeFrequency: "monthly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return ROUTES.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
