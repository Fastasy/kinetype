// Affiliate and partner links.
//
// Rev status (verified 2026-08-18): Rev's old self-serve publisher affiliate
// program is retired (rev.com/partners/affiliates 404s). The current official
// partnership channel is the "Rev Affinity & Vendor Partner" application at
// rev.com/partners/contact - apply there with a description of the proposed affiliation.
// Job seekers applying to work for Rev use rev.com/freelancers instead.
export const AFFILIATE = {
  // Rev: freelancer/transcriber application (job CTA on typing-test results and content pages).
  rev: "https://www.rev.com/freelancers",
  // Rev: official partnership program application ("Become A Rev Affinity & Vendor Partner").
  revPartner: "https://www.rev.com/partners/contact",
  // TranscribeMe: transcriber application.
  transcribeme: "https://www.transcribeme.com/jobs",
  // GoTranscript: Live transcriber affiliate / referral link.
  gotranscript: "https://gotranscript.com/english-transcription-job?ref=8311926",
  // Sonix: 10% of first-year Standard/Premium plan revenue per referred subscriber.
  // PENDING approval: do NOT use as a sponsored affiliate link until approved.
  sonix: "https://sonix.ai/",
  // Descript: $25 per new subscriber referred. PENDING approval: do NOT use as a
  // sponsored affiliate link until approved.
  descript: "https://www.descript.com/",
  // Transcription training course (informational resource, not a tracked affiliate).
  transcribeAnywhere: "https://www.transcribeanywhere.com/",
  // Keychron: from 5% commission per sale.
  keychron: "https://affiliate.keychron.com/",
} as const;

export const AFFILIATE_DISCLOSURE =
  "Some links on this page are affiliate or referral links. If you sign up through them, Kinetype may earn a small commission at no extra cost to you.";
