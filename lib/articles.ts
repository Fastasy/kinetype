export type ArticleMeta = {
  slug: string;
  title: string;
  blurb: string;
  category: string;
  tags: string[];
};

// Single source of truth for the articles directory (used by /articles page,
// nav, and search). Keep in sync with the routes in app/.
export const ARTICLES: ArticleMeta[] = [
  {
    slug: "transcription-jobs",
    title: "Transcription Jobs (Global)",
    blurb: "Where to find transcription work in 2026, which platforms hire beginners, and what the application gates actually test.",
    category: "Transcription",
    tags: ["transcription", "beginner", "global", "work from home"],
  },
  {
    slug: "how-to-become-a-transcriptionist",
    title: "Become a Transcriptionist",
    blurb: "The full career path in six steps: typing speed, accuracy, general or specialized work, and the applications.",
    category: "Transcription",
    tags: ["transcription", "career", "guide", "beginner"],
  },
  {
    slug: "transcription-jobs-philippines",
    title: "Transcription Jobs Philippines",
    blurb: "Real 2026 pay, real requirements. Platform rates, peso equivalents, application gates, and scam red flags.",
    category: "Philippines",
    tags: ["transcription", "philippines", "pay", "scams"],
  },
  {
    slug: "how-to-become-a-virtual-assistant-philippines",
    title: "Become a VA in the Philippines",
    blurb: "The VA hiring funnel, what agencies test, and how your typing speed and accuracy decide which doors open.",
    category: "Philippines",
    tags: ["virtual assistant", "philippines", "va", "work from home"],
  },
  {
    slug: "typing-test-wfh-jobs",
    title: "Typing Test to WFH Jobs",
    blurb: "Which work-from-home jobs your WPM unlocks, with the speed requirements for each role.",
    category: "Typing Tests",
    tags: ["typing test", "wfh", "jobs", "wpm"],
  },
  {
    slug: "how-to-pass-a-typing-test-for-a-job",
    title: "How to Pass a Typing Test for a Job",
    blurb: "What employers test, the typing speed you need by job type, a two week practice plan, and how to pass on the day.",
    category: "Typing Tests",
    tags: ["typing test", "job application", "practice", "wpm"],
  },
  {
    slug: "rev-typing-test",
    title: "Rev Typing Test",
    blurb: "Passing score, accuracy standards, exam breakdown, and free practice for the Rev transcriptionist application.",
    category: "Typing Tests",
    tags: ["rev", "typing test", "transcription", "exam"],
  },
  {
    slug: "transcribeme-typing-test",
    title: "TranscribeMe Exam",
    blurb: "Entrance exam benchmarks for TranscribeMe: what the 39 page style guide tests and how to prepare.",
    category: "Typing Tests",
    tags: ["transcribeme", "exam", "typing test", "transcription"],
  },
  {
    slug: "how-to-get-transcription-jobs",
    title: "How to Get Transcription Jobs",
    blurb: "The realistic path to your first transcription job: measure your speed, apply to the right platforms, pass the test.",
    category: "Transcription",
    tags: ["transcription", "beginner", "no experience", "jobs"],
  },
  {
    slug: "tagalog-transcription-jobs",
    title: "Tagalog Transcription Jobs",
    blurb: "Who hires Tagalog transcribers, what the work pays, and how to pass the test. A bilingual niche with less competition.",
    category: "Philippines",
    tags: ["tagalog", "transcription", "philippines", "bilingual"],
  },
  {
    slug: "transcription-jobs-south-africa",
    title: "Transcription Jobs South Africa",
    blurb: "The honest state of transcription work in SA: which platforms hire locals, what it pays in rands, and how to start.",
    category: "Transcription",
    tags: ["transcription", "south africa", "rands", "work from home"],
  },
  {
    slug: "data-entry-jobs-philippines",
    title: "Data Entry Jobs Philippines",
    blurb: "Real data entry jobs for beginners in the Philippines, what they pay, where they are posted, and how to spot scams.",
    category: "Data Entry",
    tags: ["data entry", "philippines", "no experience", "scams"],
  },
  {
    slug: "encoding-jobs-philippines",
    title: "Encoding Jobs Philippines",
    blurb: "What encoder work really is, what it pays, where the real jobs are posted, and how to avoid the scams.",
    category: "Data Entry",
    tags: ["encoding", "encoder", "philippines", "data entry"],
  },
  {
    slug: "transcription-jobs-for-students-philippines",
    title: "Transcription Jobs for Students (PH)",
    blurb: "Part time transcription that fits around class: realistic student earnings, which platforms hire, how to apply.",
    category: "Philippines",
    tags: ["students", "transcription", "philippines", "part time"],
  },
  {
    slug: "captioning-jobs-for-beginners",
    title: "Captioning Jobs for Beginners",
    blurb: "What captioning work really involves, how it differs from transcription, what it pays, and how to apply.",
    category: "Captioning",
    tags: ["captioning", "closed captioning", "beginner", "video"],
  },
  {
    slug: "subtitle-jobs-from-home",
    title: "Subtitle Jobs From Home",
    blurb: "Subtitling vs captioning vs transcription, who hires subtitle freelancers, what it pays, and how to get started.",
    category: "Captioning",
    tags: ["subtitles", "captioning", "translation", "work from home"],
  },
  {
    slug: "transcriptionist-salary",
    title: "Transcriptionist Salary",
    blurb: "The honest math behind transcription pay: per audio minute rates, real work time, and monthly earnings scenarios.",
    category: "Pay & Salary",
    tags: ["salary", "pay", "transcription", "per audio hour"],
  },
];
