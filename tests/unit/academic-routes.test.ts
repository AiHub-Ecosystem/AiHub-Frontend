import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as acceptSample } from "@/app/api/portal/academic/samples/accept/route";
import { POST as generateExercise } from "@/app/api/demo/exercise-generation/generate/route";

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.CUSTOMER_WEB_ORIGIN;
});

describe("Academic routes", () => {
  it("refuses a cross-site sample decision before checking the session or calling upstream", async () => {
    process.env.CUSTOMER_WEB_ORIGIN = "http://localhost:3100";
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("Unexpected upstream request"));

    const response = await acceptSample(
      new Request("http://localhost:3100/api/portal/academic/samples/accept", {
        method: "POST",
        headers: {
          Origin: "https://evil.example",
          Cookie: `__Host-aihub_web_session=${"w".repeat(43)}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: "sample_1" }),
      })
    );

    expect(response.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not let an anonymous caller choose how many questions to generate", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ data: { exercise: [] } }));

    await generateExercise(
      new Request("http://localhost/api/demo/exercise-generation/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          writingTask: 2,
          topic: "environment",
          criterion: "coherence_cohesion",
          errorCode: "disorganized_structure",
          references: [{ prompt: "p" }],
          numQuestions: 1000,
        }),
      })
    );

    const sent = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body));
    expect(sent.num_questions).toBe(3);
  });
});
