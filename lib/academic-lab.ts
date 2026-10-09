export type AcademicAnswerDetails = {
  sample_answer?: string;
  answer?: string;
  ai_grading_rubric?: string;
  explanation?: string;
};

export type AcademicCorrectAnswer =
  string | Array<string | number> | number | AcademicAnswerDetails | null;

export type AcademicExercise = {
  questions_no?: number | string;
  question_text?: string;
  question?: string;
  question_image?: string | null;
  image?: string | null;
  image_url?: string | null;
  imageUrl?: string | null;
  chart?: string | null;
  options?: Record<string, string>;
  choices?: string[];
  items?: string[];
  correct?: AcademicCorrectAnswer;
  hint?: string[] | string;
  ai_grading_rubric?: string;
  explanation?: string;
};

export type AcademicGeneratedSample = {
  image?: string;
  image_url?: string;
  imageUrl?: string;
  chart?: string;
  data?: { image?: string; image_url?: string; imageUrl?: string };
  question?: { image?: string; image_url?: string };
  meta?: {
    instruction?: string;
    type?: string;
    number_of_questions?: number;
    difficulty?: string;
  };
  output: {
    meta: {
      instruction: string;
      type?: string;
      number_of_questions?: number;
      difficulty?: string;
    };
    exercise: AcademicExercise[];
  };
  exercise?: AcademicExercise[];
};

export type AcademicReference = {
  id?: string;
  prompt?: string;
  questionType?: string;
  quote?: string;
  explanation?: string;
  question?: {
    prompt: string;
    image: string | null;
    question_type: string;
  };
  comments?: Array<{ quote: string; explanation: string }>;
};

export type AcademicReferenceCandidate = {
  prompt?: string;
  imageUrl?: string | null;
  image?: string | null;
  questionType?: string;
  question_type?: string;
  quote?: string;
  explanation?: string;
};

export type AcademicReferenceData = {
  topic: string;
  writing_task: number | null;
  criterion: string;
  error_code: string;
  references: AcademicReference[];
};

export type AcademicSampleRecord = {
  id: string;
  createdAt?: string;
  taskId?: string;
  criterion?: string;
  errorCode?: string;
  questionType?: string;
  topic?: string;
  status?: string;
  isFavorite?: boolean;
  rejectReason?: string;
  score?: number;
  finalOutput?: AcademicGeneratedSample;
  rawAiOutput?: AcademicGeneratedSample;
};

export function answerDetails(
  answer: AcademicCorrectAnswer | undefined
): AcademicAnswerDetails | null {
  return typeof answer === "object" && answer !== null && !Array.isArray(answer)
    ? answer
    : null;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
