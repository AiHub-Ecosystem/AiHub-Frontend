export type WritingCriterion = {
  id: string;
  name: string;
  band: number;
  band_reason: string;
  strengths: string[];
  improvements: string[];
};

/**
 * The four criteria a grade is reported against. Task 1 leads with
 * Task Achievement, Task 2 with Task Response; the other three are shared. An
 * id outside this set, or a repeat of one, is not a grade.
 */
const CRITERION_IDS = new Set([
  "task_achievement",
  "task_response",
  "coherence_cohesion",
  "lexical_resource",
  "grammatical_range_accuracy",
]);

/**
 * `issue` is a free string, not an enum: the downstream issue keys vary per
 * run and the backend adapter flattens them deliberately. Do not look it up in
 * a fixed error-code list — the demo renders it as the string it is.
 */
export type WritingAnnotation = {
  criterion: string;
  issue: string;
  quote: string;
  explanation: string;
};

export type WritingGradingData = {
  overall_band: number;
  language: string;
  criteria: WritingCriterion[];
  summary: string;
  suggestions: string[];
  next_steps: string[];
  annotations: WritingAnnotation[];
};

export type WritingGradingEnvelope = {
  data: WritingGradingData;
  meta: {
    request_id: string;
    correlation_id?: string;
    service?: string;
    operation?: string;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Band runs 0 to 9 in half steps. */
function isBand(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 9 &&
    Number.isInteger(value * 2)
  );
}

function isStringList(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function parseCriteria(value: unknown): WritingCriterion[] | null {
  if (!Array.isArray(value)) return null;
  const criteria = value.map((item) => {
    if (!isRecord(item)) return null;
    const { id, name, band, band_reason, strengths, improvements } = item;
    if (
      typeof id !== "string" ||
      !CRITERION_IDS.has(id) ||
      typeof name !== "string" ||
      !isBand(band) ||
      typeof band_reason !== "string" ||
      !isStringList(strengths) ||
      !isStringList(improvements)
    ) {
      return null;
    }
    return { id, name, band, band_reason, strengths, improvements };
  });
  if (criteria.some((item) => item === null)) return null;
  // The upstream contract fixes the count at four and the ids are distinct, so
  // a short, padded or duplicated array is a contract violation rather than a
  // grade. Rendering it as a successful result would show a rubric that is
  // missing a criterion the reader is being graded against.
  if (criteria.length !== 4) return null;
  const ids = new Set(criteria.map((item) => item!.id));
  return ids.size === 4 ? (criteria as WritingCriterion[]) : null;
}

function parseAnnotations(value: unknown): WritingAnnotation[] | null {
  if (!Array.isArray(value)) return null;
  const annotations = value.map((item) => {
    if (!isRecord(item)) return null;
    const { criterion, issue, quote, explanation } = item;
    if (
      typeof criterion !== "string" ||
      typeof issue !== "string" ||
      typeof quote !== "string" ||
      typeof explanation !== "string"
    ) {
      return null;
    }
    return { criterion, issue, quote, explanation };
  });
  return annotations.some((item) => item === null)
    ? null
    : (annotations as WritingAnnotation[]);
}

function parseData(value: unknown): WritingGradingData | null {
  if (!isRecord(value)) return null;
  const {
    overall_band,
    language,
    criteria,
    summary,
    suggestions,
    next_steps,
    annotations,
  } = value;
  if (
    !isBand(overall_band) ||
    typeof language !== "string" ||
    typeof summary !== "string" ||
    !isStringList(suggestions) ||
    !isStringList(next_steps)
  ) {
    return null;
  }
  const parsedCriteria = parseCriteria(criteria);
  const parsedAnnotations = parseAnnotations(annotations);
  if (!parsedCriteria || !parsedAnnotations) return null;
  return {
    overall_band,
    language,
    criteria: parsedCriteria,
    summary,
    suggestions,
    next_steps,
    annotations: parsedAnnotations,
  };
}

export function parseWritingGradingEnvelope(
  input: unknown
): WritingGradingEnvelope | null {
  if (!isRecord(input)) return null;
  // `request_id` is what the report prints, so it is required rather than cast:
  // an envelope without it is not one this demo can render.
  if (!isRecord(input.meta)) return null;
  const requestId = input.meta.request_id;
  if (typeof requestId !== "string") return null;
  const data = parseData(input.data);
  if (!data) return null;
  const meta = input.meta;
  return {
    data,
    meta: {
      request_id: requestId,
      ...(typeof meta.correlation_id === "string"
        ? { correlation_id: meta.correlation_id }
        : {}),
      ...(typeof meta.service === "string" ? { service: meta.service } : {}),
      ...(typeof meta.operation === "string"
        ? { operation: meta.operation }
        : {}),
    },
  };
}

export function isWritingGradingEnvelope(
  input: unknown
): input is WritingGradingEnvelope {
  return parseWritingGradingEnvelope(input) !== null;
}
