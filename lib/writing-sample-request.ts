import { WRITING_TASK2_REQUEST } from "@/data/writing-task2-request";
import type { MintedOrganizationApiKey } from "@/lib/api-keys";

const writingTask2Url =
  "https://api.aihubproduction.com/v1/ielts/writing/task2/grade";

type SampleHeader = {
  name: string;
  value: string;
  meaning: string;
};

type SampleBodyField = {
  field: keyof typeof WRITING_TASK2_REQUEST;
  sampleValue: string;
  required: true;
  meaning: string;
};

export type WritingSampleRequest = {
  method: "POST";
  url: string;
  headers: SampleHeader[];
  body: SampleBodyField[];
  identityNote: string;
  command: string | null;
};

export function buildWritingSampleRequest({
  apiKey,
  identityConfigured,
  idempotencyKey,
}: {
  apiKey: MintedOrganizationApiKey;
  identityConfigured?: boolean;
  idempotencyKey: string;
}): WritingSampleRequest | null {
  if (!apiKey.scopes.includes("writing.grade")) return null;

  const identity =
    identityConfigured === false
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
    {
      name: "X-API-Key",
      value: `${apiKey.key_prefix}…`,
      meaning: "API key của Organization; bảng chỉ hiển thị tiền tố.",
    },
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
  const command = apiKey.allowed_environments.includes("production")
    ? [
        `API_KEY='${apiKey.api_key}'`,
        `USER_IDENTITY='${identity.value}'`,
        `IDEMPOTENCY_KEY='${idempotencyKey}'`,
        "",
        "curl --request POST \\",
        `  '${writingTask2Url}' \\`,
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
    method: "POST",
    url: writingTask2Url,
    headers,
    body,
    identityNote: identity.note,
    command,
  };
}
