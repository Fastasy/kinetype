import type { MetadataRoute } from "next";

const SITE_URL = "https://www.kinetype.app";

const ROUTES: { path: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" }[] = [
  { path: "/", priority: 1.0, changeFrequency: "weekly" },
  { path: "/play", priority: 0.95, changeFrequency: "weekly" },
  { path: "/bosses", priority: 0.85, changeFrequency: "weekly" },
  { path: "/leaderboard", priority: 0.6, changeFrequency: "daily" },
  { path: "/how-to-play", priority: 0.9, changeFrequency: "monthly" },
  { path: "/shop", priority: 0.7, changeFrequency: "monthly" },
  { path: "/typing-games-unblocked", priority: 0.8, changeFrequency: "monthly" },
  { path: "/typing-fighting-games", priority: 0.8, changeFrequency: "monthly" },
  { path: "/typing-games-for-middle-school", priority: 0.8, changeFrequency: "monthly" },
  { path: "/games-like-nitro-type", priority: 0.75, changeFrequency: "monthly" },
  { path: "/typing-speed-test", priority: 0.9, changeFrequency: "weekly" },
  { path: "/guides", priority: 0.7, changeFrequency: "weekly" },
];

/**
 * Work-from-home job guides. Restored 2026-10-08 after the 2026-09-28 game
 * conversion deleted them. They are the site's organic search surface: each one
 * targets a job-seeker query and carries the GoTranscript referral, so they stay
 * in the sitemap even though they sit outside the main game navigation.
 *
 * The directory page holds the internal-link hub together, which is what keeps
 * 28 guides from being 28 orphans.
 */
const JOB_GUIDE_ROUTES: { path: string; priority: number; changeFrequency: "weekly" | "monthly" }[] = [
  { path: "/articles", priority: 0.7, changeFrequency: "weekly" },
  { path: "/how-to-pass-a-typing-test-for-a-job", priority: 0.8, changeFrequency: "monthly" },
  { path: "/how-to-pass-gotranscript-test", priority: 0.8, changeFrequency: "monthly" },
  { path: "/free-transcription-test-practice", priority: 0.7, changeFrequency: "monthly" },
  { path: "/rev-typing-test", priority: 0.7, changeFrequency: "monthly" },
  { path: "/transcribeme-typing-test", priority: 0.7, changeFrequency: "monthly" },
  { path: "/typing-test-wfh-jobs", priority: 0.7, changeFrequency: "monthly" },
  { path: "/how-to-get-transcription-jobs", priority: 0.7, changeFrequency: "monthly" },
  { path: "/transcription-jobs", priority: 0.7, changeFrequency: "monthly" },
  { path: "/how-to-become-a-transcriptionist", priority: 0.7, changeFrequency: "monthly" },
  { path: "/transcriptionist-salary", priority: 0.7, changeFrequency: "monthly" },
  { path: "/legal-transcription-jobs-from-home", priority: 0.7, changeFrequency: "monthly" },
  { path: "/medical-transcription-jobs-from-home", priority: 0.7, changeFrequency: "monthly" },
  { path: "/subtitle-jobs-from-home", priority: 0.7, changeFrequency: "monthly" },
  { path: "/captioning-jobs-for-beginners", priority: 0.7, changeFrequency: "monthly" },
  { path: "/how-to-become-a-virtual-assistant-philippines", priority: 0.7, changeFrequency: "monthly" },
  { path: "/transcription-jobs-philippines", priority: 0.7, changeFrequency: "monthly" },
  { path: "/transcription-jobs-south-africa", priority: 0.7, changeFrequency: "monthly" },
  { path: "/online-typing-jobs-south-africa", priority: 0.7, changeFrequency: "monthly" },
  { path: "/medical-transcription-jobs-philippines", priority: 0.7, changeFrequency: "monthly" },
  { path: "/captioning-jobs-philippines", priority: 0.7, changeFrequency: "monthly" },
  { path: "/tagalog-transcription-jobs", priority: 0.7, changeFrequency: "monthly" },
  { path: "/data-entry-jobs-philippines", priority: 0.7, changeFrequency: "monthly" },
  { path: "/encoding-jobs-philippines", priority: 0.7, changeFrequency: "monthly" },
  { path: "/sideline-jobs-philippines", priority: 0.7, changeFrequency: "monthly" },
  { path: "/online-jobs-for-moms-philippines", priority: 0.7, changeFrequency: "monthly" },
  { path: "/transcription-jobs-for-students-philippines", priority: 0.7, changeFrequency: "monthly" },
  { path: "/virtual-assistant-salary-philippines", priority: 0.7, changeFrequency: "monthly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const all = [...ROUTES, ...JOB_GUIDE_ROUTES];
  return all.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
