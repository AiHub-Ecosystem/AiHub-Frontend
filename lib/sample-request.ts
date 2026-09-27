import { WRITING_TASK2_REQUEST } from "@/data/writing-task2-request";
import { API_KEY_SCOPE_CATALOG, type ApiKeyScope } from "@/lib/api-key-scopes";
import {
  SANDBOX_ORGANIZATION_MONTHLY_ALLOWANCE,
  type ApiKeyEnvironment,
  type MintedOrganizationApiKey,
} from "@/lib/api-keys";

const WRITING_SCOPE = "writing.grade";
const SPEAKING_SCOPE = "speaking.grade";

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

function resolveHost(apiKey: MintedOrganizationApiKey): string | null {
  for (const environment of HOST_PREFERENCE) {
    const host = ENVIRONMENT_HOSTS[environment];
    if (host && apiKey.allowed_environments.includes(environment)) return host;
  }
  return null;
}

function endpoint(host: string | null, path: string): string {
  return host ? `${host}${path}` : path;
}

/** Empty when there is no runnable command, so the dialog renders it nowhere. */
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

type SampleRequestBase = {
  scope: ApiKeyScope;
  label: string;
  method: "POST";
  url: string;
  headers: SampleHeader[];
  identityNote: string;
  expectedOutcomeFields: string[];
  note: string;
  usageNote: string;
  contentTypeNote?: string;
  command: string | null;
};

type WritingBodyField = {
  field: keyof typeof WRITING_TASK2_REQUEST;
  sampleValue: string;
  required: true;
  meaning: string;
};

export type WritingSampleRequest = SampleRequestBase & {
  kind: "writing";
  body: WritingBodyField[];
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

type SpeakingBodyField = Pick<
  SpeakingFormField,
  "field" | "sampleValue" | "required" | "meaning"
>;

export type SpeakingSampleRequest = SampleRequestBase & {
  kind: "speaking";
  body: SpeakingBodyField[];
};

export type SampleRequest = WritingSampleRequest | SpeakingSampleRequest;

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

function apiKeyHeader(apiKey: MintedOrganizationApiKey): SampleHeader {
  return {
    name: "X-API-Key",
    value: `${apiKey.key_prefix}…`,
    meaning: "API key của Organization; bảng chỉ hiển thị tiền tố.",
  };
}

function serviceLabel(scope: ApiKeyScope): string {
  const option = API_KEY_SCOPE_CATALOG.find((entry) => entry.scope === scope);
  return option?.service ?? scope;
}

function buildWriting({
  apiKey,
  host,
  identity,
  idempotencyKey,
}: BuildContext): WritingSampleRequest {
  const body: WritingBodyField[] = [
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
        `API_KEY='${apiKey.api_key}'`,
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
    kind: "writing",
    scope: WRITING_SCOPE,
    label: serviceLabel(WRITING_SCOPE),
    method: "POST",
    url: endpoint(host, writingPath),
    headers,
    body,
    identityNote: identity.note,
    expectedOutcomeFields: ["overall_band", "criteria", "summary"],
    note: "Chạy lại cùng body với Idempotency-Key này sẽ phát lại kết quả đã lưu trong 24 giờ. Bài nộp mới cần một UUID mới.",
    usageNote: usageNote(host),
    command,
  };
}

function buildSpeaking({
  apiKey,
  host,
  identity,
}: BuildContext): SpeakingSampleRequest {
  const headers: SampleHeader[] = [
    apiKeyHeader(apiKey),
    {
      name: "X-User-Identity",
      value: identity.value,
      meaning: identity.meaning,
    },
  ];
  const body: SpeakingBodyField[] = SPEAKING_FORM_FIELDS.map(
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
        `API_KEY='${apiKey.api_key}'`,
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
    scope: SPEAKING_SCOPE,
    label: serviceLabel(SPEAKING_SCOPE),
    method: "POST",
    url: endpoint(host, speakingPath),
    headers,
    body,
    identityNote: identity.note,
    expectedOutcomeFields: ["scorability", "estimated_band", "transcript"],
    note: "AIHUB chưa hỗ trợ Idempotency-Key cho Speaking. Chạy lại lệnh này sẽ chấm bài và tính phí thêm một lần nữa.",
    usageNote: usageNote(host),
    contentTypeNote:
      "Lệnh dùng -F nên curl tự sinh Content-Type multipart kèm boundary; không cần và không nên đặt header này.",
    command,
  };
}

type BuildContext = {
  apiKey: MintedOrganizationApiKey;
  host: string | null;
  identity: ResolvedIdentity;
  idempotencyKey: string;
};

/** Fixed display order, not the order the key's scopes arrive in. */
const SAMPLE_REQUESTS: {
  scope: ApiKeyScope;
  build: (context: BuildContext) => SampleRequest;
}[] = [
  { scope: WRITING_SCOPE, build: buildWriting },
  { scope: SPEAKING_SCOPE, build: buildSpeaking },
];

export function buildSampleRequests({
  apiKey,
  identityConfigured,
  idempotencyKey,
}: {
  apiKey: MintedOrganizationApiKey;
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

/** Only the Writing Sample request carries an Idempotency-Key. */
export function needsIdempotencyKey(apiKey: MintedOrganizationApiKey): boolean {
  return apiKey.scopes.includes(WRITING_SCOPE);
}
