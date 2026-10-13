export type SpeakingPart = 1 | 2 | 3;

export type SpeakingPrompt = {
  id: string;
  part: SpeakingPart;
  question: string;
  cue?: string;
  sampleAudioUrl?: string;
};

/** Static examples used by mock mode; this list is never fetched from the API. */
export const MOCK_SPEAKING_PROMPTS: readonly SpeakingPrompt[] = [
  {
    id: "p1_do-you-enjoy-living-in-your-city-or-hometown",
    part: 1,
    question: "Do you enjoy living in your city or hometown?",
  },
  {
    id: "p1_how-often-do-you-use-public-transport",
    part: 1,
    question: "How often do you use public transport?",
  },
  {
    id: "p2_describe-a-book-you-recently-read-that-you-found-useful",
    part: 2,
    question: "Describe a book you recently read that you found useful.",
    cue: "You should say what it was about, when you read it, why it was useful, and explain how you felt about it.",
  },
  {
    id: "p2_describe-a-time-that-you-showed-something-new-to-others",
    part: 2,
    question: "Describe a time that you showed something new to others.",
    cue: "You should say what you showed, who you showed it to, how you showed it, and explain how you felt about it.",
  },
  {
    id: "p3_do-you-agree-that-travel-broadens-peoples-horizons-and-minds",
    part: 3,
    question: "Do you agree that travel broadens people's horizons and minds?",
  },
  {
    id: "p3_do-you-think-governments-should-continue-to-fund-public-libraries",
    part: 3,
    question: "Do you think governments should continue to fund public libraries?",
  },
];
