import { describe, expect, it } from "vitest";
import { PRODUCT_DOCS } from "@/data/api-reference";

const references = Object.entries(PRODUCT_DOCS.scoring.reference);

describe("Writing Scoring reference examples", () => {
  it.each(references)(
    "%s quotes its own essay verbatim in every annotation",
    (slug, reference) => {
      const essay = (reference.requestExample as { essay: string }).essay;
      const { annotations } = (
        reference.responseExample as {
          data: { annotations: { quote: string }[] };
        }
      ).data;

      expect(annotations.length).toBeGreaterThan(0);
      for (const annotation of annotations) {
        expect(essay, `${slug}: "${annotation.quote}"`).toContain(
          annotation.quote
        );
      }
    }
  );

  it.each(references)(
    "%s grades on the four contract criteria, in contract order",
    (slug, reference) => {
      const { criteria } = (
        reference.responseExample as { data: { criteria: { id: string }[] } }
      ).data;

      expect(criteria.map((criterion) => criterion.id)).toEqual([
        slug === "grade-task1" ? "task_achievement" : "task_response",
        "coherence_cohesion",
        "lexical_resource",
        "grammatical_range_accuracy",
      ]);
    }
  );
});
