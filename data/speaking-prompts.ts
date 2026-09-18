export type SpeakingPart = 1 | 2 | 3;

export type SpeakingPrompt = {
  id: string;
  part: SpeakingPart;
  question: string;
  cue?: string;
  sampleAudioUrl?: string;
};
