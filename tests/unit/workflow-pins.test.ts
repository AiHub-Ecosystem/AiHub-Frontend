import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WORKFLOW_DIR = ".github/workflows";

// A tag can be moved to other code after review; a commit or digest cannot.
const PINNED_USE =
  /^\s*-?\s*uses: [\w.-]+\/[\w./-]+@[0-9a-f]{40} # v\d+\.\d+\.\d+$/;
const DOCKER_RUN_IMAGE = /docker run [^|]*?\s([\w.-]+\/[\w.-]+:[\w.-]+)(\S*)/;

function workflowLines() {
  return readdirSync(WORKFLOW_DIR)
    .filter((file) => /\.ya?ml$/.test(file))
    .flatMap((file) =>
      readFileSync(join(WORKFLOW_DIR, file), "utf8")
        .split(/\r?\n/)
        .map((line, index) => ({ file, line, index }))
    );
}

describe("workflow pins", () => {
  it("pins every action to a full commit SHA with its version beside it", () => {
    const unpinned = workflowLines()
      .filter(({ line }) => /^\s*-?\s*uses: /.test(line))
      .filter(({ line }) => !PINNED_USE.test(line))
      .map(({ file, line, index }) => `${file}:${index + 1}: ${line.trim()}`);

    expect(unpinned).toEqual([]);
  });

  it("pins every third-party tool image to a digest", () => {
    const unpinned = workflowLines()
      .map(({ file, line, index }) => ({
        file,
        index,
        m: DOCKER_RUN_IMAGE.exec(line),
      }))
      .filter(({ m }) => m && !m[2].startsWith("@sha256:"))
      .map(({ file, index, m }) => `${file}:${index + 1}: ${m?.[1]}`);

    expect(unpinned).toEqual([]);
  });

  it("never leaves the job token in a checkout", () => {
    const lines = workflowLines();
    const leaking = lines
      .filter(({ line }) => /uses: actions\/checkout@/.test(line))
      .filter(({ file, index }) => {
        const next = lines
          .filter((other) => other.file === file && other.index > index)
          .slice(0, 8)
          .map((other) => other.line);
        const end = next.findIndex((line) => /^\s*- /.test(line));
        const block = end < 0 ? next : next.slice(0, end);
        return !block.some((line) =>
          /^\s+persist-credentials: false$/.test(line)
        );
      })
      .map(({ file, index }) => `${file}:${index + 1}`);

    expect(leaking).toEqual([]);
  });
});
