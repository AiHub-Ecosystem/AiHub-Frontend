"use client";

import { useEffect, useRef, useState } from "react";

import { MOCK_SPEAKING_RESULTS } from "@/data/demo-grading-fixtures";
import { MAX_SPEAKING_BYTES } from "@/data/speaking-contract";
import { SPEAKING_SAMPLE_ANSWER_REQUEST } from "@/data/speaking-question";
import {
  MOCK_SPEAKING_PROMPTS,
  type SpeakingPart,
  type SpeakingPrompt,
} from "@/data/speaking-prompts";
import {
  isSpeakingGradingEnvelope,
  type SpeakingGradingEnvelope,
} from "@/data/speaking-response";
import { demoEnvironmentName } from "@/lib/demo-environments";
import { buildDemoExports } from "@/lib/demo-export";
import { useDemoSession, type DemoScope } from "@/app/demo/demo-session";
import { sandboxAllowanceFrom } from "@/app/demo/demo-session-state";
import {
  DEMO_STEPS,
  DemoWorkbench,
  type DemoStep,
} from "@/app/demo/demo-workbench";
import { errorFromPayload, type PublicError } from "../scoring/scoring-client";

const SCOPE: DemoScope = "speaking.grade";
const PARTS = [1, 2, 3] as const;
const SPEAKING_CLIENT_TIMEOUT_MS = 75_000;
const SCENARIOS = [
  {
    id: "revoked",
    label: "Key bị thu hồi",
    status: "401 Unauthorized",
    response: {
      code: "UNAUTHORIZED",
      message: "API key không hợp lệ hoặc đã bị thu hồi.",
      retryable: false,
    },
  },
  {
    id: "scope",
    label: "Thiếu speaking.grade",
    status: "403 Forbidden",
    response: {
      code: "FORBIDDEN",
      message: "API key thiếu scope speaking.grade.",
      retryable: false,
    },
  },
  {
    id: "quota",
    label: "Hết hạn mức môi trường",
    status: "429 Too Many Requests",
    response: {
      code: "QUOTA_EXCEEDED",
      message: "Môi trường đã hết hạn mức tháng.",
      retryable: false,
    },
  },
  {
    id: "timeout",
    label: "Chấm quá thời gian",
    status: "504 Gateway Timeout",
    response: {
      code: "AI_SERVICE_TIMEOUT",
      message: "Dịch vụ chấm mất quá lâu.",
      retryable: true,
    },
  },
] as const;

type Result = {
  part: SpeakingPart;
  envelope: SpeakingGradingEnvelope;
  mode: "mock" | "live";
};
type ScenarioId = (typeof SCENARIOS)[number]["id"];
type HttpTrace = {
  status: number;
  contentType: string | null;
  cacheControl: string | null;
};

function httpTrace(response: Response): HttpTrace {
  return {
    status: response.status,
    contentType: response.headers.get("content-type"),
    cacheControl: response.headers.get("cache-control"),
  };
}

function pretty(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function promptsFromPayload(
  payload: unknown,
  part: SpeakingPart
): SpeakingPrompt[] | null {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("data" in payload) ||
    typeof payload.data !== "object" ||
    payload.data === null ||
    !("questions" in payload.data) ||
    !Array.isArray(payload.data.questions)
  )
    return null;
  const prompts = payload.data.questions.map((item): SpeakingPrompt | null => {
    if (
      typeof item !== "object" ||
      item === null ||
      !("id" in item) ||
      typeof item.id !== "string" ||
      !("part" in item) ||
      item.part !== part ||
      !("question" in item) ||
      typeof item.question !== "string"
    )
      return null;
    return { id: item.id, part, question: item.question };
  });
  return prompts.some((item) => item === null)
    ? null
    : (prompts as SpeakingPrompt[]);
}

function fileProblem(file: File | null) {
  if (!file) return "Chọn hoặc ghi một audio để chấm live.";
  if (file.size < 100) return "Audio quá ngắn hoặc rỗng.";
  if (file.size > MAX_SPEAKING_BYTES) return "Audio vượt giới hạn 25 MB.";
  if (!/\.(wav|mp3|m4a|webm|ogg)$/i.test(file.name))
    return "Định dạng hỗ trợ: WAV, MP3, M4A, WebM hoặc OGG.";
  return null;
}

export default function SpeakingWorkbench() {
  const {
    state,
    grading,
    beginGrading,
    endGrading,
    setApiKey,
    setEnvironment,
    isSelectionCurrent,
    isScopeValidated,
    markScopeValidated,
    clearScopeValidation,
    requiresProductionAcknowledgement,
    acknowledgeProduction,
    getUserIdentity,
  } = useDemoSession();
  const apiKey = state.apiKey;
  const environment = state.environment;
  const [step, setStep] = useState<DemoStep>(1);
  const [skipMock, setSkipMock] = useState(false);
  const [checkingKey, setCheckingKey] = useState(false);
  const [keyCheckResponse, setKeyCheckResponse] = useState<unknown>(null);
  const [keyCheckTrace, setKeyCheckTrace] = useState<HttpTrace | null>(null);
  const [keyError, setKeyError] = useState<PublicError | null>(null);
  const [part, setPart] = useState<SpeakingPart>(1);
  const [livePrompts, setLivePrompts] = useState<SpeakingPrompt[] | null>(null);
  const [questionResponse, setQuestionResponse] = useState<unknown>(null);
  const [questionTrace, setQuestionTrace] = useState<HttpTrace | null>(null);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState(MOCK_SPEAKING_PROMPTS[0].id);
  const [file, setFile] = useState<File | null>(null);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<PublicError | null>(null);
  const [gradeResponse, setGradeResponse] = useState<unknown>(null);
  const [gradeTrace, setGradeTrace] = useState<HttpTrace | null>(null);
  const [gradeAttempted, setGradeAttempted] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [scenario, setScenario] = useState<ScenarioId>("revoked");
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const filePicker = useRef<HTMLInputElement>(null);
  const audioPlayer = useRef<HTMLAudioElement>(null);

  const liveReady =
    apiKey.trim().length > 0 && isScopeValidated(SCOPE) && !skipMock;
  const mode = liveReady ? "live" : "mock";
  const localPrompts = MOCK_SPEAKING_PROMPTS.filter(
    (item) => item.part === part
  );
  const prompts = liveReady ? (livePrompts ?? []) : localPrompts;
  const prompt = prompts.find((item) => item.id === selectedId) ?? prompts[0];
  const activeResult = result?.part === part ? result : null;
  const activeScenario =
    SCENARIOS.find((item) => item.id === scenario) ?? SCENARIOS[0];
  const currentFileProblem = fileProblem(file);
  /** Informational only: every grade re-checks the allowance upstream. */
  const allowance = isScopeValidated(SCOPE)
    ? sandboxAllowanceFrom(keyCheckResponse)
    : undefined;

  useEffect(() => {
    const player = audioPlayer.current;
    if (!player || !liveReady || !file) return;
    const url = URL.createObjectURL(file);
    player.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file, liveReady]);

  useEffect(() => {
    if (step !== 2 || !liveReady) return;
    let cancelled = false;
    let receivedHttpResponse = false;
    fetch(`/api/demo/speaking/questions?part=${part}`, {
      cache: "no-store",
      headers: { "X-Demo-Environment": environment },
    })
      .then(async (response) => {
        const payload: unknown = await response.json().catch(() => null);
        if (cancelled) return;
        receivedHttpResponse = true;
        setQuestionTrace(httpTrace(response));
        setQuestionResponse(payload);
        if (!response.ok) throw errorFromPayload(payload);
        const loaded = promptsFromPayload(payload, part);
        if (!loaded)
          throw new Error(
            `Câu hỏi từ ${demoEnvironmentName(environment)} không đúng định dạng.`
          );
        if (loaded.length === 0)
          throw new Error(
            `${demoEnvironmentName(environment)} hiện không có câu hỏi cho Part này.`
          );
        if (cancelled) return;
        setLivePrompts(loaded);
        setSelectedId((current) =>
          loaded.some((item) => item.id === current)
            ? current
            : (loaded[0]?.id ?? "")
        );
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setLivePrompts(null);
        setQuestionError(
          caught instanceof Error
            ? caught.message
            : `Không tải được câu hỏi Speaking từ ${demoEnvironmentName(environment)}.`
        );
        if (!receivedHttpResponse)
          setQuestionResponse({
            http_response: null,
            error:
              caught instanceof Error
                ? caught.message
                : "AI_SERVICE_UNAVAILABLE",
          });
      })
      .finally(() => {
        if (!cancelled) setQuestionLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step, liveReady, part, environment]);

  useEffect(
    () => () => {
      recorder.current?.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
    },
    []
  );

  const requestBody = {
    part,
    question_id: prompt?.id ?? "",
    prompt_text: prompt?.question ?? "",
    test_type: "Practice",
    audio: file
      ? {
          filename: file.name,
          bytes: file.size,
          type: file.type || "application/octet-stream",
        }
      : null,
  };

  /**
   * Speaking's own grading call is a multipart upload this page makes, so the
   * copyable artifact is the JSON endpoint with AIHUB's Published sample answer
   * and the question now selected: it runs as copied on the selected host.
   */
  const copyableExports =
    step === 1
      ? null
      : buildDemoExports({
          environment,
          skill: "speaking",
          title: `Speaking Part ${part}`,
          path: "/v1/ielts/speaking/grading-json",
          headers: [
            { name: "X-User-Identity", value: "<your end-user id>" },
            { name: "Content-Type", value: "application/json" },
          ],
          body: {
            ...SPEAKING_SAMPLE_ANSWER_REQUEST,
            part,
            question_id: prompt?.id ?? "",
            prompt_text: prompt?.question ?? "",
          },
        });

  const changeStep = (next: DemoStep) => {
    if (step === 3 && next !== 3 && recorder.current?.state === "recording") {
      recorder.current.stop();
    }
    if (next === 2 && step !== 2 && liveReady) {
      setQuestionLoading(true);
      setQuestionError(null);
      setQuestionTrace(null);
      setQuestionResponse({
        state: "pending",
        request: `/v1/ielts/speaking/questions?part=${part}`,
      });
    }
    setStep(next);
  };

  const validateKey = async () => {
    const submittedKey = apiKey.trim();
    const submittedEnvironment = environment;
    if (!submittedKey) {
      setKeyError({
        code: "UNAUTHORIZED",
        message: `Nhập API key ${demoEnvironmentName(environment)} hoặc bỏ qua để dùng mẫu.`,
      });
      return;
    }
    setCheckingKey(true);
    setKeyError(null);
    setSkipMock(false);
    setQuestionLoading(false);
    setQuestionError(null);
    setQuestionResponse(null);
    setQuestionTrace(null);
    setResult(null);
    setGradeResponse(null);
    setGradeTrace(null);
    setGradeAttempted(false);
    setKeyCheckTrace(null);
    setKeyCheckResponse({ state: "pending", scope: SCOPE });
    let receivedHttpResponse = false;
    try {
      const response = await fetch("/api/demo/key/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Demo-API-Key": submittedKey,
        },
        body: JSON.stringify({
          environment: submittedEnvironment,
          scope: SCOPE,
        }),
        cache: "no-store",
      });
      // A changed key or environment discards the answer to this question.
      if (!isSelectionCurrent(submittedKey, submittedEnvironment)) return;
      receivedHttpResponse = true;
      setKeyCheckTrace(httpTrace(response));
      const payload: unknown = await response.json().catch(() => null);
      if (!isSelectionCurrent(submittedKey, submittedEnvironment)) return;
      setKeyCheckResponse(payload);
      if (!response.ok) throw errorFromPayload(payload);
      if (
        typeof payload !== "object" ||
        payload === null ||
        !("data" in payload) ||
        typeof payload.data !== "object" ||
        payload.data === null ||
        !("valid" in payload.data) ||
        payload.data.valid !== true
      ) {
        throw {
          code: "AI_SERVICE_CONTRACT_VIOLATION",
          message: "Response kiểm tra key không đúng định dạng.",
        } satisfies PublicError;
      }
      markScopeValidated(SCOPE);
      setQuestionLoading(true);
      setQuestionError(null);
      setQuestionTrace(null);
      setQuestionResponse({
        state: "pending",
        request: `/v1/ielts/speaking/questions?part=${part}`,
      });
      setStep(2);
    } catch (caught) {
      if (!isSelectionCurrent(submittedKey, submittedEnvironment)) return;
      clearScopeValidation();
      const publicError =
        typeof caught === "object" &&
        caught !== null &&
        "code" in caught &&
        "message" in caught
          ? (caught as PublicError)
          : {
              code: "AI_SERVICE_UNAVAILABLE",
              message: "Không kiểm tra được key. Thử lại hoặc dùng mẫu.",
            };
      setKeyError(publicError);
      if (!receivedHttpResponse)
        setKeyCheckResponse({
          error: { code: publicError.code, message: publicError.message },
          http_response: null,
        });
    } finally {
      setCheckingKey(false);
    }
  };

  const useMock = () => {
    clearScopeValidation();
    setSkipMock(true);
    setQuestionLoading(false);
    setQuestionError(null);
    setQuestionResponse(null);
    setQuestionTrace(null);
    setResult(null);
    setError(null);
    setKeyError(null);
    setGradeResponse(null);
    setGradeTrace(null);
    setGradeAttempted(false);
    setKeyCheckResponse({
      mode: "mock",
      request: null,
      message: "Key check skipped; fixed fixture selected.",
    });
    setKeyCheckTrace(null);
    setStep(2);
  };

  const choosePart = (value: SpeakingPart) => {
    if (value === part) return;
    setPart(value);
    if (step === 2 && liveReady) {
      setQuestionLoading(true);
      setQuestionError(null);
      setQuestionTrace(null);
      setQuestionResponse({
        state: "pending",
        request: `/v1/ielts/speaking/questions?part=${value}`,
      });
    }
    const first = MOCK_SPEAKING_PROMPTS.find((item) => item.part === value);
    setSelectedId(first?.id ?? "");
    setFile(null);
    setResult(null);
    setGradeResponse(null);
    setGradeTrace(null);
    setGradeAttempted(false);
    setQuestionResponse(null);
    setQuestionTrace(null);
    setLivePrompts(null);
    setError(null);
  };

  const saveFile = (next: File | null) => {
    if (!next) return;
    const problem = fileProblem(next);
    if (problem && problem !== "Chọn hoặc ghi một audio để chấm live.") {
      setError({ code: "INVALID_REQUEST", message: problem });
      return;
    }
    setFile(next);
    setError(null);
    setResult(null);
    setGradeResponse(null);
    setGradeTrace(null);
    setGradeAttempted(false);
  };

  const startRecording = async () => {
    setError(null);
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      )
        throw new Error(
          "Trình duyệt không hỗ trợ ghi âm. Tải file audio lên để tiếp tục."
        );
      const nextStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      stream.current = nextStream;
      chunks.current = [];
      const nextRecorder = new MediaRecorder(nextStream);
      recorder.current = nextRecorder;
      nextRecorder.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data);
      };
      nextRecorder.onstop = () => {
        const blob = new Blob(chunks.current, {
          type: nextRecorder.mimeType || "audio/webm",
        });
        const extension = blob.type.includes("mp4") ? "m4a" : "webm";
        saveFile(
          new File([blob], `speaking-answer.${extension}`, { type: blob.type })
        );
        nextStream.getTracks().forEach((track) => track.stop());
        stream.current = null;
        recorder.current = null;
        setRecording(false);
      };
      nextRecorder.start();
      setRecording(true);
    } catch (caught) {
      setError({
        code: "INVALID_REQUEST",
        message:
          caught instanceof Error ? caught.message : "Không thể mở microphone.",
      });
    }
  };

  const stopRecording = () => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  };

  const grade = async () => {
    setError(null);
    setResult(null);
    if (!liveReady) {
      setGradeAttempted(false);
      setGradeTrace(null);
      const envelope = MOCK_SPEAKING_RESULTS[part];
      setGradeResponse(envelope);
      setResult({ part, envelope, mode: "mock" });
      return;
    }
    if (!livePrompts?.length || !prompt) {
      setError({
        code: "AI_SERVICE_UNAVAILABLE",
        message: `Chưa có câu hỏi live từ ${demoEnvironmentName(environment)}. Không thể gửi fixture local để chấm.`,
      });
      return;
    }
    // The first Production grade of a visit needs the billable acknowledgement;
    // it is not a spend cap, only a gate the backend still enforces afterwards.
    if (requiresProductionAcknowledgement()) {
      setError({
        code: "PRODUCTION_ACKNOWLEDGEMENT_REQUIRED",
        message:
          "Xác nhận ở khung “Môi trường demo” rằng request Production có thể tính phí trước khi chấm.",
      });
      return;
    }
    const problem = fileProblem(file);
    if (problem) {
      setError({ code: "INVALID_REQUEST", message: problem });
      return;
    }
    if (!prompt || !file) return;
    if (!beginGrading()) return;

    setSubmitting(true);
    setGradeAttempted(true);
    setGradeTrace(null);
    const form = new FormData();
    form.append("audio", file, file.name);
    form.append("part", String(part));
    form.append("question_id", prompt.id);
    form.append("prompt_text", prompt.question);
    form.append("test_type", "Practice");
    setGradeResponse({
      state: "pending",
      request: `/v1/ielts/speaking/grading · Part ${part}`,
    });
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort("speaking-client-timeout"),
      SPEAKING_CLIENT_TIMEOUT_MS
    );
    let receivedHttpResponse = false;
    let responseTrace: HttpTrace | null = null;
    try {
      const response = await fetch("/api/demo/speaking/grading", {
        method: "POST",
        headers: {
          "X-Demo-API-Key": apiKey.trim(),
          "X-Demo-Environment": environment,
          "X-Demo-User-Identity": getUserIdentity(),
        },
        body: form,
        signal: controller.signal,
        cache: "no-store",
      });
      receivedHttpResponse = true;
      responseTrace = httpTrace(response);
      setGradeTrace(responseTrace);
      const payload: unknown = await response.json().catch(() => null);
      if (controller.signal.aborted) throw new Error("speaking-client-timeout");
      setGradeResponse(payload);
      if (!response.ok) throw errorFromPayload(payload);
      if (!isSpeakingGradingEnvelope(payload))
        throw {
          code: "AI_SERVICE_CONTRACT_VIOLATION",
          message: "Kết quả từ AIHUB không đúng định dạng.",
        } satisfies PublicError;
      setResult({ part, envelope: payload, mode: "live" });
    } catch (caught) {
      const publicError =
        typeof caught === "object" &&
        caught !== null &&
        "code" in caught &&
        "message" in caught
          ? (caught as PublicError)
          : controller.signal.aborted
            ? {
                code: "AI_SERVICE_TIMEOUT",
                message:
                  "Chưa nhận được phản hồi sau 75 giây. Yêu cầu có thể đã được gửi để chấm; kiểm tra trạng thái trước khi gửi lại vì lần gửi lại là lượt mới.",
              }
            : {
                code: "AI_SERVICE_UNAVAILABLE",
                message: "Không gửi được audio. Kiểm tra kết nối rồi thử lại.",
              };
      setError(publicError);
      if (!receivedHttpResponse || controller.signal.aborted)
        setGradeResponse({
          error: { code: publicError.code, message: publicError.message },
          http_response: responseTrace
            ? { status: responseTrace.status }
            : null,
        });
    } finally {
      window.clearTimeout(timeout);
      setSubmitting(false);
      endGrading();
    }
  };

  const validationSkipped =
    typeof keyCheckResponse === "object" &&
    keyCheckResponse !== null &&
    "mode" in keyCheckResponse &&
    keyCheckResponse.mode === "mock";
  const responseHeaderSummary = (trace: HttpTrace | null) =>
    trace
      ? `AIHUB BFF HTTP ${trace.status}\nContent-Type: ${trace.contentType ?? "(not returned)"}\nCache-Control: ${trace.cacheControl ?? "(not returned)"}`
      : "No HTTP response headers received.";

  const requestForStep = () => {
    if (step === 1) {
      if (validationSkipped)
        return pretty({
          source: "local choice",
          http_request: null,
          message: "Bỏ qua kiểm tra key; dùng fixture.",
        });
      if (!apiKey.trim() && !keyCheckResponse)
        return pretty({
          http_request: null,
          message: "API key là tùy chọn. Chưa gửi request; có thể bỏ qua.",
        });
      return pretty({
        source: checkingKey
          ? "request in progress"
          : keyCheckTrace
            ? "HTTP response received from AIHUB BFF"
            : keyCheckResponse
              ? "request attempted; no HTTP response"
              : "request preview · chưa gửi",
        browser_to_aihub_bff: {
          method: "POST",
          path: "/api/demo/key/validate",
          headers: {
            "X-Demo-API-Key": "[REDACTED]",
            "Content-Type": "application/json",
          },
          body: { scope: SCOPE },
        },
        bff_to_selected_environment: {
          environment: demoEnvironmentName(environment),
          method: "POST",
          path: "/v1/sandbox/demo/api-keys/validate",
          headers: {
            "X-API-Key": "[REDACTED]",
            "Content-Type": "application/json",
          },
          body: { scope: SCOPE },
        },
      });
    }
    if (step === 2)
      return liveReady
        ? pretty({
            source: "GET question catalog via AIHUB BFF",
            browser_to_aihub_bff: {
              method: "GET",
              path: `/api/demo/speaking/questions?part=${part}`,
            },
            bff_to_selected_environment: {
              environment: demoEnvironmentName(environment),
              method: "GET",
              path: `/v1/ielts/speaking/questions?part=${part}`,
            },
            note: "Public catalog; no grading quota.",
          })
        : pretty({
            source: "local fixture",
            http_request: null,
            part,
            questions: localPrompts,
          });
    if (step === 3)
      return pretty({
        source: liveReady
          ? "local draft preview · chưa gửi HTTP"
          : "local mock fixture · không gửi HTTP",
        planned_request: liveReady
          ? {
              method: "POST",
              path: "/api/demo/speaking/grading",
              upstream_path: "/v1/ielts/speaking/grading",
              headers: {
                "X-Demo-API-Key": "[REDACTED]",
                "X-Demo-User-Identity": "<generated at submit>",
                "Content-Type":
                  "multipart/form-data; browser generated boundary",
              },
            }
          : null,
        body_preview: requestBody,
        sent: false,
      });
    if (step === 5)
      return pretty({
        source: "local error scenario · simulated, no HTTP",
        scenario: activeScenario.label,
        simulated_request: {
          method: "POST",
          path: "/v1/ielts/speaking/grading",
          headers: {
            "X-API-Key": "[REDACTED]",
            "X-User-Identity": "<demo UUID>",
          },
          body: requestBody,
        },
      });
    if (!liveReady)
      return pretty({
        source: "local fixture submit",
        http_request: null,
        result:
          "Clicking the button returns MOCK_SPEAKING_RESULTS for this Part.",
      });
    if (!gradeAttempted)
      return pretty({
        source: "request preview · chưa gửi",
        method: "POST",
        browser_to_aihub_bff: "/api/demo/speaking/grading",
        bff_to_selected_environment: {
          environment: demoEnvironmentName(environment),
          path: "/v1/ielts/speaking/grading",
        },
        headers: {
          "X-Demo-API-Key": "[REDACTED]",
          "X-Demo-User-Identity": "<generated at submit>",
          "Content-Type": "multipart/form-data; browser generated boundary",
        },
        body_summary: requestBody,
        audio_binary_included: Boolean(file),
        sent: false,
      });
    return pretty({
      source: "request sent via AIHUB BFF",
      method: "POST",
      browser_to_aihub_bff: "/api/demo/speaking/grading",
      bff_to_selected_environment: {
        environment: demoEnvironmentName(environment),
        path: "/v1/ielts/speaking/grading",
      },
      headers: {
        "X-Demo-API-Key": "[REDACTED]",
        "X-Demo-User-Identity": "<demo UUID>",
        "Content-Type": "multipart/form-data; browser generated boundary",
      },
      body_summary: requestBody,
      audio_binary_included: Boolean(file),
      sent: true,
    });
  };

  const responseForStep = () => {
    if (step === 1)
      return validationSkipped
        ? pretty({
            source: "local choice",
            http_response: null,
            message: "Đã bỏ qua bước kiểm tra key.",
          })
        : keyCheckResponse
          ? pretty({
              http: keyCheckTrace
                ? {
                    status: keyCheckTrace.status,
                    headers: responseHeaderSummary(keyCheckTrace),
                  }
                : null,
              body: keyCheckResponse,
            })
          : pretty({
              http_response: null,
              message: "Chưa kiểm tra key; chưa có response.",
            });
    if (step === 2)
      return liveReady
        ? pretty({
            http: questionTrace
              ? {
                  status: questionTrace.status,
                  headers: responseHeaderSummary(questionTrace),
                }
              : null,
            body:
              questionResponse ??
              (questionLoading
                ? { state: "request in progress" }
                : { state: "no response received" }),
          })
        : pretty({
            source: "local fixture",
            http_response: null,
            part,
            questions: localPrompts,
          });
    if (step === 3)
      return pretty({
        source: "local preview",
        http_response: null,
        message: liveReady
          ? "Chưa gửi. Audio chỉ được gửi ở bước 4 sau khi bấm chấm."
          : "Mock chỉ đọc fixture; không gửi audio.",
      });
    if (step === 5)
      return pretty({
        source: "local simulation · not HTTP",
        simulated_status: activeScenario.status,
        simulated_response: activeScenario.response,
      });
    if (!liveReady)
      return gradeResponse
        ? pretty({
            source: "local fixture",
            http_response: null,
            body: gradeResponse,
          })
        : pretty({
            source: "local fixture",
            http_response: null,
            message: "Chưa chọn hiển thị kết quả mẫu.",
          });
    return gradeResponse
      ? pretty({
          http: gradeTrace
            ? {
                status: gradeTrace.status,
                headers: responseHeaderSummary(gradeTrace),
              }
            : null,
          body: gradeResponse,
        })
      : pretty({
          http_response: null,
          message: gradeAttempted
            ? "Request đã gửi nhưng chưa nhận response HTTP."
            : "Chưa gửi request.",
        });
  };

  const requestHeaders = () => {
    if (step === 1)
      return validationSkipped || (!apiKey.trim() && !keyCheckResponse)
        ? "No HTTP request."
        : `${keyCheckResponse ? "Sent or in progress" : "Preview only; not sent"}\nBrowser → AIHUB BFF: X-Demo-API-Key: [REDACTED]\nContent-Type: application/json\nAIHUB BFF → ${demoEnvironmentName(environment)}: X-API-Key: [REDACTED]\nContent-Type: application/json`;
    if (step === 2)
      return liveReady
        ? "GET question catalog via BFF. No API key or grading request is sent. Browser-managed headers omitted."
        : "No HTTP request — question fixture is local.";
    if (step === 3)
      return liveReady
        ? `Preview only; not sent yet.\nBrowser → AIHUB BFF: X-Demo-API-Key: [REDACTED]\nX-Demo-User-Identity: generated at submit\nContent-Type: multipart/form-data (browser boundary)\nBFF → ${demoEnvironmentName(environment)}: X-API-Key: [REDACTED]\nX-User-Identity: <demo UUID>`
        : "No HTTP request — read-only fixture.";
    if (step === 5)
      return "Simulated request only; no request headers were sent.\nX-API-Key: [REDACTED]";
    if (!liveReady) return "No HTTP request — fixture is generated locally.";
    return `${gradeAttempted ? "Sent" : "Preview only; not sent"}\nBrowser → AIHUB BFF: X-Demo-API-Key: [REDACTED]\nX-Demo-User-Identity: ${gradeAttempted ? "<demo UUID>" : "generated at submit"}\nContent-Type: multipart/form-data (browser boundary)\nBFF → ${demoEnvironmentName(environment)}: X-API-Key: [REDACTED]\nX-User-Identity: <demo UUID>`;
  };

  const responseHeaders = () => {
    if (step === 1)
      return keyCheckTrace
        ? responseHeaderSummary(keyCheckTrace)
        : validationSkipped
          ? "No HTTP response — step skipped."
          : "No HTTP response received.";
    if (step === 2)
      return liveReady
        ? responseHeaderSummary(questionTrace)
        : "No HTTP response — local fixture.";
    if (step === 3) return "No HTTP response — draft preview only.";
    if (step === 5) return "No HTTP response headers — simulated status only.";
    if (!liveReady || result?.mode === "mock")
      return "No HTTP response — local fixture.";
    return gradeTrace
      ? responseHeaderSummary(gradeTrace)
      : "No HTTP response received.";
  };

  const traceNote =
    step === 1
      ? "Key validation goes through the AIHUB BFF and checks scope/environment only; it does not grade or consume grading quota. The key is redacted."
      : step === 2
        ? liveReady
          ? "The public question catalog is fetched through the BFF; it does not send a grading request or consume grading quota."
          : "Local question fixtures only. No HTTP request is sent."
        : step === 3
          ? liveReady
            ? "This is a local draft preview. Audio is sent only after the Step 4 grading button is pressed."
            : "Read-only fixture preview. No audio or grading request is sent."
          : step === 4
            ? liveReady
              ? `The BFF rechecks the ${demoEnvironmentName(environment)} key on every grading request; the API key is redacted in this trace.`
              : "The button returns a fixed fixture in the browser. No grading or AI service request is sent."
            : "Scenario request and response are simulated locally. No HTTP request or quota use.";

  const traceStatus =
    step === 1
      ? validationSkipped
        ? "SKIPPED · LOCAL"
        : checkingKey
          ? "CHECKING KEY"
          : keyCheckTrace
            ? `HTTP ${keyCheckTrace.status}`
            : keyError
              ? "CHECK FAILED"
              : apiKey.trim()
                ? "PREVIEW · NOT SENT"
                : "KEY OPTIONAL"
      : step === 2
        ? questionLoading
          ? "LOADING QUESTIONS"
          : liveReady
            ? questionTrace
              ? `HTTP ${questionTrace.status}`
              : questionError
                ? "NO HTTP RESPONSE"
                : "LIVE CATALOG"
            : "LOCAL FIXTURE"
        : step === 3
          ? liveReady
            ? "DRAFT PREVIEW · NOT SENT"
            : "READ-ONLY FIXTURE"
          : step === 4
            ? submitting
              ? "GRADING"
              : !liveReady
                ? activeResult
                  ? "LOCAL FIXTURE RESULT"
                  : "LOCAL · NO HTTP"
                : gradeTrace
                  ? `HTTP ${gradeTrace.status}`
                  : gradeAttempted
                    ? "NO HTTP RESPONSE"
                    : "PREVIEW · NOT SENT"
            : "SIMULATED · NO HTTP";

  return (
    <DemoWorkbench
      skill="speaking"
      scope={SCOPE}
      title="Chấm IELTS Speaking"
      description={`Chọn Speaking Part, ghi âm hoặc tải câu trả lời lên khi dùng key ${demoEnvironmentName(environment)}. Bỏ qua key để xem fixture read-only và kết quả mẫu cố định.`}
      step={step}
      onStepChange={changeStep}
      stepperDisabled={grading || submitting}
      mode={mode}
      status={traceStatus}
      request={requestForStep()}
      response={responseForStep()}
      requestHeaders={requestHeaders()}
      responseHeaders={responseHeaders()}
      environment={environment}
      onEnvironmentChange={(value) => {
        setEnvironment(value);
        setQuestionError(null);
        setQuestionResponse(null);
        setQuestionTrace(null);
        setLivePrompts(null);
      }}
      productionAcknowledged={state.productionAcknowledged}
      requiresProductionAcknowledgement={requiresProductionAcknowledgement()}
      onAcknowledgeProduction={acknowledgeProduction}
      sandboxAllowance={allowance}
      exports={copyableExports}
      traceNote={traceNote}
    >
      <p className="demo-flow-eyebrow">
        BƯỚC {step} / 5 · {DEMO_STEPS[step - 1]}
      </p>

      {step === 1 && (
        <>
          <h3>Chọn môi trường và key</h3>
          <p>
            Kiểm tra key theo scope <code>{SCOPE}</code> và theo môi trường đã
            chọn. Endpoint chỉ xác thực key, không gọi AI và không tiêu quota
            chấm.
          </p>
          <div className="demo-field">
            <label htmlFor="speaking-demo-key">
              API key {demoEnvironmentName(environment)} (tùy chọn)
            </label>
            <input
              autoComplete="off"
              disabled={grading}
              id="speaking-demo-key"
              onChange={(event) => {
                setApiKey(event.target.value);
                setSkipMock(false);
                setKeyError(null);
                setKeyCheckResponse(null);
                setKeyCheckTrace(null);
                setQuestionLoading(false);
                setQuestionError(null);
                setQuestionResponse(null);
                setQuestionTrace(null);
                setLivePrompts(null);
                setResult(null);
                setGradeResponse(null);
                setGradeTrace(null);
                setGradeAttempted(false);
                setError(null);
              }}
              placeholder={
                environment === "sandbox" ? "aihub_sandbox_…" : "aihub_prod_…"
              }
              spellCheck={false}
              type="password"
              value={apiKey}
            />
            <p className="demo-help">
              Key phải chỉ thuộc môi trường{" "}
              {demoEnvironmentName(environment).toLowerCase()}, có scope
              speaking.grade, Organization chưa bật Identity Configuration.
            </p>
          </div>
          {keyError && (
            <div className="demo-error" role="alert">
              <strong>{keyError.code}</strong> · {keyError.message}
            </div>
          )}
          {isScopeValidated(SCOPE) && apiKey && (
            <div className="demo-success">
              Key đã qua kiểm tra bước 1. Backend sẽ kiểm tra lại trước mỗi lần
              chấm.
            </div>
          )}
          <div className="demo-step-actions">
            <button
              className="demo-btn-primary"
              disabled={grading || checkingKey || !apiKey.trim()}
              onClick={validateKey}
              type="button"
            >
              {checkingKey ? "Đang kiểm tra… " : ""}Kiểm tra key
            </button>
            <button
              className="demo-btn-secondary"
              disabled={grading || checkingKey}
              onClick={useMock}
              type="button"
            >
              Bỏ qua, dùng mẫu
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <h3>Chọn câu hỏi Speaking</h3>
          <p>
            {liveReady
              ? `Live mode tải danh sách câu hỏi công khai từ ${demoEnvironmentName(environment)}; thao tác này không chấm bài và không dùng quota.`
              : "Mock mode dùng fixture local theo từng Part, không tải catalog từ backend."}
          </p>
          <div className="demo-inline-actions" aria-label="Speaking part">
            {PARTS.map((value) => (
              <button
                aria-pressed={part === value}
                className={`demo-btn-secondary ${part === value ? "active" : ""}`}
                disabled={submitting}
                key={value}
                onClick={() => choosePart(value)}
                type="button"
              >
                Part {value}
              </button>
            ))}
          </div>
          {questionLoading && (
            <p className="demo-notice" role="status">
              Đang tải câu hỏi từ {demoEnvironmentName(environment)}…
            </p>
          )}
          {questionError && liveReady && (
            <div className="demo-error" role="alert">
              {questionError} Không dùng câu hỏi fixture để chấm live. Quay lại
              bước 1 và bỏ qua key để xem mẫu.
            </div>
          )}
          <div className="demo-scenario-list">
            {prompts.map((item) => (
              <button
                aria-pressed={selectedId === item.id}
                className={selectedId === item.id ? "active" : ""}
                disabled={submitting}
                key={item.id}
                onClick={() => {
                  setSelectedId(item.id);
                  setResult(null);
                  setGradeResponse(null);
                  setGradeTrace(null);
                  setGradeAttempted(false);
                }}
                type="button"
              >
                <strong>{item.question}</strong>
                <br />
                <small>{item.id}</small>
              </button>
            ))}
          </div>
          {prompt?.cue && (
            <div className="demo-notice">
              <strong>Gợi ý:</strong> {prompt.cue}
            </div>
          )}
          <div className="demo-step-actions">
            <button
              className="demo-btn-primary"
              disabled={!prompt || questionLoading}
              onClick={() => changeStep(3)}
              type="button"
            >
              Tiếp tục đến câu trả lời
            </button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <h3>Câu trả lời bằng audio</h3>
          <p>
            {liveReady
              ? "Ghi âm trực tiếp hoặc tải tệp lên. File chỉ giữ trong bộ nhớ trang và được gửi khi bạn bấm chấm."
              : "Mock mode hiển thị transcript mẫu read-only. Để gửi câu trả lời của bạn, nhập key hợp lệ ở bước 1."}
          </p>
          {!liveReady ? (
            <div className="demo-field">
              <label>Transcript mẫu · Part {part}</label>
              <textarea
                readOnly
                rows={6}
                value={MOCK_SPEAKING_RESULTS[part].data.transcript.text}
              />
            </div>
          ) : (
            <>
              <input
                accept=".wav,.mp3,.m4a,.webm,.ogg,audio/*"
                aria-label="Chọn file audio Speaking"
                className="demo-sr-only"
                data-testid="input-audio-file"
                onChange={(event) => saveFile(event.target.files?.[0] ?? null)}
                ref={filePicker}
                tabIndex={-1}
                type="file"
              />
              <div className="demo-step-actions">
                <button
                  className="demo-btn-secondary"
                  disabled={recording || submitting}
                  onClick={() => filePicker.current?.click()}
                  type="button"
                >
                  Tải audio
                </button>
                <button
                  className="demo-btn-secondary"
                  disabled={submitting}
                  onClick={recording ? stopRecording : startRecording}
                  type="button"
                >
                  {recording ? "Dừng ghi âm" : "Ghi âm"}
                </button>
              </div>
              <div className="demo-notice" aria-live="polite">
                {recording
                  ? "Đang ghi âm…"
                  : file
                    ? `${file.name} · ${Math.ceil(file.size / 1024)} KB`
                    : "Chưa chọn audio."}
              </div>
              {file && (
                <audio
                  aria-label="Nghe lại audio đã chọn"
                  className="demo-audio-player"
                  controls
                  ref={audioPlayer}
                />
              )}
              {file && (
                <button
                  className="demo-btn-secondary"
                  onClick={() => {
                    setFile(null);
                    setResult(null);
                    setGradeResponse(null);
                    setGradeTrace(null);
                    setGradeAttempted(false);
                  }}
                  type="button"
                >
                  Xóa audio
                </button>
              )}
              {file && (
                <p className="demo-help">
                  Tối đa 25 MB. Supported: WAV, MP3, M4A, WebM, OGG.
                </p>
              )}
            </>
          )}
          {error && step === 3 && (
            <div className="demo-error" role="alert">
              {error.message}
            </div>
          )}
          <div className="demo-step-actions">
            <button
              className="demo-btn-primary"
              disabled={
                liveReady &&
                (!prompt ||
                  !livePrompts?.length ||
                  !file ||
                  !!currentFileProblem)
              }
              onClick={() => changeStep(4)}
              type="button"
            >
              Xem bước chấm
            </button>
            <button
              className="demo-btn-secondary"
              onClick={() => changeStep(2)}
              type="button"
            >
              Quay lại câu hỏi
            </button>
          </div>
        </>
      )}

      {step === 4 && (
        <>
          <h3>{liveReady ? "Gửi audio chấm thật" : "Xem kết quả mẫu"}</h3>
          <p>
            {liveReady
              ? `AIHUB gửi multipart audio tới ${demoEnvironmentName(environment)}. API key được xác thực lại trước quota và dispatch.`
              : "Submit chỉ trả fixture tĩnh theo Part. Không có request grading hoặc AI service call."}
          </p>
          {error && (
            <div className="demo-error" role="alert">
              <strong>{error.code}</strong> · {error.message}
              {error.retry_after_ms
                ? ` Thử lại sau ${Math.ceil(error.retry_after_ms / 1000)} giây.`
                : ""}
            </div>
          )}
          <div className="demo-step-actions">
            <button
              className="demo-btn-primary"
              disabled={
                grading ||
                submitting ||
                (liveReady &&
                  (!prompt ||
                    !livePrompts?.length ||
                    !file ||
                    !!currentFileProblem))
              }
              onClick={grade}
              type="button"
            >
              {submitting
                ? "Đang chấm…"
                : liveReady
                  ? `Chấm thật Part ${part}`
                  : `Hiện kết quả mẫu Part ${part}`}
            </button>
            <button
              className="demo-btn-secondary"
              disabled={grading || submitting}
              onClick={() => changeStep(3)}
              type="button"
            >
              Sửa câu trả lời
            </button>
          </div>
          {activeResult && (
            <section
              className="demo-result-card"
              aria-label="Kết quả chấm Speaking"
            >
              <p className="demo-flow-eyebrow">
                {activeResult.mode === "mock"
                  ? "KẾT QUẢ MẪU CỐ ĐỊNH"
                  : "LIVE RESPONSE"}
              </p>
              <div className="demo-result-band">
                Band{" "}
                {activeResult.envelope.data.scorability.display_band
                  ? activeResult.envelope.data.estimated_band.overall.toFixed(1)
                  : "—"}
              </div>
              <div className="demo-result-criteria">
                {[
                  [
                    "Fluency",
                    activeResult.envelope.data.estimated_band.fluency_coherence,
                  ],
                  [
                    "Lexical",
                    activeResult.envelope.data.estimated_band.lexical_resource,
                  ],
                  [
                    "Grammar",
                    activeResult.envelope.data.estimated_band
                      .grammatical_range_accuracy,
                  ],
                  [
                    "Pronunciation",
                    activeResult.envelope.data.estimated_band.pronunciation,
                  ],
                ].map(([label, score]) => (
                  <div key={String(label)}>
                    <strong>{label}</strong>
                    <span>{Number(score).toFixed(1)}</span>
                  </div>
                ))}
              </div>
              <blockquote className="demo-result-transcript">
                {activeResult.envelope.data.transcript.text}
              </blockquote>
              <p>
                <strong>Nhận xét:</strong>{" "}
                {activeResult.envelope.data.feedback.summary_vi}
              </p>
              <p>
                <strong>Điểm tốt:</strong>{" "}
                {activeResult.envelope.data.feedback.strong_point_vi}
              </p>
              <p>
                <strong>Bước tiếp theo:</strong>{" "}
                {activeResult.envelope.data.feedback.action_plan_vi}
              </p>
            </section>
          )}
        </>
      )}

      {step === 5 && (
        <>
          <h3>Retry và lỗi</h3>
          <p>
            Các ví dụ request/response bên dưới được mô phỏng tại frontend;
            chúng không gọi API và không dùng quota.
          </p>
          <div className="demo-scenario-list">
            {SCENARIOS.map((item) => (
              <button
                aria-pressed={scenario === item.id}
                className={scenario === item.id ? "active" : ""}
                key={item.id}
                onClick={() => setScenario(item.id)}
                type="button"
              >
                {item.label}
                <br />
                <strong>{item.status}</strong>
              </button>
            ))}
          </div>
          <div className="demo-notice">
            <span aria-hidden="true">⚠</span> Khi key bị thu hồi sau bước 1,
            backend sẽ từ chối request chấm trước khi dispatch.
          </div>
          <div className="demo-notice" data-testid="speaking-retry-note">
            Speaking không có Idempotency-Key và demo không tự gửi lại. Bấm
            “Chấm thật” lần nữa là một lượt mới
            {environment === "production"
              ? " và có thể phát sinh chi phí thật."
              : ", dùng thêm một lượt trong hạn mức Sandbox."}
          </div>
        </>
      )}
    </DemoWorkbench>
  );
}
