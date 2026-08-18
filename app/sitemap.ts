import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: "https://kinetype.app/",
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: "https://kinetype.app/rev-typing-test",
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: "https://kinetype.app/transcribeme-typing-test",
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: "https://kinetype.app/transcription-jobs",
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: "https://kinetype.app/how-to-become-a-transcriptionist",
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: "https://kinetype.app/how-to-become-a-virtual-assistant-philippines",
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: "https://kinetype.app/transcription-jobs-philippines",
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: "https://kinetype.app/become-a-virtual-assistant",
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: "https://kinetype.app/typing-test-wfh-jobs",
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];
}
