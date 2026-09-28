import type { NextConfig } from "next";

/**
 * The site was repurposed from a transcription-jobs content hub into a typing
 * fighting game on 2026-09-28. The 29 old routes were DELETED from the repo. Their
 * content is preserved in the Obsidian vault at Kinetype/Articles/Published and in
 * git history, and their URLs redirect below so no visitor and no crawler hits a
 * dead end.
 *
 * Two of them genuinely concerned typing tests, so those keep a relevant target.
 * Everything else points at the game, which keeps the domain's accumulated link
 * equity in one place instead of scattering it across 404s.
 *
 * Alternative worth knowing: if the intent is to tell search engines "this content
 * is gone, drop it", a 410 would do that more explicitly. Next config redirects
 * can only send 3xx, so that would need middleware. Reversible either way.
 */
const nextConfig: NextConfig = {
  async redirects() {
    const legacyRoutes = [
      "/articles",
      "/captioning-jobs-for-beginners",
      "/captioning-jobs-philippines",
      "/data-entry-jobs-philippines",
      "/encoding-jobs-philippines",
      "/free-transcription-test-practice",
      "/how-to-become-a-transcriptionist",
      "/how-to-become-a-virtual-assistant-philippines",
      "/how-to-get-transcription-jobs",
      "/how-to-pass-a-typing-test-for-a-job",
      "/how-to-pass-gotranscript-test",
      "/legal-transcription-jobs-from-home",
      "/medical-transcription-jobs-from-home",
      "/medical-transcription-jobs-philippines",
      "/online-jobs-for-moms-philippines",
      "/online-typing-jobs-south-africa",
      "/sideline-jobs-philippines",
      "/subtitle-jobs-from-home",
      "/tagalog-transcription-jobs",
      "/transcription-jobs",
      "/transcription-jobs-for-students-philippines",
      "/transcription-jobs-philippines",
      "/transcription-jobs-south-africa",
      "/transcriptionist-salary",
      "/typing-test-wfh-jobs",
      "/virtual-assistant-salary-philippines",
      // Superseded by the Philippines-specific URL in 2026-08, and that URL is now
      // retired too, so this collapses to the game rather than chaining.
      "/become-a-virtual-assistant",
    ];

    return [
      // The two legacy routes that were about typing keep a relevant destination.
      ...["/rev-typing-test", "/transcribeme-typing-test"].map((source) => ({
        source,
        destination: "/typing-speed-test",
        permanent: true,
      })),
      ...legacyRoutes.map((source) => ({
        source,
        destination: "/",
        permanent: true,
      })),
    ];
  },
};

export default nextConfig;
