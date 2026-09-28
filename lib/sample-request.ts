import {
  WRITING_TASK1_CHART_TYPES,
  WRITING_TASK1_IMAGE_NOTE,
  WRITING_TASK1_REQUEST,
} from "@/data/writing-task1-request";
import { SPEAKING_SAMPLE_ANSWER_REQUEST } from "@/data/speaking-question";
import { WRITING_TASK2_REQUEST } from "@/data/writing-task2-request";
import type { ApiKeyScope } from "@/lib/api-key-scopes";
import {
  SANDBOX_ORGANIZATION_MONTHLY_ALLOWANCE,
  type ApiKeyEnvironment,
  type OrganizationApiKey,
} from "@/lib/api-keys";

const WRITING_SCOPE = "writing.grade";
const SPEAKING_SCOPE = "speaking.grade";

const writingTask1Path = "/v1/ielts/writing/task1/grade";
const writingPath = "/v1/ielts/writing/task2/grade";
const speakingGradingJsonPath = "/v1/ielts/speaking/grading-json";

/**
 * Public host per Environment. An Environment absent here has no runnable
 * command, because AIHUB publishes no host for it. The backend keeps these as
 * deployment configuration and the Console keeps them here as a constant; see
 * ADR-0009 for that trade-off and the coupling it accepts.
 */
const ENVIRONMENT_HOSTS: Partial<Record<ApiKeyEnvironment, string>> = {
  production: "https://api.aihubproduction.com",
  sandbox: "https://sandbox.aihubproduction.com",
};

/**
 * Consulted in order for a key that allows more than one Environment. Sandbox
 * comes first so a first call still costs the Organization nothing.
 */
const HOST_PREFERENCE: ApiKeyEnvironment[] = ["sandbox", "production"];

/**
 * A Sample request carries the raw key only when the holder supplies it in the
 * browser (ADR-0013); otherwise its command reads the key from the holder's
 * environment and stops when it is unset. A supplied key has passed
 * isRawKeyFor, so it holds no quote that could break out of the shell string.
 */
function bashKeyLine(rawKey?: string): string {
  return rawKey
    ? `API_KEY='${rawKey}'`
    : 'API_KEY="${API_KEY:?Chạy export API_KEY=<API key của bạn> trước}"';
}

/** A local $apiKey, so a pasted command never overwrites $env:API_KEY. */
function powershellKeyLines(rawKey?: string): string[] {
  return rawKey
    ? [`  $apiKey = '${rawKey}'`]
    : [
        "  $apiKey = $env:API_KEY",
        // Stops the whole block, not one line, when the key is not set.
        `  if (-not $apiKey) { throw 'Chạy $env:API_KEY = "<API key của bạn>" trước' }`,
      ];
}

/** One JSON request, as every shell's command sends it. */
type JsonRequest = {
  url: string;
  body: object;
  /** Absent for a request AIHUB accepts no Idempotency-Key on. */
  idempotencyKey?: string;
};

type SampleCommands = Pick<
  SampleRequest,
  "command" | "powershellCommand" | "postmanCommand"
>;

/** For a Bash-compatible shell: shell variables, and the body as a heredoc. */
function bashJsonCommand(
  { url, body, idempotencyKey }: JsonRequest,
  { identity, rawKey }: BuildContext
): string {
  return [
    bashKeyLine(rawKey),
    `USER_IDENTITY='${identity.value}'`,
    ...(idempotencyKey ? [`IDEMPOTENCY_KEY='${idempotencyKey}'`] : []),
    "",
    "curl --request POST \\",
    `  '${url}' \\`,
    `  --header "X-API-Key: \${API_KEY}" \\`,
    `  --header "X-User-Identity: \${USER_IDENTITY}" \\`,
    `  --header "Content-Type: application/json" \\`,
    ...(idempotencyKey
      ? [`  --header "Idempotency-Key: \${IDEMPOTENCY_KEY}" \\`]
      : []),
    "  --data-binary @- <<'JSON'",
    JSON.stringify(body, null, 2),
    "JSON",
  ].join("\n");
}

/**
 * The same request for Windows PowerShell 5.1 and PowerShell 7. It calls
 * curl.exe, which ships with Windows 10 and later, rather than the `curl`
 * alias, and wraps everything in one block so a missing key stops it all.
 */
function powershellJsonCommand(
  { url, body, idempotencyKey }: JsonRequest,
  { identity, rawKey }: BuildContext
): string {
  const call = [
    "  curl.exe --request POST",
    `    '${url}'`,
    '    --header "X-API-Key: $apiKey"',
    '    --header "X-User-Identity: $userIdentity"',
    "    --header 'Content-Type: application/json'",
    ...(idempotencyKey
      ? ['    --header "Idempotency-Key: $idempotencyKey"']
      : []),
    '    --data-binary "@$bodyFile"',
  ];
  return [
    "& {",
    // Shows the Vietnamese in the response, and writes the body without a BOM.
    "  $utf8 = New-Object System.Text.UTF8Encoding $false",
    "  [Console]::OutputEncoding = $utf8",
    ...powershellKeyLines(rawKey),
    `  $userIdentity = '${identity.value}'`,
    ...(idempotencyKey ? [`  $idempotencyKey = '${idempotencyKey}'`] : []),
    // A here-string's closing '@ must start its line.
    "  $body = @'",
    JSON.stringify(body, null, 2),
    "'@",
    // Windows PowerShell 5.1 prefixes a BOM to anything piped to curl.exe,
    // whatever $OutputEncoding says, so the body goes through a file.
    "  $bodyFile = [IO.Path]::GetTempFileName()",
    "  [IO.File]::WriteAllText($bodyFile, $body, $utf8)",
    ...call.map((line, index) =>
      index < call.length - 1 ? `${line} \`` : line
    ),
    "}",
  ].join("\n");
}

/** Single-quotes a value the way a POSIX shell, and Postman's importer, read it. */
function singleQuoted(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

/**
 * A plain curl for Postman's Import > Raw text, which reads no shell variables
 * or heredocs: every value is written out. Without a supplied raw key the key is
 * {{API_KEY}}, a Postman variable the holder sets once in an environment.
 */
function postmanJsonCommand(
  { url, body, idempotencyKey }: JsonRequest,
  { identity, rawKey }: BuildContext
): string {
  const headers: [string, string][] = [
    ["X-API-Key", rawKey ?? "{{API_KEY}}"],
    ["X-User-Identity", identity.value],
    ["Content-Type", "application/json"],
    ...(idempotencyKey
      ? ([["Idempotency-Key", idempotencyKey]] as [string, string][])
      : []),
  ];
  const lines = [
    `curl --request POST ${singleQuoted(url)}`,
    ...headers.map(
      ([name, value]) => `  --header ${singleQuoted(`${name}: ${value}`)}`
    ),
    `  --data-raw ${singleQuoted(JSON.stringify(body, null, 2))}`,
  ];
  return lines
    .map((line, index) => (index < lines.length - 1 ? `${line} \\` : line))
    .join("\n");
}

/** Every shell's command for one request; none where there is no public host. */
function jsonCommands(
  request: JsonRequest | null,
  context: BuildContext
): SampleCommands {
  return request
    ? {
        command: bashJsonCommand(request, context),
        powershellCommand: powershellJsonCommand(request, context),
        postmanCommand: postmanJsonCommand(request, context),
      }
    : { command: null, powershellCommand: null, postmanCommand: null };
}

function resolveHost(apiKey: OrganizationApiKey): string | null {
  for (const environment of HOST_PREFERENCE) {
    const host = ENVIRONMENT_HOSTS[environment];
    if (host && apiKey.allowed_environments.includes(environment)) return host;
  }
  return null;
}

function endpoint(host: string | null, path: string): string {
  return host ? `${host}${path}` : path;
}

/** Whether the command's call is charged; null when there is no command. */
export type SampleBilling = "paid" | "free" | null;

function billing(host: string | null): SampleBilling {
  if (host === null) return null;
  return host === ENVIRONMENT_HOSTS.sandbox ? "free" : "paid";
}

/** Empty when there is no runnable command, so the page renders it nowhere. */
function usageNote(host: string | null): string {
  if (host === ENVIRONMENT_HOSTS.sandbox)
    return `Lệnh này miễn phí và không tính vào hạn mức trả phí của Organization. Sandbox cho phép ${SANDBOX_ORGANIZATION_MONTHLY_ALLOWANCE} lần chấm mỗi tháng tính theo Organization, không tính theo key, nên thu hồi rồi tạo key mới không làm hồi lại hạn mức. Hết hạn mức thì request trả về 429 QUOTA_EXCEEDED, và hạn mức hồi lại lúc 00:00 UTC ngày 1 của tháng sau.`;
  if (host === null) return "";
  return "Lệnh gửi request thật và tính vào hạn mức sử dụng của Organization.";
}

type SampleHeader = {
  name: string;
  value: string;
  meaning: string;
};

/** One row of a request body, whichever request it describes. */
export type SampleBodyField = {
  field: string;
  sampleValue: string;
  required: boolean;
  meaning: string;
};

export type SampleRequestKind = "writing-task1" | "writing-task2" | "speaking";

export type SampleRequest = {
  /**
   * Identifies this request, and is the only thing the tab list derives its
   * selected tab, its key, and every element id from. Not the scope: one scope
   * covers more than one operation and will yield more than one request here.
   */
  kind: SampleRequestKind;
  label: string;
  method: "POST";
  url: string;
  headers: SampleHeader[];
  body: SampleBodyField[];
  identityNote: string;
  expectedOutcomeFields: string[];
  /** The criterion the response leads with; it differs per Writing request. */
  firstCriterion: string;
  note: string;
  usageNote: string;
  billing: SampleBilling;
  /** For a Bash-compatible shell. */
  command: string | null;
  /** The same request for PowerShell on Windows. */
  powershellCommand: string | null;
  /** The same request as a plain curl for Postman's importer. */
  postmanCommand: string | null;
};

type SpeakingField =
  | "audio_url"
  | "part"
  | "question_id"
  | "prompt_text"
  | "test_type"
  | "test_code"
  | "transcript";

/** A row of the Speaking body table: one the body sends, or one it only documents. */
type SpeakingJsonField = {
  field: SpeakingField;
  required: boolean;
  meaning: string;
} & (
  | { sent: true; value: string | number }
  | { sent: false; documentedValue: string }
);

/**
 * The Speaking body table, in the order the body sends its fields, so the
 * table and the command cannot teach two different orders. Required flags
 * follow the AIHUB Speaking grading contract.
 */
const SPEAKING_JSON_FIELDS: SpeakingJsonField[] = [
  {
    field: "audio_url",
    sent: true,
    value: SPEAKING_SAMPLE_ANSWER_REQUEST.audio_url,
    required: true,
    meaning:
      "URL HTTPS của tệp âm thanh trả lời, trên đúng host s3.wispace.app; thay bằng URL của bạn. wav, mp3, m4a, webm hoặc ogg; tối đa 25 MiB.",
  },
  {
    field: "part",
    sent: true,
    value: SPEAKING_SAMPLE_ANSWER_REQUEST.part,
    required: true,
    meaning: "Phần của bài Speaking: 1, 2 hoặc 3.",
  },
  {
    field: "question_id",
    sent: true,
    value: SPEAKING_SAMPLE_ANSWER_REQUEST.question_id,
    required: true,
    meaning:
      "Một câu hỏi thật trong danh mục Speaking của AIHUB; lấy câu hỏi khác từ GET /v1/ielts/speaking/questions và thay bằng câu hỏi bạn trả lời.",
  },
  {
    field: "prompt_text",
    sent: true,
    value: SPEAKING_SAMPLE_ANSWER_REQUEST.prompt_text,
    required: false,
    meaning: "Tuỳ chọn; prompt dùng để đánh giá độ liên quan.",
  },
  {
    field: "test_type",
    sent: true,
    value: SPEAKING_SAMPLE_ANSWER_REQUEST.test_type,
    required: false,
    meaning: "Tuỳ chọn; ví dụ Practice hoặc Full-test.",
  },
  {
    field: "test_code",
    sent: false,
    documentedValue: "ielts-practice-01",
    required: false,
    meaning:
      "Tuỳ chọn; mã chung cho các câu hỏi thuộc cùng một bài kiểm tra đầy đủ.",
  },
  {
    field: "transcript",
    sent: false,
    documentedValue: "",
    required: false,
    meaning:
      "Tuỳ chọn; transcript có sẵn, dùng khi nhà cung cấp hỗ trợ bỏ qua STT. Ví dụ không gửi, vì transcript không khớp bản ghi sẽ được chấm thay cho audio.",
  },
];

type ResolvedIdentity = { value: string; meaning: string; note: string };

function resolveIdentity(
  identityConfigured: boolean | undefined
): ResolvedIdentity {
  return identityConfigured === false
    ? {
        value: "test-user-1",
        meaning:
          "Declared User ID khi Organization không có Identity configuration đang hoạt động.",
        note: "Organization không có Identity configuration đang hoạt động; test-user-1 được gửi dưới dạng Declared User ID.",
      }
    : {
        value: "<user-assertion>",
        meaning:
          "User Assertion có chữ ký từ identity provider của Organization.",
        note: "X-User-Identity phải là User Assertion có chữ ký từ identity provider của Organization. Nếu AIHUB đã vô hiệu hóa cấu hình, có thể gửi End-User ID trực tiếp.",
      };
}

function apiKeyHeader(apiKey: OrganizationApiKey): SampleHeader {
  return {
    name: "X-API-Key",
    value: `${apiKey.key_prefix}…`,
    meaning: "API key của Organization; bảng chỉ hiển thị tiền tố.",
  };
}

/**
 * What each field means to a holder reading the Sample request. The row order
 * comes from the request object, so the table and the command can never teach
 * two different orders.
 */
const WRITING_TASK1_MEANINGS: Record<
  keyof typeof WRITING_TASK1_REQUEST,
  string
> = {
  question: "Đề bài mô tả biểu đồ Task 1 cần trả lời.",
  chart_type: `Loại biểu đồ, phân biệt HOA THƯỜNG, đúng một trong: ${WRITING_TASK1_CHART_TYPES.join(
    " | "
  )}. Gửi một chủ đề như "environment" sẽ bị 400.`,
  image_url: "Ảnh biểu đồ dạng HTTP(S); bắt buộc và phải tải được.",
  essay: "Bài viết mô tả biểu đồ.",
};

function buildWritingTask1(context: BuildContext): SampleRequest {
  const { apiKey, host, identity, idempotencyKey } = context;
  const body: SampleBodyField[] = (
    Object.keys(WRITING_TASK1_REQUEST) as (keyof typeof WRITING_TASK1_REQUEST)[]
  ).map((field) => ({
    field,
    sampleValue: WRITING_TASK1_REQUEST[field],
    required: true,
    meaning: WRITING_TASK1_MEANINGS[field],
  }));
  const headers: SampleHeader[] = [
    apiKeyHeader(apiKey),
    {
      name: "X-User-Identity",
      value: identity.value,
      meaning: identity.meaning,
    },
    {
      name: "Content-Type",
      value: "application/json",
      meaning: "Body của request có định dạng JSON.",
    },
    {
      name: "Idempotency-Key",
      value: idempotencyKey,
      meaning: "Chạy lại cùng body trong 24 giờ sẽ phát lại kết quả đã lưu.",
    },
  ];
  return {
    kind: "writing-task1",
    label: "Writing Task 1",
    method: "POST",
    url: endpoint(host, writingTask1Path),
    headers,
    body,
    identityNote: identity.note,
    expectedOutcomeFields: ["overall_band", "criteria", "summary"],
    firstCriterion: "task_achievement",
    note: WRITING_TASK1_IMAGE_NOTE,
    usageNote: usageNote(host),
    billing: billing(host),
    ...jsonCommands(
      host
        ? {
            url: endpoint(host, writingTask1Path),
            body: WRITING_TASK1_REQUEST,
            idempotencyKey,
          }
        : null,
      context
    ),
  };
}

function buildWriting(context: BuildContext): SampleRequest {
  const { apiKey, host, identity, idempotencyKey } = context;
  const body: SampleBodyField[] = [
    {
      field: "question",
      sampleValue: WRITING_TASK2_REQUEST.question,
      required: true,
      meaning: "Đề bài Writing Task 2 cần trả lời.",
    },
    {
      field: "topic",
      sampleValue: WRITING_TASK2_REQUEST.topic,
      required: true,
      meaning: "Chủ đề dùng để đánh giá bài luận.",
    },
    {
      field: "essay",
      sampleValue: WRITING_TASK2_REQUEST.essay,
      required: true,
      meaning: "Bài viết trả lời câu hỏi.",
    },
  ];
  const headers: SampleHeader[] = [
    apiKeyHeader(apiKey),
    {
      name: "X-User-Identity",
      value: identity.value,
      meaning: identity.meaning,
    },
    {
      name: "Content-Type",
      value: "application/json",
      meaning: "Body của request có định dạng JSON.",
    },
    {
      name: "Idempotency-Key",
      value: idempotencyKey,
      meaning: "Chạy lại cùng body trong 24 giờ sẽ phát lại kết quả đã lưu.",
    },
  ];
  return {
    kind: "writing-task2",
    label: "Writing Task 2",
    method: "POST",
    url: endpoint(host, writingPath),
    headers,
    body,
    identityNote: identity.note,
    expectedOutcomeFields: ["overall_band", "criteria", "summary"],
    firstCriterion: "task_response",
    note: "Chạy lại cùng body với Idempotency-Key này sẽ phát lại kết quả đã lưu trong 24 giờ. Bài nộp mới cần một UUID mới.",
    usageNote: usageNote(host),
    billing: billing(host),
    ...jsonCommands(
      host
        ? {
            url: endpoint(host, writingPath),
            body: WRITING_TASK2_REQUEST,
            idempotencyKey,
          }
        : null,
      context
    ),
  };
}

function buildSpeaking(context: BuildContext): SampleRequest {
  const { apiKey, host, identity } = context;
  const headers: SampleHeader[] = [
    apiKeyHeader(apiKey),
    {
      name: "X-User-Identity",
      value: identity.value,
      meaning: identity.meaning,
    },
    {
      name: "Content-Type",
      value: "application/json",
      meaning: "Body của request có định dạng JSON.",
    },
  ];
  const body: SampleBodyField[] = SPEAKING_JSON_FIELDS.map((row) => ({
    field: row.field,
    sampleValue: row.sent ? String(row.value) : row.documentedValue,
    required: row.required,
    meaning: row.meaning,
  }));
  return {
    kind: "speaking",
    label: "Speaking",
    method: "POST",
    url: endpoint(host, speakingGradingJsonPath),
    headers,
    body,
    identityNote: identity.note,
    expectedOutcomeFields: ["scorability", "estimated_band", "transcript"],
    firstCriterion: "scorability",
    note: "Ví dụ này gửi Published sample answer của AIHUB nên chạy được ngay, không cần tệp nào trên máy bạn. Để chấm audio của bạn, hãy upload tệp lên POST /v1/ielts/speaking/grading, hoặc truyền audio_url của bạn trên host s3.wispace.app. AIHUB chưa hỗ trợ Idempotency-Key cho Speaking. Chạy lại lệnh này sẽ chấm bài và tính phí thêm một lần nữa.",
    usageNote: usageNote(host),
    billing: billing(host),
    // No Idempotency-Key: AIHUB accepts none on Speaking yet.
    ...jsonCommands(
      host
        ? {
            url: endpoint(host, speakingGradingJsonPath),
            body: SPEAKING_SAMPLE_ANSWER_REQUEST,
          }
        : null,
      context
    ),
  };
}

type BuildContext = {
  apiKey: OrganizationApiKey;
  host: string | null;
  identity: ResolvedIdentity;
  idempotencyKey: string;
  rawKey?: string;
};

export type SampleRequestEntry = {
  scope: ApiKeyScope;
  build: (context: BuildContext) => SampleRequest;
};

/** Fixed display order, not the order the key's scopes arrive in. */
const SAMPLE_REQUESTS: SampleRequestEntry[] = [
  { scope: WRITING_SCOPE, build: buildWritingTask1 },
  { scope: WRITING_SCOPE, build: buildWriting },
  { scope: SPEAKING_SCOPE, build: buildSpeaking },
];

export function buildSampleRequests({
  apiKey,
  identityConfigured,
  idempotencyKey,
  rawKey,
}: {
  apiKey: OrganizationApiKey;
  identityConfigured?: boolean;
  idempotencyKey: string;
  /** Only one isRawKeyFor accepted for this key; see ADR-0013. */
  rawKey?: string;
}): SampleRequest[] {
  const identity = resolveIdentity(identityConfigured);
  const context = {
    apiKey,
    host: resolveHost(apiKey),
    identity,
    idempotencyKey,
    rawKey,
  };
  return SAMPLE_REQUESTS.filter((entry) =>
    apiKey.scopes.includes(entry.scope)
  ).map((entry) => entry.build(context));
}

/** Shown wherever a command carrying the raw key can be copied. */
export const RAW_KEY_IN_COMMAND_WARNING =
  "Lệnh đã chứa API key. Đừng chia sẻ lệnh này, và key có thể còn lại trong lịch sử của shell.";

const RAW_KEY_FORMAT = /^aihub_sk_[A-Za-z0-9]{43}$/;

/**
 * Whether a value the holder supplies is this key's raw key: the backend's key
 * format, starting with the key's own display prefix. Surrounding whitespace
 * from a paste is ignored; the caller passes the trimmed value on.
 */
export function isRawKeyFor(
  apiKey: OrganizationApiKey,
  value: string
): boolean {
  const candidate = value.trim();
  return (
    RAW_KEY_FORMAT.test(candidate) && candidate.startsWith(apiKey.key_prefix)
  );
}

/** The Console path of an API key's Quickstart. */
export function quickstartPath(organizationId: string, apiKeyId: string) {
  return `/console/orgs/${encodeURIComponent(organizationId)}/api-keys/${encodeURIComponent(apiKeyId)}/quickstart`;
}

/** An active key with at least one Sample request; see Quickstart in CONTEXT.md. */
export function hasQuickstart(apiKey: OrganizationApiKey): boolean {
  return (
    apiKey.status === "active" &&
    SAMPLE_REQUESTS.some((entry) => apiKey.scopes.includes(entry.scope))
  );
}
