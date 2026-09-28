/**
 * The Speaking question AIHUB publishes that every Speaking example names, so a
 * developer copying an example sends an ID the catalog really contains. This is
 * the question aihub-be#196 records a published answer for, so #42 can swap in
 * that answer's audio_url without touching the question again. A drift from the
 * backend's catalog is accepted, as ADR-0009 accepts it for public hosts: the
 * catalog's IDs are slugs of the audio object names, so AIHUB renaming that
 * object changes the ID, and this comment is the only guard.
 */
export const SPEAKING_SAMPLE_QUESTION = {
  question_id: "p1_do-you-enjoy-living-in-your-city-or-hometown",
  prompt_text: "Do you enjoy living in your city or hometown?",
};
