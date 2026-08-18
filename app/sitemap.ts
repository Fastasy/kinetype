import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: "https://kinetype.com/",
      lastModified: now,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: "https://kinetype.com/transcription-jobs",
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: "https://kinetype.com/how-to-become-a-transcriptionist",
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}
