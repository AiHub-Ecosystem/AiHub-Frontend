export type SpeakingPart = 1 | 2 | 3;

export type SpeakingPrompt = {
  id: string;
  part: SpeakingPart;
  question: string;
  cue?: string;
};

export const SPEAKING_PROMPTS: SpeakingPrompt[] = [
  { id: "p1_hometown", part: 1, question: "Do you like living in your hometown? Why or why not?" },
  { id: "p1_work", part: 1, question: "Do you work or are you a student?" },
  { id: "p1_transport", part: 1, question: "Do you often use public transport?" },
  {
    id: "p2_environment",
    part: 2,
    question: "Describe an environmental problem in your hometown.",
    cue: "You should say what it is, why it matters, and what could change.",
  },
  {
    id: "p2_technology",
    part: 2,
    question: "Describe a technology device you find difficult to use.",
    cue: "You should say what it is, how you use it, and why it is difficult.",
  },
  { id: "p3_green", part: 3, question: "What can governments do to encourage green lifestyles?" },
  { id: "p3_ai", part: 3, question: "Will AI completely replace human teachers?" },
];

export function promptsForPart(part: SpeakingPart) {
  return SPEAKING_PROMPTS.filter((prompt) => prompt.part === part);
}
