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
import { isEndUserId } from "@/lib/end-user-id";
import { isDemoIdentityMode, isDemoUserIdentity } from "@/lib/demo-identity";
import { useDemoSession, type DemoScope } from "@/app/demo/demo-session";
import { sandboxAllowanceFrom } from "@/app/demo/demo-session-state";
import {
  DemoUserIdentityField,
  DemoWorkbench,
  type DemoStep,
} from "@/app/demo/demo-workbench";
import { errorFromPayload, type PublicError } from "../scoring/scoring-client";

const SCOPE: DemoScope = "speaking.grade";

/** Shown where a failed grade is retried and where retries are explained. */
function SpeakingRetryNote({ environment }: { environment: DemoEnvironment }) {
  return (
    <div className="demo-notice" data-testid="speaking-retry-note">
      Nếu lần chấm bị lỗi, hệ thống không tự thử lại. Bấm “Chấm thật” lần nữa sẽ
      tạo một lượt chấm mới
      {environment === "production"
        ? " và có thể phát sinh chi phí."
        : " và dùng thêm một lượt miễn phí."}
    </div>
  );
}

const PARTS = [1, 2, 3] as const;
const SPEAKING_STEPS = [
  "Nhập mã API",
  "Mã người dùng và câu hỏi",
  "Chuẩn bị câu trả lời",
  "Chấm và xem kết quả",
] as const;
const SPEAKING_CLIENT_TIMEOUT_MS = 75_000;
const SPEAKING_FLOW_STAGES = [
  {
    title: "Học viên ghi âm; ứng dụng gửi câu trả lời và câu hỏi",
    detail:
      "Ứng dụng gửi tệp ghi âm cùng câu hỏi đến hệ thống của bạn. Mã API được giữ an toàn ở đó.",
    direction: "right",
  },
  {
    title: "Hệ thống của bạn gửi bài nói lên AIHUB để chấm",
    detail: "Hệ thống của bạn gửi bản ghi âm và câu hỏi đến AIHUB để chấm.",
    direction: "right",
  },
  {
    title: "Nghe và đánh giá câu trả lời",
    detail:
      "AIHUB ghi lại nội dung câu trả lời, sau đó chấm độ trôi chảy, từ vựng, ngữ pháp và phát âm.",
    direction: "none",
  },
  {
    title: "Gửi điểm và nhận xét",
    detail:
      "Kết quả gồm điểm tổng thể, bản ghi lời nói, điểm từng tiêu chí và gợi ý luyện tập.",
    direction: "left",
  },
  {
    title: "Hệ thống của bạn gửi kết quả lại ứng dụng",
    detail: "Ứng dụng hiển thị điểm và nhận xét để học viên xem lại.",
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
          text: "Đó là toàn bộ các bước. Kéo xuống phần thực hành Speaking để thử và xem kết quả.",
        }
      : {
          tag: "Gợi ý",
          text: "Phần minh họa này không gửi bài đi chấm. Bấm “Gửi câu trả lời” để xem các bước, hoặc chọn từng chặng để đọc giải thích.",
        };
  const running = flowStep > 0 && flowStep <= SPEAKING_FLOW_STAGES.length;

  return (
    <div className="scoring-overview">
      <section aria-labelledby="speaking-overview-title">
        <div className="scoring-overview-heading">
          <span className="scoring-overview-badge">TRƯỚC TIÊN</span>
          <h2 id="speaking-overview-title">
            Các bước chấm IELTS Speaking (Part 1–3)
          </h2>
          <span>Tổng quan trước khi thực hành</span>
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
                aria-label="Bản ghi âm mẫu dài 24 giây"
                className="speaking-audio-preview"
                role="img"
              >
                <span className="speaking-audio-label scoring-overview-mono">
                  BẢN GHI ÂM MẪU
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
                Bản ghi âm và câu hỏi của Part 1, 2 hoặc 3 được gửi cùng nhau.
              </div>
              <div className="scoring-submit-row">
                <span>Chọn để xem các bước</span>
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
                <strong>Ứng dụng của bạn</strong>
                <span>học viên ghi âm</span>
              </div>
              <div>
                <strong>Hệ thống của bạn</strong>
                <span>giữ mã API</span>
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
                Hiển thị điểm, bản chép lời và nhận xét
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
    return {
      id: item.id,
      part,
      question: item.question,
      ...("sampleAudioUrl" in item &&
      typeof item.sampleAudioUrl === "string" &&
      item.sampleAudioUrl.length > 0
        ? { sampleAudioUrl: item.sampleAudioUrl }
        : {}),
    };
  });
  return prompts.some((item) => item === null)
    ? null
    : (prompts as SpeakingPrompt[]);
}

function fileProblem(file: File | null) {
  if (!file) return "Chọn hoặc ghi âm câu trả lời để chấm thật.";
  if (file.size < 100) return "Tệp ghi âm quá ngắn hoặc không có tiếng.";
  if (file.size > MAX_SPEAKING_BYTES) return "Tệp ghi âm cần nhỏ hơn 25 MB.";
  if (!/\.(wav|mp3|m4a|webm|ogg)$/i.test(file.name))
    return "Tệp ghi âm cần có định dạng WAV, MP3, M4A, WebM hoặc OGG.";
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
    [
      "Độ trôi chảy và mạch lạc",
      data.estimated_band.fluency_coherence,
      "coherence",
    ],
    ["Từ vựng", data.estimated_band.lexical_resource, "lexical"],
    ["Ngữ pháp", data.estimated_band.grammatical_range_accuracy, "grammar"],
    ["Phát âm", data.estimated_band.pronunciation, "achieve"],
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
              ? "Đây là điểm và nhận xét mẫu có sẵn."
              : `Mã kết quả: ${envelope.meta.request_id}`}
          </p>
        </div>
        <span className="score-badge">
          {canDisplayBand
            ? `Điểm tổng thể: ${data.estimated_band.overall.toFixed(1)}`
            : "Chưa đủ dữ liệu để chấm điểm tổng thể"}
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
          NỘI DUNG ĐÃ NHẬN DIỆN
          <span>
            {data.transcript.word_count} từ ·{" "}
            {data.transcript.duration_seconds.toFixed(1)} giây
          </span>
        </div>
        <div className="scoring-essay">{data.transcript.text}</div>
      </div>

      <div className="rubric-grid">
        <div className="rubric-card">
          <div className="section-kicker">
            CÂU TRẢ LỜI CÓ ĐÚNG TRỌNG TÂM KHÔNG?
          </div>
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
          <div className="section-kicker">CÁCH PHÁT ÂM TỪNG TỪ</div>
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
                Xem nhận xét về {data.pronunciation_detail.words.length} từ
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
          <div className="section-kicker">GỢI Ý VỀ NGỮ PHÁP VÀ TỪ VỰNG</div>
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
                  · {item.reason_vi}
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
    userIdentity,
    setUserIdentity,
    isUserIdentityExpired,
    setUserIdentityMode,
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
  const [selectedId, setSelectedId] = useState(
    SPEAKING_SAMPLE_ANSWER_REQUEST.question_id
  );
  const [sampleAudioRemoved, setSampleAudioRemoved] = useState(false);
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
    apiKey.trim().length > 0 &&
    isScopeValidated(SCOPE) &&
    state.userIdentityMode !== null &&
    !skipMock;
  const userIdentityValid =
    state.userIdentityMode === "signed_assertion"
      ? isDemoUserIdentity(userIdentity) && !isUserIdentityExpired()
      : state.userIdentityMode === "declared_id" && isEndUserId(userIdentity);
  const identityTraceValue =
    state.userIdentityMode === "signed_assertion"
      ? "<redacted signed user assertion>"
      : userIdentityValid
        ? userIdentity
        : "<your end-user id>";
  const handleUserIdentityChange = (value: string) => {
    setUserIdentity(value);
    setResult(null);
    setGradeResponse(null);
    setGradeTrace(null);
    setGradeAttempted(false);
    setError(null);
  };
  const mode = liveReady ? "live" : "mock";
  const localPrompts = MOCK_SPEAKING_PROMPTS.filter(
    (item) => item.part === part
  );
  const prompts = livePrompts ?? (liveReady ? [] : localPrompts);
  const prompt = prompts.find((item) => item.id === selectedId);
  const sampleAudioUrl =
    !file && !sampleAudioRemoved && prompt
      ? prompt.id === SPEAKING_SAMPLE_ANSWER_REQUEST.question_id
        ? SPEAKING_SAMPLE_ANSWER_REQUEST.audio_url
        : prompt.sampleAudioUrl
      : undefined;
  const sampleAnswerRequest =
    sampleAudioUrl && prompt
      ? {
          audio_url: sampleAudioUrl,
          part: prompt.part,
          question_id: prompt.id,
          prompt_text: prompt.question,
          test_type: "Practice",
        }
      : null;
  const sampleAudioSelected = sampleAnswerRequest !== null;
  const activeResult = result?.part === part ? result : null;
  const currentFileProblem = sampleAudioSelected ? null : fileProblem(file);
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
    if (step !== 2) return;
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
            "Danh sách câu hỏi nhận được chưa đúng. Hãy thử tải lại."
          );
        if (loaded.length === 0)
          throw new Error(`Hiện chưa có câu hỏi cho Part ${part}.`);
        if (cancelled) return;
        setLivePrompts(loaded);
        setSelectedId((current) =>
          loaded.some((item) => item.id === current) ? current : ""
        );
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setLivePrompts(null);
        setQuestionError(
          caught instanceof Error
            ? caught.message
            : "Không tải được câu hỏi Speaking. Hãy thử lại."
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
  }, [step, part, environment]);

  useEffect(
    () => () => {
      recorder.current?.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
    },
    []
  );

  const requestBody = sampleAnswerRequest
    ? sampleAnswerRequest
    : {
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
          apiKey: liveReady ? apiKey.trim() : undefined,
          path: "/v1/ielts/speaking/grading-json",
          headers: [
            {
              name: "X-User-Identity",
              value: identityTraceValue,
            },
            { name: "Content-Type", value: "application/json" },
          ],
          body: SPEAKING_SAMPLE_ANSWER_REQUEST,
        })
      : null;

  const changeStep = (next: DemoStep) => {
    if (
      step === 3 &&
      next === 4 &&
      (recording || recorder.current?.state === "recording")
    )
      return;
    if (step === 3 && next !== 3 && recorder.current?.state === "recording") {
      recorder.current.stop();
    }
    if (step === 2 && next === 3 && !file) setSampleAudioRemoved(false);
    if (next === 2 && step !== 2) {
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
        message: "Dán mã API hoặc chọn xem câu hỏi mẫu.",
      });
      return;
    }
    setCheckingKey(true);
    setKeyError(null);
    setSkipMock(false);
    setQuestionLoading(true);
    setQuestionError(null);
    setQuestionResponse(null);
    setQuestionTrace(null);
    setLivePrompts(null);
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
          message:
            "Không đọc được kết quả kiểm tra mã API. Thử lại hoặc xem câu hỏi mẫu.",
        } satisfies PublicError;
      }
      if (
        !("user_identity_mode" in payload.data) ||
        !isDemoIdentityMode(payload.data.user_identity_mode)
      ) {
        throw {
          code: "AI_SERVICE_CONTRACT_VIOLATION",
          message:
            "AIHUB chưa xác nhận cách nhận diện người dùng. Hãy thử lại; nếu lỗi tiếp tục, liên hệ bộ phận hỗ trợ.",
        } satisfies PublicError;
      }
      setUserIdentityMode(payload.data.user_identity_mode);
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
              message:
                "Không kiểm tra được mã API. Thử lại hoặc xem câu hỏi mẫu.",
            };
      if (publicError.code === "AI_SERVICE_CONTRACT_VIOLATION")
        setUserIdentityMode(null);
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
    setSampleAudioRemoved(false);
    setSelectedId(
      MOCK_SPEAKING_PROMPTS.find((item) => item.part === part)?.id ?? ""
    );
    setQuestionLoading(false);
    setQuestionError(null);
    setQuestionResponse(null);
    setQuestionTrace(null);
    setLivePrompts(null);
    setResult(null);
    setError(null);
    setKeyError(null);
    setGradeResponse(null);
    setGradeTrace(null);
    setGradeAttempted(false);
    setKeyCheckResponse({
      mode: "mock",
      request: null,
      message: "Đã bỏ qua bước kiểm tra mã API; đang dùng bài mẫu có sẵn.",
    });
    setKeyCheckTrace(null);
    setStep(2);
  };

  const choosePart = (value: SpeakingPart) => {
    if (value === part) return;
    setPart(value);
    if (step === 2) {
      setQuestionLoading(true);
      setQuestionError(null);
      setQuestionTrace(null);
      setQuestionResponse({
        state: "pending",
        request: `/v1/ielts/speaking/questions?part=${value}`,
      });
    }
    setSelectedId("");
    setSampleAudioRemoved(false);
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
    if (problem && problem !== "Chọn hoặc ghi âm câu trả lời để chấm thật.") {
      setError({ code: "INVALID_REQUEST", message: problem });
      return;
    }
    setFile(next);
    setSampleAudioRemoved(true);
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
          "Trình duyệt không hỗ trợ ghi âm. Hãy chọn tệp ghi âm để tiếp tục."
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
        message:
          "Chưa tải được câu hỏi. Hãy thử lại; câu hỏi mẫu chỉ dùng để xem trước.",
      });
      return;
    }
    const identityExpired = isUserIdentityExpired();
    if (identityExpired || !userIdentityValid) {
      setError({
        code: "INVALID_USER_IDENTITY",
        message: identityExpired
          ? "Assertion đã hết hạn. Hãy lấy assertion mới trước khi tiếp tục."
          : state.userIdentityMode === "signed_assertion"
            ? "Dán Signed User Assertion do máy chủ tổ chức cấp (tối đa 6 KiB)."
            : "Nhập Declared User ID gồm 1–256 ký tự, không chứa khoảng trắng.",
      });
      return;
    }
    // The first Production grade of a visit needs the billable acknowledgement;
    // it is not a spend cap, only a gate the backend still enforces afterwards.
    if (requiresProductionAcknowledgement()) {
      setError({
        code: "PRODUCTION_ACKNOWLEDGEMENT_REQUIRED",
        message:
          "Hãy xác nhận trong phần “Nơi chấm bài” rằng lượt chấm trên môi trường thật có thể phát sinh chi phí.",
      });
      return;
    }
    const problem = sampleAudioSelected ? null : fileProblem(file);
    if (problem) {
      setError({ code: "INVALID_REQUEST", message: problem });
      return;
    }
    if (!prompt || (!file && !sampleAudioSelected)) return;
    if (!beginGrading()) return;

    setSubmitting(true);
    setGradeAttempted(true);
    setGradeTrace(null);
    const form = sampleAudioSelected ? null : new FormData();
    if (form && file) {
      form.append("audio", file, file.name);
      form.append("part", String(part));
      form.append("question_id", prompt.id);
      form.append("prompt_text", prompt.question);
      form.append("test_type", "Practice");
    }
    const gradingPath = sampleAudioSelected
      ? "/api/demo/speaking/grading-json"
      : "/api/demo/speaking/grading";
    setGradeResponse({
      state: "pending",
      request: `/v1/ielts/speaking/${
        sampleAudioSelected ? "grading-json" : "grading"
      } · Part ${part}`,
    });
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort("speaking-client-timeout"),
      SPEAKING_CLIENT_TIMEOUT_MS
    );
    let receivedHttpResponse = false;
    let responseTrace: HttpTrace | null = null;
    try {
      const response = await fetch(gradingPath, {
        method: "POST",
        headers: {
          "X-Demo-API-Key": apiKey.trim(),
          "X-Demo-Environment": environment,
          "X-Demo-User-Identity": userIdentity,
          ...(sampleAudioSelected
            ? { "Content-Type": "application/json" }
            : {}),
        },
        body: sampleAudioSelected ? JSON.stringify(sampleAnswerRequest) : form,
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
      ? `AIHUB · HTTP ${trace.status}\nContent-Type: ${trace.contentType ?? "(không có)"}\nCache-Control: ${trace.cacheControl ?? "(không có)"}`
      : "Chưa nhận được thông tin phản hồi.";

  const requestForStep = () => {
    if (step === 1) {
      if (validationSkipped)
        return pretty({
          source: "đã chọn xem bài mẫu",
          http_request: null,
          message: "Đã bỏ qua bước kiểm tra mã API; đang xem bài mẫu.",
        });
      if (!apiKey.trim() && !keyCheckResponse)
        return pretty({
          http_request: null,
          message: "Bạn có thể bỏ qua mã API để xem bài mẫu.",
        });
      return pretty({
        source: checkingKey
          ? "đang kiểm tra mã API"
          : keyCheckTrace
            ? "đã nhận kết quả kiểm tra mã"
            : keyCheckResponse
              ? "chưa nhận được kết quả kiểm tra mã"
              : "chưa gửi yêu cầu kiểm tra mã",
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
            source: "đang tải danh sách câu hỏi",
            browser_to_aihub_bff: {
              method: "GET",
              path: `/api/demo/speaking/questions?part=${part}`,
            },
            bff_to_selected_environment: {
              environment: demoEnvironmentName(environment),
              method: "GET",
              path: `/v1/ielts/speaking/questions?part=${part}`,
            },
            note: "Chỉ tải câu hỏi; chưa gửi bài chấm.",
          })
        : pretty({
            source: "catalog mẫu công khai",
            browser_to_aihub_bff: {
              method: "GET",
              path: `/api/demo/speaking/questions?part=${part}`,
            },
            bff_to_selected_environment: {
              environment: demoEnvironmentName(environment),
              method: "GET",
              path: `/v1/ielts/speaking/questions?part=${part}`,
            },
            note: "Chỉ tải câu hỏi và audio mẫu; chưa gửi bài chấm.",
          });
    if (step === 3)
      return pretty({
        source: liveReady ? "bản xem trước · chưa gửi" : "bài mẫu · chưa gửi",
        planned_request: liveReady
          ? {
              method: "POST",
              path: sampleAudioSelected
                ? "/api/demo/speaking/grading-json"
                : "/api/demo/speaking/grading",
              upstream_path: sampleAudioSelected
                ? "/v1/ielts/speaking/grading-json"
                : "/v1/ielts/speaking/grading",
              headers: {
                "X-Demo-API-Key": "[REDACTED]",
                "X-Demo-User-Identity": identityTraceValue,
                "Content-Type": sampleAudioSelected
                  ? "application/json"
                  : "multipart/form-data; browser generated boundary",
              },
            }
          : null,
        body_preview: requestBody,
        sent: false,
      });
    const requestBodyPreview = sampleAnswerRequest
      ? sampleAnswerRequest
      : {
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
    const gradingPath = sampleAudioSelected ? "grading-json" : "grading";
    return pretty({
      method: "POST",
      url: `${demoEnvironmentHost(environment)}/v1/ielts/speaking/${gradingPath}`,
      headers: {
        "X-API-Key": liveReady ? apiKey.trim() : "[chưa có mã API hợp lệ]",
        "X-User-Identity": identityTraceValue,
        "Content-Type": sampleAudioSelected
          ? "application/json"
          : "multipart/form-data; boundary=<generated automatically>",
      },
      body: requestBodyPreview,
    });
  };

  const responseForStep = () => {
    if (step === 1)
      return validationSkipped
        ? pretty({
            source: "đã chọn xem bài mẫu",
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
              message: "Chưa kiểm tra mã API.",
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
                ? { state: "đang tải câu hỏi" }
                : { state: "chưa nhận được kết quả" }),
          })
        : pretty({
            source: "catalog mẫu công khai",
            http: questionTrace
              ? {
                  status: questionTrace.status,
                  headers: responseHeaderSummary(questionTrace),
                }
              : null,
            body:
              questionResponse ??
              (questionLoading
                ? { state: "đang tải câu hỏi" }
                : { state: "chưa nhận được kết quả" }),
          });
    if (step === 3)
      return pretty({
        source: "bản xem trước",
        http_response: null,
        message: liveReady
          ? "Chưa gửi bài. Bản ghi âm chỉ được gửi ở bước 4 sau khi bấm chấm."
          : "Đây là bài mẫu; chưa gửi bản ghi âm.",
      });
    return gradeResponse
      ? pretty(gradeResponse)
      : pretty({
          message: liveReady
            ? gradeAttempted
              ? "Đã gửi bài nhưng chưa nhận được kết quả."
              : "Chưa gửi bài đi chấm."
            : "Chưa xem kết quả mẫu.",
        });
  };

  const traceNote = liveReady
    ? state.userIdentityMode === "signed_assertion"
      ? "Mã API xuất hiện trong thông tin gửi đi; Signed User Assertion được che trong trace và lệnh sao chép."
      : "Mã API xuất hiện trong thông tin gửi đi và lệnh được sao chép. Hãy giữ kín ảnh chụp và nội dung đã sao chép."
    : "Nút này chỉ hiển thị kết quả mẫu có sẵn; bài của bạn không được gửi đi chấm.";

  const traceStatus =
    step === 1
      ? validationSkipped
        ? "Đã bỏ qua, đang xem bài mẫu"
        : checkingKey
          ? "Đang kiểm tra mã API"
          : keyCheckTrace
            ? `HTTP ${keyCheckTrace.status}`
            : keyError
              ? "Mã API chưa hợp lệ"
              : apiKey.trim()
                ? "Chưa gửi mã đi kiểm tra"
                : "Có thể bỏ qua mã API"
      : step === 2
        ? questionLoading
          ? "Đang tải câu hỏi"
          : liveReady
            ? questionTrace
              ? `HTTP ${questionTrace.status}`
              : questionError
                ? "Chưa tải được câu hỏi"
                : "Đã tải câu hỏi"
            : "Danh sách câu hỏi mẫu"
        : step === 3
          ? liveReady
            ? "Bài đã sẵn sàng · chưa gửi"
            : "Đang xem bài mẫu"
          : submitting
            ? "Đang chấm bài"
            : !liveReady
              ? activeResult
                ? "Kết quả mẫu có sẵn"
                : "Sẵn sàng"
              : gradeTrace
                ? `HTTP ${gradeTrace.status}`
                : gradeAttempted
                  ? "Chưa nhận được kết quả"
                  : "Chưa gửi bài";

  return (
    <DemoWorkbench
      skill="speaking"
      title="Chấm IELTS Speaking"
      description="Chọn câu hỏi Speaking, ghi âm hoặc tải câu trả lời lên để chấm thật. Bạn cũng có thể xem bài mẫu có sẵn mà không cần mã API."
      step={step}
      steps={SPEAKING_STEPS}
      showTrace={step === 4}
      showEnvironmentPicker={demoEnvironmentRequiresSelection(apiKey.trim())}
      stepperDisabled={grading || submitting}
      mode={mode}
      status={traceStatus}
      request={requestForStep()}
      response={responseForStep()}
      sensitiveValue={
        state.userIdentityMode === "signed_assertion" ? userIdentity : undefined
      }
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
      exportsContainApiKey={liveReady}
      overview={<SpeakingFlowOverview />}
      traceNote={traceNote}
    >
      <p className="demo-flow-eyebrow">
        BƯỚC {step} / {SPEAKING_STEPS.length} · {SPEAKING_STEPS[step - 1]}
      </p>

      {step === 1 && (
        <>
          <h3>Nhập mã API</h3>
          <div className="demo-field">
            <label htmlFor="speaking-demo-key">Mã API (không bắt buộc)</label>
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
              placeholder="Dán mã API của bạn tại đây"
              spellCheck={false}
              type="password"
              value={apiKey}
            />
            <p className="demo-help">
              Nhập mã API để tải câu hỏi và gửi bài chấm thật. Bạn có thể bỏ qua
              bước này để xem bài mẫu; môi trường dùng thử miễn phí, môi trường
              thật có thể tính phí.
            </p>
          </div>
          {keyError && (
            <div className="demo-error" role="alert">
              {keyError.message}
            </div>
          )}
          {isScopeValidated(SCOPE) && apiKey && (
            <div className="demo-success">
              Mã API đã được xác nhận. Mã sẽ được kiểm tra lại mỗi lần bạn gửi
              bài.
            </div>
          )}
          <div className="demo-step-actions">
            <button
              className="demo-btn-primary"
              disabled={grading || checkingKey || !apiKey.trim()}
              onClick={validateKey}
              type="button"
            >
              {checkingKey ? "Đang kiểm tra… " : ""}Kiểm tra mã API
            </button>
            <button
              className="demo-btn-secondary"
              disabled={grading || checkingKey}
              onClick={useMock}
              type="button"
            >
              Xem câu hỏi mẫu
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          {liveReady && state.userIdentityMode && (
            <DemoUserIdentityField
              key={state.userIdentityMode}
              disabled={checkingKey || grading}
              id="speaking-demo-user-identity"
              mode={state.userIdentityMode}
              onChange={handleUserIdentityChange}
              value={userIdentity}
            />
          )}
          <h3>Chọn câu hỏi Speaking</h3>
          <p>
            {liveReady
              ? state.userIdentityMode === "signed_assertion"
                ? "Mã API đã được xác nhận. Lấy assertion từ endpoint của tổ chức hoặc nhập thủ công, rồi chọn câu hỏi để chấm thật."
                : "Mã API đã được xác nhận. Bạn có thể đổi Declared User ID ở trên, rồi chọn câu hỏi để chấm thật."
              : "Chọn Part và câu hỏi mẫu để xem thử. Nhập mã API ở bước 1 nếu muốn tải câu hỏi mới và gửi ghi âm đi chấm thật."}
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
              Đang tải danh sách câu hỏi…
            </p>
          )}
          {questionError && liveReady && (
            <div className="demo-error" role="alert">
              {questionError} Không thể dùng câu hỏi mẫu để chấm thật. Quay lại
              bước 1 và chọn “Xem câu hỏi mẫu” để xem bài mẫu.
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
                  setFile(null);
                  setSampleAudioRemoved(false);
                  setResult(null);
                  setGradeResponse(null);
                  setGradeTrace(null);
                  setGradeAttempted(false);
                  setError(null);
                }}
                type="button"
              >
                <strong>{item.question}</strong>
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
              Quay lại nhập mã API
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
          <h3>Câu trả lời bằng ghi âm</h3>
          {prompt && (
            <div className="demo-notice">
              <strong>Part {part} · Câu hỏi đã chọn</strong>
              <br />
              {prompt.question}
              {prompt.cue && (
                <>
                  <br />
                  <strong>Gợi ý:</strong> {prompt.cue}
                </>
              )}
            </div>
          )}
          <p>
            {liveReady
              ? sampleAudioSelected
                ? "Câu trả lời ghi âm mẫu đã có sẵn. Bạn có thể nghe thử, xóa để chọn tệp khác hoặc ghi âm câu trả lời của mình."
                : "Chọn tệp ghi âm hoặc tự ghi âm câu trả lời. Bạn có thể nghe lại, xóa hoặc thay tệp trước khi gửi ở bước 4. Tệp chỉ dùng trong lần mở trang này."
              : sampleAudioSelected
                ? "Bạn có thể nghe câu trả lời mẫu nhưng không thể xóa hoặc thay đổi. Kết quả hiển thị là nhận xét mẫu có sẵn."
                : `Hiện chưa có câu trả lời ghi âm mẫu cho câu hỏi này. Bạn vẫn có thể xem câu hỏi Part ${part} và kết quả mẫu.`}
          </p>
          {!liveReady ? (
            sampleAudioSelected ? (
              <div className="demo-field">
                <span className="demo-field-label">
                  Câu trả lời ghi âm mẫu · Part {part}
                </span>
                <audio
                  aria-label="Nghe bản ghi âm mẫu Speaking"
                  className="demo-audio-player"
                  controls
                  preload="metadata"
                  src={sampleAudioUrl}
                />
              </div>
            ) : (
              <div className="demo-notice" role="status">
                Chưa có câu trả lời ghi âm mẫu cho câu hỏi này.
              </div>
            )
          ) : (
            <>
              <input
                accept=".wav,.mp3,.m4a,.webm,.ogg,audio/*"
                aria-label="Chọn tệp ghi âm Speaking"
                className="demo-sr-only"
                data-testid="input-audio-file"
                onChange={(event) => {
                  const next = event.currentTarget.files?.[0] ?? null;
                  event.currentTarget.value = "";
                  saveFile(next);
                }}
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
                  Chọn tệp ghi âm
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
                    : sampleAudioSelected
                      ? "Câu trả lời ghi âm mẫu có sẵn"
                      : "Chưa chọn tệp ghi âm."}
              </div>
              {file ? (
                <audio
                  aria-label="Nghe lại bản ghi âm đã chọn"
                  className="demo-audio-player"
                  controls
                  ref={audioPlayer}
                />
              ) : sampleAudioSelected ? (
                <audio
                  aria-label="Nghe bản ghi âm mẫu Speaking"
                  className="demo-audio-player"
                  controls
                  preload="metadata"
                  src={sampleAudioUrl}
                />
              ) : null}
              {(file || sampleAudioSelected) && (
                <button
                  className="demo-btn-secondary"
                  onClick={() => {
                    setFile(null);
                    setSampleAudioRemoved(true);
                    setResult(null);
                    setGradeResponse(null);
                    setGradeTrace(null);
                    setGradeAttempted(false);
                    setError(null);
                  }}
                  type="button"
                >
                  Xóa tệp ghi âm
                </button>
              )}
              {file && (
                <p className="demo-help">
                  Tệp ghi âm tối đa 25 MB. Hỗ trợ WAV, MP3, M4A, WebM hoặc OGG.
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
                recording ||
                (liveReady &&
                  (!prompt ||
                    !livePrompts?.length ||
                    (!file && !sampleAudioSelected) ||
                    !!currentFileProblem))
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
          {liveReady && state.userIdentityMode && (
            <DemoUserIdentityField
              key={state.userIdentityMode}
              disabled={checkingKey || grading}
              id="speaking-demo-user-identity"
              mode={state.userIdentityMode}
              onChange={handleUserIdentityChange}
              value={userIdentity}
            />
          )}
          <h3>{liveReady ? "Gửi bài nói để chấm" : "Xem kết quả mẫu"}</h3>
          <p>
            {liveReady
              ? `Bản ghi âm ${sampleAudioSelected ? "mẫu có sẵn" : "của bạn"} sẽ được gửi đi chấm. Mã API được kiểm tra lại trước khi gửi.`
              : "Nút này chỉ hiển thị điểm và nhận xét mẫu theo Part. Bản ghi của bạn không được gửi đi chấm."}
          </p>
          {error && (
            <div className="demo-error" role="alert">
              {error.message}
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
                    (!file && !sampleAudioSelected) ||
                    !!currentFileProblem))
              }
              onClick={grade}
              type="button"
            >
              {submitting
                ? "Đang chấm…"
                : liveReady
                  ? `Chấm thật Part ${part}`
                  : `Xem kết quả mẫu Part ${part}`}
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
