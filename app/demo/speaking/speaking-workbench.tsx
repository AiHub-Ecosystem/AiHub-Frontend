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
import {
  demoEnvironmentHintFromApiKey,
  demoEnvironmentHost,
  demoEnvironmentName,
  demoEnvironmentRequiresSelection,
  type DemoEnvironment,
} from "@/lib/demo-environments";
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

/** Shown where a failed grade is retried and where retries are explained. */
function SpeakingRetryNote({ environment }: { environment: DemoEnvironment }) {
  return (
    <div className="demo-notice" data-testid="speaking-retry-note">
      Speaking không có Idempotency-Key và demo không tự gửi lại. Bấm “Chấm
      thật” lần nữa là một lượt mới
      {environment === "production"
        ? " và có thể phát sinh chi phí thật."
        : ", dùng thêm một lượt trong hạn mức Sandbox."}
    </div>
  );
}

const PARTS = [1, 2, 3] as const;
const SPEAKING_CLIENT_TIMEOUT_MS = 75_000;
const SPEAKING_FLOW_STAGES = [
  {
    title: "Học viên ghi âm, app gửi audio + câu hỏi",
    detail:
      "App gửi file audio cùng part, question_id, prompt_text và test_type tới server của bạn. API key chỉ được giữ ở server.",
    direction: "right",
  },
  {
    title: "POST …/speaking/grading",
    detail:
      "Server gắn X-API-Key và X-User-Identity, rồi gửi multipart/form-data tới AIHub. Speaking không dùng Idempotency-Key.",
    direction: "right",
  },
  {
    title: "Phân tích câu trả lời nói",
    detail:
      "AIHub xử lý audio, tạo transcript và đánh giá fluency, vocabulary, grammar, pronunciation.",
    direction: "none",
  },
  {
    title: "Trả transcript, estimated_band, feedback",
    detail:
      "Response gồm transcript, overall band, điểm 4 tiêu chí Speaking, nhận xét và kế hoạch cải thiện.",
    direction: "left",
  },
  {
    title: "Lưu kết quả, phản hồi học viên",
    detail:
      "Server lưu kết quả và trả transcript, band cùng feedback về app để học viên xem lại.",
    direction: "left",
  },
] as const;

function SpeakingFlowOverview() {
  const [flowStep, setFlowStep] = useState(0);
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);

  useEffect(() => {
    if (flowStep < 1 || flowStep > SPEAKING_FLOW_STAGES.length) return;
    const timer = window.setTimeout(
      () => setFlowStep((current) => current + 1),
      1100
    );
    return () => window.clearTimeout(timer);
  }, [flowStep]);

  const activeStep =
    hoveredStep ?? (flowStep <= SPEAKING_FLOW_STAGES.length ? flowStep : 0);
  const explanation = activeStep
    ? {
        tag: `Bước ${activeStep}`,
        text: SPEAKING_FLOW_STAGES[activeStep - 1].detail,
      }
    : flowStep > SPEAKING_FLOW_STAGES.length
      ? {
          tag: "Xong",
          text: "Đó là toàn bộ luồng. Kéo xuống “Thử chấm Speaking” để chạy demo và xem request/response ở bước 4.",
        }
      : {
          tag: "Gợi ý",
          text: "Mô phỏng này không gửi request. Bấm “Gửi câu trả lời” để chạy luồng, hoặc rê chuột/chọn từng chặng để xem giải thích.",
        };
  const running = flowStep > 0 && flowStep <= SPEAKING_FLOW_STAGES.length;

  return (
    <div className="scoring-overview">
      <section aria-labelledby="speaking-overview-title">
        <div className="scoring-overview-heading">
          <span className="scoring-overview-badge">TRƯỚC TIÊN</span>
          <h2 id="speaking-overview-title">
            Luồng hoạt động của Chấm điểm Speaking
          </h2>
          <span>Tổng quan trước khi thử demo</span>
        </div>

        <div className="scoring-overview-card">
          <article
            className="scoring-app-preview scoring-app-preview--compact"
            aria-label="Màn hình trả lời Speaking mẫu"
          >
            <div className="scoring-browser-bar">
              <span className="scoring-browser-dots" aria-hidden="true">
                <i /> <i /> <i />
              </span>
              <span className="scoring-overview-mono">
                app-cua-ban.com/speaking
              </span>
            </div>
            <div className="scoring-app-content">
              <p className="scoring-task-label">IELTS SPEAKING · PART 1–3</p>
              <p className="scoring-task-prompt">
                Trả lời câu hỏi theo từng phần của bài thi Speaking.
              </p>
              <div
                aria-label="Audio mẫu dài 24 giây"
                className="speaking-audio-preview"
                role="img"
              >
                <span className="speaking-audio-label scoring-overview-mono">
                  AUDIO MẪU
                </span>
                <span className="speaking-audio-player" aria-hidden="true">
                  <span className="speaking-audio-play">
                    <svg viewBox="0 0 12 14" focusable="false">
                      <path d="M1 1v12l10-6z" />
                    </svg>
                  </span>
                  <span className="speaking-audio-waveform">
                    {[
                      10, 17, 24, 13, 30, 38, 21, 15, 28, 42, 26, 18, 34, 46,
                      25, 16, 31, 22, 12, 27, 37, 19, 11,
                    ].map((height, index) => (
                      <i key={index} style={{ height }} />
                    ))}
                  </span>
                  <span className="speaking-audio-duration">00:24</span>
                </span>
              </div>
              <div className="scoring-essay-preview">
                Audio của Part 1, 2 hoặc 3 được gửi cùng question_id,
                prompt_text và test_type.
              </div>
              <div className="scoring-submit-row">
                <span>Bấm để chạy toàn bộ luồng</span>
                <button
                  className="scoring-overview-submit"
                  disabled={running}
                  onClick={() => {
                    setHoveredStep(null);
                    setFlowStep(
                      window.matchMedia("(prefers-reduced-motion: reduce)")
                        .matches
                        ? SPEAKING_FLOW_STAGES.length + 1
                        : 1
                    );
                  }}
                  type="button"
                >
                  {running
                    ? "Đang chạy…"
                    : flowStep > SPEAKING_FLOW_STAGES.length
                      ? "Chạy lại"
                      : "Gửi câu trả lời"}
                </button>
              </div>
            </div>
          </article>

          <div className="scoring-sequence" aria-label="Luồng chấm Speaking">
            <div className="scoring-lanes" aria-hidden="true">
              <div>
                <strong>App của bạn</strong>
                <span>học viên ghi âm</span>
              </div>
              <div>
                <strong>Server của bạn</strong>
                <span>giữ API key</span>
              </div>
              <div>
                <strong>AIHub</strong>
                <span>chấm Speaking</span>
              </div>
            </div>
            <div className="scoring-sequence-grid">
              {SPEAKING_FLOW_STAGES.map((item, index) => {
                const number = index + 1;
                const active = activeStep === number;
                const pending =
                  hoveredStep === null && running && number > flowStep;
                return (
                  <div
                    className={`scoring-flow-step scoring-flow-step--${number}`}
                    key={item.title}
                    onMouseEnter={() => setHoveredStep(number)}
                    onMouseLeave={() => setHoveredStep(null)}
                  >
                    <button
                      aria-current={active ? "step" : undefined}
                      aria-describedby="speaking-flow-explanation"
                      className="scoring-flow-step-button"
                      data-active={active || undefined}
                      data-pending={pending || undefined}
                      onFocus={() => setHoveredStep(number)}
                      onBlur={() => setHoveredStep(null)}
                      onClick={() => setHoveredStep(number)}
                      type="button"
                    >
                      <strong>{number}</strong>
                      {item.title}
                      {number === 2 && (
                        <small className="scoring-overview-mono">
                          X-API-Key · X-User-Identity
                        </small>
                      )}
                    </button>
                    {item.direction !== "none" && (
                      <span
                        aria-hidden="true"
                        className={`scoring-flow-arrow scoring-flow-arrow--${item.direction}`}
                      />
                    )}
                  </div>
                );
              })}
              <div
                className={`scoring-flow-result${flowStep >= 5 && hoveredStep === null ? " is-active" : flowStep > 0 && flowStep < 5 && hoveredStep === null ? " is-pending" : ""}`}
              >
                Hiển thị band + transcript + feedback
              </div>
            </div>
            <p
              className="scoring-flow-explanation"
              id="speaking-flow-explanation"
              aria-live="polite"
            >
              <span className="scoring-overview-badge">{explanation.tag}</span>
              <span>{explanation.text}</span>
            </p>
          </div>
        </div>
      </section>
      <section
        className="scoring-after-overview"
        aria-labelledby="speaking-demo-title"
      >
        <p className="demo-flow-eyebrow">SAU ĐÓ</p>
        <h2 id="speaking-demo-title">Thử chấm Speaking</h2>
      </section>
    </div>
  );
}

type Result = {
  part: SpeakingPart;
  envelope: SpeakingGradingEnvelope;
  mode: "mock" | "live";
};
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

function speakingMetric(
  value: number | null | undefined,
  unit: string,
  digits = 1
) {
  if (value == null) return "Chưa có dữ liệu";
  const formatted = Number.isInteger(value)
    ? String(value)
    : value.toFixed(digits);
  return `${formatted} ${unit}`;
}

function SpeakingResultReport({
  envelope,
  mode,
  part,
}: {
  envelope: SpeakingGradingEnvelope;
  mode: "mock" | "live";
  part: SpeakingPart;
}) {
  const { data } = envelope;
  const canDisplayBand =
    data.scorability.is_scorable && data.scorability.display_band;
  const criteria = [
    ["Fluency & Coherence", data.estimated_band.fluency_coherence, "coherence"],
    ["Lexical Resource", data.estimated_band.lexical_resource, "lexical"],
    ["Grammar", data.estimated_band.grammatical_range_accuracy, "grammar"],
    ["Pronunciation", data.estimated_band.pronunciation, "achieve"],
  ] as const;

  return (
    <section
      className="feedback-dashboard speaking-result-report"
      aria-label="Kết quả chấm Speaking"
      data-testid="speaking-result-report"
    >
      <div className="feedback-header">
        <div>
          <h3>Báo cáo chấm Speaking Part {part}</h3>
          <p>
            {mode === "mock"
              ? "Kết quả mẫu cố định."
              : `Mã yêu cầu ${envelope.meta.request_id}`}
          </p>
        </div>
        <span className="score-badge">
          {canDisplayBand
            ? `Overall Band: ${data.estimated_band.overall.toFixed(1)}`
            : "Chưa đủ dữ liệu chấm band"}
        </span>
      </div>

      {!canDisplayBand && data.scorability.message_vi && (
        <div className="demo-notice" role="status">
          {data.scorability.message_vi}
        </div>
      )}

      <div className="feedback-grid speaking-score-grid">
        {criteria.map(([label, score, tone]) => (
          <div className={`score-card criterion-card tone-${tone}`} key={label}>
            <div className="score-label">{label}</div>
            <div className="score-value">
              {canDisplayBand ? score.toFixed(1) : "—"} <em>/ 9.0</em>
            </div>
          </div>
        ))}
      </div>

      <div className="speaking-result-transcript">
        <div className="section-kicker">
          BẢN GHI CÂU TRẢ LỜI
          <span>
            {data.transcript.word_count} từ ·{" "}
            {data.transcript.duration_seconds.toFixed(1)} giây
          </span>
        </div>
        <div className="scoring-essay">{data.transcript.text}</div>
      </div>

      <div className="rubric-grid">
        <div className="rubric-card">
          <div className="section-kicker">MỨC ĐỘ LIÊN QUAN</div>
          <p>
            {data.relevance.on_topic ? "Đúng trọng tâm" : "Chưa sát câu hỏi"} ·{" "}
            {(data.relevance.score * 100).toFixed(0)}%
          </p>
          {data.relevance.feedback_vi && <p>{data.relevance.feedback_vi}</p>}
        </div>
        <div className="rubric-card">
          <div className="section-kicker">NHỊP NÓI</div>
          {data.fluency_metrics ? (
            <ul className="scoring-plain-list speaking-metric-list">
              <li>
                Tốc độ:{" "}
                {speakingMetric(
                  data.fluency_metrics.speech_rate_wpm,
                  "từ/phút"
                )}
              </li>
              <li>
                Số lần ngừng:{" "}
                {speakingMetric(data.fluency_metrics.pause_count, "lần", 0)}
              </li>
              <li>
                Độ dài trung bình mỗi mạch nói:{" "}
                {speakingMetric(
                  data.fluency_metrics.mean_length_run_words,
                  "từ"
                )}
              </li>
            </ul>
          ) : (
            <p>Chưa có dữ liệu nhịp nói cho lượt này.</p>
          )}
        </div>
      </div>

      <div className="rubric-grid">
        <div className="rubric-card">
          <div className="section-kicker">PHÁT ÂM THEO TỪ</div>
          <div className="speaking-pronunciation-stats">
            <span>
              <strong>{data.pronunciation_detail.summary.good_count}</strong>Tốt
            </span>
            <span>
              <strong>{data.pronunciation_detail.summary.fair_count}</strong>Cần
              luyện
            </span>
            <span>
              <strong>{data.pronunciation_detail.summary.poor_count}</strong>Cần
              chú ý
            </span>
          </div>
          {data.pronunciation_detail.words.length > 0 && (
            <details className="speaking-word-details">
              <summary>
                Chi tiết {data.pronunciation_detail.words.length} từ
              </summary>
              <ul className="scoring-plain-list">
                {data.pronunciation_detail.words.map((item, index) => (
                  <li key={`${item.word}-${index}`}>
                    <strong>{item.word}</strong> ·{" "}
                    {item.quality_score.toFixed(1)}% · {item.syllables.length}{" "}
                    âm tiết · {item.phonemes.length} âm
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
        <div className="rubric-card">
          <div className="section-kicker">NGÔN NGỮ</div>
          {data.language_analysis.grammar_errors.length === 0 ? (
            <p>Không có lỗi ngữ pháp được ghi nhận.</p>
          ) : (
            <ul className="scoring-plain-list">
              {data.language_analysis.grammar_errors.map((item, index) => (
                <li key={`${item.error_segment}-${index}`}>
                  “{item.error_segment}” → “{item.correction}” ·{" "}
                  {item.explanation_vi}
                </li>
              ))}
            </ul>
          )}
          {data.language_analysis.vocabulary_upgrades.length > 0 && (
            <ul className="scoring-plain-list speaking-vocabulary-list">
              {data.language_analysis.vocabulary_upgrades.map((item, index) => (
                <li key={`${item.original_word}-${index}`}>
                  <strong>
                    {item.original_word} → {item.suggested_word}
                  </strong>{" "}
                  ({item.cefr_level}) · {item.reason_vi}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rubric-grid">
        <div className="rubric-card">
          <div className="section-kicker">NHẬN XÉT</div>
          <p>{data.feedback.summary_vi}</p>
        </div>
        <div className="rubric-card">
          <div className="section-kicker">ĐIỂM TỐT &amp; BƯỚC TIẾP THEO</div>
          <p>
            <strong>Điểm tốt:</strong> {data.feedback.strong_point_vi}
          </p>
          <p>
            <strong>Bước tiếp theo:</strong> {data.feedback.action_plan_vi}
          </p>
        </div>
      </div>
    </section>
  );
}

export default function SpeakingWorkbench() {
  const {
    state,
    grading,
    beginGrading,
    endGrading,
    setApiKey,
    setEnvironment,
    selectionGeneration,
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
   * copyable artifact is the JSON endpoint with AIHUB's Published sample answer.
   * That recording answers one question only, so the body keeps its part and
   * question rather than the one selected on screen.
   */
  const copyableExports =
    step === 4
      ? buildDemoExports({
          environment,
          skill: "speaking",
          title: `Speaking Part ${SPEAKING_SAMPLE_ANSWER_REQUEST.part}`,
          path: "/v1/ielts/speaking/grading-json",
          headers: [
            { name: "X-User-Identity", value: "<your end-user id>" },
            { name: "Content-Type", value: "application/json" },
          ],
          body: SPEAKING_SAMPLE_ANSWER_REQUEST,
        })
      : null;

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
    const submittedEnvironment =
      demoEnvironmentHintFromApiKey(submittedKey) ?? environment;
    if (submittedEnvironment !== environment)
      setEnvironment(submittedEnvironment);
    const submittedGeneration = selectionGeneration();
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
      if (
        !isSelectionCurrent(
          submittedKey,
          submittedEnvironment,
          submittedGeneration
        )
      )
        return;
      receivedHttpResponse = true;
      setKeyCheckTrace(httpTrace(response));
      const payload: unknown = await response.json().catch(() => null);
      if (
        !isSelectionCurrent(
          submittedKey,
          submittedEnvironment,
          submittedGeneration
        )
      )
        return;
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
      if (
        !isSelectionCurrent(
          submittedKey,
          submittedEnvironment,
          submittedGeneration
        )
      )
        return;
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
    setSelectedId(
      MOCK_SPEAKING_PROMPTS.find((item) => item.part === part)?.id ?? ""
    );
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
          : "bản mẫu local · không gửi HTTP",
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
    const requestBodyPreview = {
      part,
      question_id: prompt?.id ?? "",
      prompt_text: prompt?.question ?? "",
      test_type: "Practice",
      audio: file
        ? {
            filename: file.name,
            bytes: file.size,
            type: file.type || "application/octet-stream",
            content: "<binary audio omitted>",
          }
        : "<audio file required for live grading>",
    };
    return pretty({
      method: "POST",
      url: `${demoEnvironmentHost(environment)}/v1/ielts/speaking/grading`,
      headers: {
        "X-API-Key":
          "${AIHUB_API_KEY:?Set AIHUB_API_KEY to your API key first}",
        "X-User-Identity": "<your end-user id>",
        "Content-Type":
          "multipart/form-data; boundary=<generated automatically>",
      },
      body: requestBodyPreview,
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
          : "Bản mẫu chỉ đọc; chưa gửi audio.",
      });
    return gradeResponse
      ? pretty(gradeResponse)
      : pretty({
          message: liveReady
            ? gradeAttempted
              ? "Request đã gửi nhưng chưa nhận response HTTP."
              : "Chưa gửi request."
            : "Chưa chọn hiển thị kết quả mẫu.",
        });
  };

  const traceNote = liveReady
    ? `Every live grading request reauthenticates the ${demoEnvironmentName(environment)} key before quota and dispatch; trace redacts the key.`
    : "Request is shown as a preview. The button returns a fixed frontend fixture; no grading API request is sent.";

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
          : submitting
            ? "GRADING"
            : !liveReady
              ? activeResult
                ? "KẾT QUẢ MẪU"
                : "READY"
              : gradeTrace
                ? `HTTP ${gradeTrace.status}`
                : gradeAttempted
                  ? "NO HTTP RESPONSE"
                  : "PREVIEW · NOT SENT";

  return (
    <DemoWorkbench
      skill="speaking"
      scope={SCOPE}
      title="Chấm IELTS Speaking"
      description={`Chọn Speaking Part, ghi âm hoặc tải câu trả lời lên khi dùng key ${demoEnvironmentName(environment)}. Bỏ qua key để xem fixture read-only và kết quả mẫu cố định.`}
      step={step}
      showTrace={step === 4}
      showEnvironmentPicker={demoEnvironmentRequiresSelection(apiKey.trim())}
      stepperDisabled={grading || submitting}
      mode={mode}
      status={traceStatus}
      request={requestForStep()}
      response={responseForStep()}
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
      productionKeyValidated={isScopeValidated(SCOPE) && Boolean(apiKey)}
      exports={copyableExports}
      overview={<SpeakingFlowOverview />}
      traceNote={traceNote}
    >
      <p className="demo-flow-eyebrow">
        BƯỚC {step} / {DEMO_STEPS.length} · {DEMO_STEPS[step - 1]}
      </p>

      {step === 1 && (
        <>
          <h3>Kiểm tra API key</h3>
          <p>
            Phiên mới mặc định dùng Sandbox. Key có tiền tố Sandbox hoặc
            Production sẽ được kiểm tra ở môi trường tương ứng; key không có
            tiền tố môi trường dùng môi trường hiện tại. Bước này xác thực scope{" "}
            <code>{SCOPE}</code>, không gọi AI và không dùng quota chấm.
          </p>
          <div className="demo-field">
            <label htmlFor="speaking-demo-key">
              API key (Sandbox hoặc Production, tùy chọn)
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
              placeholder="aihub_sandbox_… hoặc aihub_prod_…"
              spellCheck={false}
              type="password"
              value={apiKey}
            />
            <p className="demo-help">
              Backend kiểm tra môi trường và quyền chấm Speaking trước khi mở
              tính năng chấm thật.
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
              ? `Key ${demoEnvironmentName(environment)} đã xác thực. Chọn Part và câu hỏi từ danh sách; bước này chỉ tải câu hỏi, chưa gửi request chấm hoặc dùng quota.`
              : "Mẫu chỉ đọc: chọn Part và câu hỏi có sẵn để xem fixture. Nhập key hợp lệ ở bước 1 để tải câu hỏi và mở ghi âm/tải audio chấm live."}
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
              className="demo-btn-secondary"
              onClick={() => changeStep(1)}
              type="button"
            >
              Quay lại API key
            </button>
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
              ? "Key đã xác thực: ghi âm hoặc tải audio của bạn, rồi nghe lại, xóa hoặc thay tệp trước khi gửi ở bước 4. Tệp chỉ giữ trong bộ nhớ trang."
              : "Mẫu chỉ đọc: transcript tham khảo không chỉnh sửa được. Nhập key hợp lệ ở bước 1 để ghi âm/tải câu trả lời; kết quả mẫu luôn cố định."}
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
                  Tối đa 25 MB. Định dạng hỗ trợ: WAV, MP3, M4A, WebM hoặc OGG.
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
              : "Nút này chỉ hiển thị kết quả mẫu theo Part. Không gửi yêu cầu chấm bài."}
          </p>
          {error && (
            <div className="demo-error" role="alert">
              <strong>{error.code}</strong> · {error.message}
              {error.retry_after_ms
                ? ` Thử lại sau ${Math.ceil(error.retry_after_ms / 1000)} giây.`
                : ""}
            </div>
          )}
          {liveReady && error && (
            <SpeakingRetryNote environment={environment} />
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
            <SpeakingResultReport
              envelope={activeResult.envelope}
              mode={activeResult.mode}
              part={activeResult.part}
            />
          )}
        </>
      )}
    </DemoWorkbench>
  );
}
