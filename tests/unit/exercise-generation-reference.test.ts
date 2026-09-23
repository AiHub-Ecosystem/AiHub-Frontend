import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/demo/exercise-generation/references/route";

afterEach(() => vi.restoreAllMocks());

describe("Exercise Generation references", () => {
  it("rejects invalid input without contacting the upstream service", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("Unexpected upstream request"));
    const request = new Request(
      "http://localhost/api/demo/exercise-generation/references",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: "not-a-topic" }),
      }
    );

    const response = await POST(request);

    expect(response.status).toBe(422);
    expect(fetch).not.toHaveBeenCalled();
  });
});
