/**
 * A Speaking question from AIHUB's published catalog, as
 * GET /v1/ielts/speaking/questions returns it.
 */
export type SpeakingQuestion = {
  readonly question_id: string;
  readonly part: 1 | 2 | 3;
  readonly prompt_text: string;
};

/**
 * Real Speaking questions the Console's examples name, copied from production
 * `GET /v1/ielts/speaking/questions?part=1`. This is a copy of backend data
 * with no synchronization: the catalog's IDs are slugs of its audio object
 * names, so renaming or removing an object on AIHUB's side leaves these
 * examples naming a question that no longer exists. Update this list when the
 * catalog changes; nothing else will notice.
 */
export const SPEAKING_CATALOG_EXAMPLE: readonly SpeakingQuestion[] = [
  // The question the Published sample answer below answers, so the two cannot
  // drift apart here.
  {
    question_id: "p1_do-you-enjoy-living-in-your-city-or-hometown",
    part: 1,
    prompt_text: "Do you enjoy living in your city or hometown?",
  },
  {
    question_id: "p1_how-often-do-you-use-public-transport",
    part: 1,
    prompt_text: "How often do you use public transport?",
  },
];

/** The Speaking question every Speaking request example answers. */
export const SPEAKING_SAMPLE_QUESTION = SPEAKING_CATALOG_EXAMPLE[0];

/**
 * The Published sample answer for SPEAKING_SAMPLE_QUESTION: a stable, unsigned
 * public copy of one answer recording, so a copied Sample request runs with
 * nothing on the holder's machine but the key. Copied from aihub-be ADR-0062
 * with no synchronization, like the Speaking question above: if AIHUB moves or
 * removes the object, the examples keep sending this URL and nothing here
 * fails. Update it by hand when the backend's copy changes.
 */
export const PUBLISHED_SAMPLE_ANSWER_URL =
  "https://s3.wispace.app/ielts-task1/speaking-answers/part-1/do-you-enjoy-living-in-your-city-or-hometown.webm";

/**
 * The one grading-json body every Speaking example sends: the Published sample
 * answer and the Speaking question it answers. The Console's Sample request and
 * the API reference both send exactly this, so they cannot disagree. It sends
 * no transcript, because a transcript that is not in the recording would be
 * graded instead of the audio.
 */
export const SPEAKING_SAMPLE_ANSWER_REQUEST = {
  audio_url: PUBLISHED_SAMPLE_ANSWER_URL,
  part: SPEAKING_SAMPLE_QUESTION.part,
  question_id: SPEAKING_SAMPLE_QUESTION.question_id,
  prompt_text: SPEAKING_SAMPLE_QUESTION.prompt_text,
  test_type: "Practice",
} as const;

/**
 * The shape of a Speaking question's audio_url, abbreviated: a sample answer
 * recording, signed into the private bucket for 15 minutes. Derived
 * from the question, so the ID and the object name cannot drift apart here.
 */
export function speakingQuestionAudioUrlExample({
  question_id,
  part,
}: SpeakingQuestion): string {
  const slug = question_id.replace(/^p\d_/, "");
  return `https://s3.wispace.app/aihub-speaking-samples/speaking-samples/part-${part}/${slug}.webm?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=900&X-Amz-Signature=…`;
}
