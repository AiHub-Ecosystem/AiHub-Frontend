import {
  WRITING_TASK1_CHART_TYPES,
  WRITING_TASK1_IMAGE_NOTE,
  WRITING_TASK1_REQUEST,
} from "@/data/writing-task1-request";
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
const speakingPath = "/v1/ielts/speaking/grading";

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
 * A Sample request never contains the raw key; see CONTEXT.md. Its command
 * reads the key from the holder's environment and stops when it is unset.
 */
const RAW_KEY_FROM_ENVIRONMENT =
  'API_KEY="${API_KEY:?Chạy export API_KEY=<API key của bạn> trước}"';

/** Stops the whole block, not one line, when the key is not set. */
const POWERSHELL_KEY_GUARD = `if (-not $env:API_KEY) { throw 'Chạy $env:API_KEY = "<API key của bạn>" trước' }`;

/**
 * The same request for Windows PowerShell 5.1 and PowerShell 7. It calls
 * curl.exe, which ships with Windows 10 and later, rather than the `curl`
 * alias, and wraps everything in one block so a missing key stops it all.
 */
function powershellCommand(setup: string[], call: string[]): string {
  return [
    "& {",
    // Shows the Vietnamese in the response, and writes the body without a BOM.
    "  $utf8 = New-Object System.Text.UTF8Encoding $false",
    "  [Console]::OutputEncoding = $utf8",
    `  ${POWERSHELL_KEY_GUARD}`,
    ...setup,
    ...call.map((line, index) =>
      index < call.length - 1 ? `${line} \`` : line
    ),
    "}",
  ].join("\n");
}

function powershellJsonCommand(
  url: string,
  identity: ResolvedIdentity,
  idempotencyKey: string,
  request: object
): string {
  return powershellCommand(
    [
      `  $userIdentity = '${identity.value}'`,
      `  $idempotencyKey = '${idempotencyKey}'`,
      // A here-string's closing '@ must start its line.
      "  $body = @'",
      JSON.stringify(request, null, 2),
      "'@",
      // Windows PowerShell 5.1 prefixes a BOM to anything piped to curl.exe,
      // whatever $OutputEncoding says, so the body goes through a file.
      "  $bodyFile = [IO.Path]::GetTempFileName()",
      "  [IO.File]::WriteAllText($bodyFile, $body, $utf8)",
    ],
    [
      "  curl.exe --request POST",
      `    '${url}'`,
      '    --header "X-API-Key: $env:API_KEY"',
      '    --header "X-User-Identity: $userIdentity"',
      "    --header 'Content-Type: application/json'",
      '    --header "Idempotency-Key: $idempotencyKey"',
      '    --data-binary "@$bodyFile"',
    ]
  );
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

const speakingPromptText = "Do you enjoy living in your hometown?";

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
  contentTypeNote?: string;
  /** For a Bash-compatible shell. */
  command: string | null;
  /** The same request for PowerShell on Windows. */
  powershellCommand: string | null;
};

type SpeakingField =
  | "audio"
  | "part"
  | "question_id"
  | "prompt_text"
  | "test_type"
  | "test_code"
  | "transcript";

type SpeakingFormField = {
  field: SpeakingField;
  /** Sent as the multipart form value. Audio reads the holder's own file. */
  formValue: string;
  /** Shown in the body table, so it differs from the form for audio. */
  sampleValue: string;
  required: boolean;
  /** Whether the sample command sends it; the rest are documented only. */
  sendsInSample: boolean;
  meaning: string;
};

/** Required flags follow the AIHUB Speaking grading contract, not the demo client. */
const SPEAKING_FORM_FIELDS: SpeakingFormField[] = [
  {
    field: "audio",
    formValue: "@${AUDIO_FILE}",
    sampleValue: "./answer.wav",
    required: true,
    sendsInSample: true,
    meaning:
      "File âm thanh bạn trả lời; thay bằng file của bạn. wav, mp3, m4a, webm hoặc ogg; tối đa 25 MiB.",
  },
  {
    field: "part",
    formValue: "1",
    sampleValue: "1",
    required: true,
    sendsInSample: true,
    meaning: "Phần của bài Speaking: 1, 2 hoặc 3.",
  },
  {
    field: "question_id",
    formValue: "p1_hometown",
    sampleValue: "p1_hometown",
    required: true,
    sendsInSample: true,
    meaning: "Giá trị mẫu; thay bằng câu hỏi bạn trả lời.",
  },
  {
    field: "prompt_text",
    formValue: speakingPromptText,
    sampleValue: speakingPromptText,
    required: false,
    sendsInSample: true,
    meaning: "Tuỳ chọn; prompt dùng để đánh giá độ liên quan.",
  },
  {
    field: "test_type",
    formValue: "Practice",
    sampleValue: "Practice",
    required: false,
    sendsInSample: true,
    meaning: "Tuỳ chọn; ví dụ Practice hoặc Full-test.",
  },
  {
    field: "test_code",
    formValue: "ielts-practice-01",
    sampleValue: "ielts-practice-01",
    required: false,
    sendsInSample: false,
    meaning:
      "Tuỳ chọn; mã chung cho các câu hỏi thuộc cùng một bài kiểm tra đầy đủ.",
  },
  {
    field: "transcript",
    formValue: "",
    sampleValue: "",
    required: false,
    sendsInSample: false,
    meaning:
      "Tuỳ chọn; transcript có sẵn, dùng khi nhà cung cấp hỗ trợ bỏ qua STT.",
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

function buildWritingTask1({
  apiKey,
  host,
  identity,
  idempotencyKey,
}: BuildContext): SampleRequest {
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
  const command = host
    ? [
        RAW_KEY_FROM_ENVIRONMENT,
        `USER_IDENTITY='${identity.value}'`,
        `IDEMPOTENCY_KEY='${idempotencyKey}'`,
        "",
        "curl --request POST \\",
        `  '${endpoint(host, writingTask1Path)}' \\`,
        `  --header "X-API-Key: \${API_KEY}" \\`,
        `  --header "X-User-Identity: \${USER_IDENTITY}" \\`,
        `  --header "Content-Type: application/json" \\`,
        `  --header "Idempotency-Key: \${IDEMPOTENCY_KEY}" \\`,
        "  --data-binary @- <<'JSON'",
        JSON.stringify(WRITING_TASK1_REQUEST, null, 2),
        "JSON",
      ].join("\n")
    : null;

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
    command,
    powershellCommand: host
      ? powershellJsonCommand(
          endpoint(host, writingTask1Path),
          identity,
          idempotencyKey,
          WRITING_TASK1_REQUEST
        )
      : null,
  };
}

function buildWriting({
  apiKey,
  host,
  identity,
  idempotencyKey,
}: BuildContext): SampleRequest {
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
  const command = host
    ? [
        RAW_KEY_FROM_ENVIRONMENT,
        `USER_IDENTITY='${identity.value}'`,
        `IDEMPOTENCY_KEY='${idempotencyKey}'`,
        "",
        "curl --request POST \\",
        `  '${endpoint(host, writingPath)}' \\`,
        `  --header "X-API-Key: \${API_KEY}" \\`,
        `  --header "X-User-Identity: \${USER_IDENTITY}" \\`,
        `  --header "Content-Type: application/json" \\`,
        `  --header "Idempotency-Key: \${IDEMPOTENCY_KEY}" \\`,
        "  --data-binary @- <<'JSON'",
        JSON.stringify(WRITING_TASK2_REQUEST, null, 2),
        "JSON",
      ].join("\n")
    : null;

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
    command,
    powershellCommand: host
      ? powershellJsonCommand(
          endpoint(host, writingPath),
          identity,
          idempotencyKey,
          WRITING_TASK2_REQUEST
        )
      : null,
  };
}

function buildSpeaking({
  apiKey,
  host,
  identity,
}: BuildContext): SampleRequest {
  const headers: SampleHeader[] = [
    apiKeyHeader(apiKey),
    {
      name: "X-User-Identity",
      value: identity.value,
      meaning: identity.meaning,
    },
  ];
  const body: SampleBodyField[] = SPEAKING_FORM_FIELDS.map(
    ({ field, sampleValue, required, meaning }) => ({
      field,
      sampleValue,
      required,
      meaning,
    })
  );
  const formArgs = SPEAKING_FORM_FIELDS.filter(
    (field) => field.sendsInSample
  ).map(({ field, formValue }) => `-F "${field}=${formValue}"`);
  const command = host
    ? [
        RAW_KEY_FROM_ENVIRONMENT,
        `USER_IDENTITY='${identity.value}'`,
        "AUDIO_FILE='./answer.wav'",
        "",
        "curl --request POST \\",
        `  '${endpoint(host, speakingPath)}' \\`,
        `  --header "X-API-Key: \${API_KEY}" \\`,
        `  --header "X-User-Identity: \${USER_IDENTITY}" \\`,
        ...formArgs.map(
          (arg, index) => `  ${arg}${index < formArgs.length - 1 ? " \\" : ""}`
        ),
      ].join("\n")
    : null;

  return {
    kind: "speaking",
    label: "Speaking",
    method: "POST",
    url: endpoint(host, speakingPath),
    headers,
    body,
    identityNote: identity.note,
    expectedOutcomeFields: ["scorability", "estimated_band", "transcript"],
    firstCriterion: "scorability",
    note: "AIHUB chưa hỗ trợ Idempotency-Key cho Speaking. Chạy lại lệnh này sẽ chấm bài và tính phí thêm một lần nữa.",
    usageNote: usageNote(host),
    billing: billing(host),
    contentTypeNote:
      "Lệnh dùng -F nên curl tự sinh Content-Type multipart kèm boundary; không cần và không nên đặt header này.",
    command,
    powershellCommand: host
      ? powershellCommand(
          [
            `  $userIdentity = '${identity.value}'`,
            "  $audioFile = './answer.wav'",
          ],
          [
            "  curl.exe --request POST",
            `    '${endpoint(host, speakingPath)}'`,
            '    --header "X-API-Key: $env:API_KEY"',
            '    --header "X-User-Identity: $userIdentity"',
            ...SPEAKING_FORM_FIELDS.filter((field) => field.sendsInSample).map(
              ({ field, formValue }) =>
                `    -F "${field}=${formValue.replace("${AUDIO_FILE}", "$audioFile")}"`
            ),
          ]
        )
      : null,
  };
}

type BuildContext = {
  apiKey: OrganizationApiKey;
  host: string | null;
  identity: ResolvedIdentity;
  idempotencyKey: string;
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
}: {
  apiKey: OrganizationApiKey;
  identityConfigured?: boolean;
  idempotencyKey: string;
}): SampleRequest[] {
  const identity = resolveIdentity(identityConfigured);
  const context = {
    apiKey,
    host: resolveHost(apiKey),
    identity,
    idempotencyKey,
  };
  return SAMPLE_REQUESTS.filter((entry) =>
    apiKey.scopes.includes(entry.scope)
  ).map((entry) => entry.build(context));
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
