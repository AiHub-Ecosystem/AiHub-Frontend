import { describe, expect, it } from "vitest";
import { demoEnvironmentHost } from "@/lib/demo-environments";
import {
  buildDemoExports,
  DEMO_EXPORT_KEY_ENV,
  DEMO_EXPORT_KEY_PLACEHOLDER,
  type DemoExportRequest,
} from "@/lib/demo-export";

const HOSTS = {
  sandbox: demoEnvironmentHost("sandbox"),
  production: demoEnvironmentHost("production"),
};

/**
 * An essay carrying everything a shell would otherwise act on: quote and
 * semicolon terminators, command substitution, a backtick, a redirection, a
 * line break, and a whole second command. Written out as a literal so it cannot
 * drift with whatever the demo prefills.
 */
const HOSTILE_ESSAY =
  "He said \"'; rm -rf /tmp; $(id) `whoami` > /tmp/pwn\n\ncurl https://evil.test\n" +
  "'; AIHUB_API_KEY=leaked; echo done #";

function request(
  overrides: Partial<DemoExportRequest> = {}
): DemoExportRequest {
  return {
    environment: "sandbox",
    skill: "writing",
    title: "Writing Task 1",
    path: "/v1/ielts/writing/task1/grade",
    headers: [
      { name: "X-User-Identity", value: "<your end-user id>" },
      { name: "Content-Type", value: "application/json" },
    ],
    body: {
      task: 1,
      question: `The chart shows ${HOSTILE_ESSAY}`,
      essay: HOSTILE_ESSAY,
      chart_type: "Bar Chart",
      image_url: "https://example.test/chart.png",
    },
    idempotencyKey: "6f1ed729-8d92-4fa6-8e87-0fe6e71e9a17",
    ...overrides,
  };
}

describe("Environment-specific host", () => {
  it("targets the selected environment's host in every artifact", () => {
    for (const environment of ["sandbox", "production"] as const) {
      const exports = buildDemoExports(request({ environment }));
      const host = HOSTS[environment];

      expect(exports.curl).toContain(host);
      expect(exports.powershell).toContain(host);
      expect(exports.postman).toContain(host);
      expect(exports.prompt).toContain(host);
      expect(JSON.stringify(exports)).not.toContain(
        environment === "sandbox" ? HOSTS.production : HOSTS.sandbox
      );
    }
  });
});

describe("The supplied key", () => {
  it("never reaches a copied artifact, only a placeholder", () => {
    const exports = buildDemoExports(request());

    expect(JSON.stringify(exports)).not.toMatch(
      /aihub_(sk|sandbox|prod)_[A-Za-z0-9]{43}/
    );
    expect(exports.curl).toContain(DEMO_EXPORT_KEY_ENV);
    expect(exports.powershell).toContain(DEMO_EXPORT_KEY_ENV);
    expect(exports.prompt).toContain(DEMO_EXPORT_KEY_ENV);
    expect(exports.postman).toContain(DEMO_EXPORT_KEY_PLACEHOLDER);
  });
});

describe("cURL for a Bash-compatible shell", () => {
  it("keeps user-authored text inside a quoted argument instead of a new command", () => {
    const { curl } = buildDemoExports(request());

    expect(
      curl.split("\n").filter((line) => line.includes("rm -rf /tmp"))
    ).toHaveLength(1);
    for (const line of curl
      .split("\n")
      .filter((line) => !line.includes("X-API-Key")))
      expect(
        line === "curl --request POST" ||
          /^ {2}--(url|header|data-raw) '(?:[^']|'\\'')*'( \\)?$/.test(line)
      ).toBe(true);
  });

  it("reads the key from the holder's shell rather than writing it into the command", () => {
    const { curl } = buildDemoExports(request());

    expect(curl).toContain(
      `  --header "X-API-Key: \${${DEMO_EXPORT_KEY_ENV}:?Set ${DEMO_EXPORT_KEY_ENV} to your API key first}"`
    );
  });
});

describe("PowerShell", () => {
  it("doubles the typographic quotes PowerShell reads as single quotes", () => {
    const essay = "it\u2019s; Write-Output PWNED; \u2018x\u201A\u201B";
    const { powershell } = buildDemoExports(request({ body: { essay } }));

    expect(powershell).toContain(
      "\u2019\u2019s; Write-Output PWNED; \u2018\u2018x\u201A\u201A\u201B\u201B"
    );
  });

  it("keeps user-authored text inside the quoted body variable", () => {
    const { powershell } = buildDemoExports(request());

    expect(
      powershell.split("\n").filter((line) => line.includes("rm -rf /tmp"))
    ).toHaveLength(1);
    for (const line of powershell.split("\n"))
      expect(
        line === "& {" ||
          line === "}" ||
          /^ {2}(\$\w+ = |\[IO\.File\]::|curl\.exe |if \(-not )/.test(line) ||
          /^ {4}--\S+ /.test(line)
      ).toBe(true);
  });

  it("continues every flag line but the last, so the block runs as written", () => {
    const lines = buildDemoExports(request()).powershell.split("\n");
    const flags = lines.filter((line) => /^ {2,4}(curl\.exe|--)/.test(line));

    expect(flags.length).toBeGreaterThan(1);
    for (const flag of flags.slice(0, -1))
      expect(flag.endsWith("`")).toBe(true);
    expect(flags.at(-1)?.endsWith("`")).toBe(false);
  });

  it("reads the key from the holder's environment and stops when it is unset", () => {
    const { powershell } = buildDemoExports(request());

    expect(powershell).toContain(`$apiKey = $env:${DEMO_EXPORT_KEY_ENV}`);
    expect(powershell).toContain("if (-not $apiKey) { throw");
  });
});

describe("Postman JSON", () => {
  it("imports as a collection whose body is the request body", () => {
    const exported = request();
    const collection = JSON.parse(buildDemoExports(exported).postman);

    expect(collection.info.schema).toBe(
      "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    );
    expect(collection.item).toHaveLength(1);
    const sent = collection.item[0].request;
    expect(sent.method).toBe("POST");
    expect(sent.url.raw).toBe(`${HOSTS.sandbox}${exported.path}`);
    expect(
      sent.header.find((h: { key: string }) => h.key === "X-API-Key").value
    ).toBe(DEMO_EXPORT_KEY_PLACEHOLDER);
    expect(JSON.parse(sent.body.raw)).toEqual(exported.body);
    expect(
      collection.variable.find(
        (v: { key: string }) => v.key === "aihub_api_key"
      )
    ).toBeDefined();
  });
});

describe("Agent prompt", () => {
  it("never asks for a retry that would spend the visitor's allowance again", () => {
    const { prompt } = buildDemoExports(request({ environment: "production" }));

    expect(prompt).not.toMatch(/retry|repeat|again/i);
  });

  it("keeps the visitor's answer out of the prompt and never asks the agent to execute", () => {
    const { prompt } = buildDemoExports(request());

    expect(prompt).not.toContain(HOSTILE_ESSAY);
    expect(prompt).not.toContain("rm -rf /tmp");
    expect(prompt).toContain("Body: <thay bằng JSON request của bạn");
    expect(prompt).toContain("Không đọc môi trường máy, chạy tool, gọi mạng");
    expect(prompt).toContain("không chạy request");
  });

  it("tells the agent that a Production call can be billed", () => {
    const { prompt } = buildDemoExports(request({ environment: "production" }));

    expect(prompt).toMatch(/có thể phát sinh chi phí/i);
    expect(prompt).toMatch(/để người dùng xem xét trước khi chạy/i);
  });
});
