import { useMemo, useState } from "react";
import { CircleCheck, Lightbulb } from "lucide-react";

import type { WritingGradingEnvelope } from "@/data/scoring-response";

import { toneFor } from "./scoring-client";

const CRITERION_ABBR: Record<string, string> = {
  task_achievement: "TA",
  task_response: "TR",
  coherence_cohesion: "CC",
  lexical_resource: "LR",
  grammatical_range_accuracy: "GRA",
};

export function CriterionBadge({ criterionId }: { criterionId: string }) {
  return (
    <span className={`criterion-badge tone-${toneFor(criterionId)}`}>
      {CRITERION_ABBR[criterionId] ?? "—"}
    </span>
  );
}

export function GradeReport({
  result,
  essay,
  task,
}: {
  result: WritingGradingEnvelope;
  essay: string;
  task: 1 | 2;
}) {
  const { data } = result;
  const [selected, setSelected] = useState<number | null>(null);

  /**
   * Each annotation's quote becomes a chip in the essay. Quotes are located by
   * their index in the submitted text; a quote the essay does not contain is
   * still listed, it just has no inline anchor.
   */
  const anchored = useMemo(
    () =>
      data.annotations
        .map((annotation, order) => ({
          annotation,
          order,
          index: essay.indexOf(annotation.quote),
        }))
        .filter((item) => item.index >= 0)
        .sort((a, b) => a.index - b.index),
    [data.annotations, essay]
  );

  const segments = useMemo(() => {
    const parts: Array<
      | { kind: "text"; value: string }
      | { kind: "quote"; order: number; value: string }
    > = [];
    let cursor = 0;
    for (const item of anchored) {
      if (item.index < cursor) continue;
      if (item.index > cursor) {
        parts.push({ kind: "text", value: essay.slice(cursor, item.index) });
      }
      parts.push({
        kind: "quote",
        order: item.order,
        value: item.annotation.quote,
      });
      cursor = item.index + item.annotation.quote.length;
    }
    if (cursor < essay.length) {
      parts.push({ kind: "text", value: essay.slice(cursor) });
    }
    return parts;
  }, [anchored, essay]);

  return (
    <div className="feedback-dashboard" data-testid="scoring-report">
      <div className="feedback-header">
        <div>
          <h3>Báo cáo chấm bài Task {task}</h3>
          <p>
            AIHUB Writing rubric · ngôn ngữ {data.language} · request{" "}
            {result.meta.request_id}
          </p>
        </div>
        <span className="score-badge">Overall Band: {data.overall_band}</span>
      </div>

      <div className="feedback-grid">
        {data.criteria.map((criterion) => (
          <div
            className={`score-card criterion-card tone-${toneFor(criterion.id)}`}
            key={criterion.id}
          >
            <div className="score-label">
              <span>{criterion.name}</span>
              <CriterionBadge criterionId={criterion.id} />
            </div>
            <div className="score-value">
              {criterion.band} <em>/ 9.0</em>
            </div>
          </div>
        ))}
      </div>

      <div className="transcript-section">
        <div className="section-kicker">
          BÀI LÀM &amp; NHẬN XÉT TỪNG CHỖ
          {/* "0 chỗ được trích" reads as a broken count rather than a verdict,
              so an unquoted essay says so outright. */}
          <span>
            {data.annotations.length === 0
              ? "Không có chỗ nào bị trích ra"
              : `${data.annotations.length} chỗ được trích`}
          </span>
        </div>
        <div className="scoring-essay" data-testid="scoring-essay">
          {segments.map((segment, index) =>
            segment.kind === "text" ? (
              <span key={"t" + index}>{segment.value}</span>
            ) : (
              <button
                aria-pressed={selected === segment.order}
                className={`word-chip criterion-chip tone-${toneFor(
                  data.annotations[segment.order].criterion
                )}`}
                data-testid={`annotation-chip-${segment.order}`}
                key={"q" + index}
                onClick={() =>
                  setSelected(selected === segment.order ? null : segment.order)
                }
                type="button"
              >
                {segment.value}
              </button>
            )
          )}
        </div>

        {selected !== null && data.annotations[selected] && (
          <div
            className={`scoring-annotation tone-${toneFor(
              data.annotations[selected].criterion
            )}`}
            data-testid="scoring-annotation-detail"
          >
            <div className="scoring-annotation-head">
              <CriterionBadge
                criterionId={data.annotations[selected].criterion}
              />
              <code className="scoring-annotation-issue">
                {data.annotations[selected].issue}
              </code>
            </div>
            <blockquote>{data.annotations[selected].quote}</blockquote>
            <p>{data.annotations[selected].explanation}</p>
          </div>
        )}
      </div>

      <div className="rubric-grid scoring-criteria">
        {data.criteria.map((criterion) => (
          <div
            className={`rubric-card criterion-card tone-${toneFor(criterion.id)}`}
            key={criterion.id}
          >
            <div className="section-kicker">
              <CriterionBadge criterionId={criterion.id} />
              {criterion.name} · Band {criterion.band}
            </div>
            <p>{criterion.band_reason}</p>
            <div className="scoring-criterion-lists">
              <div>
                <span className="section-kicker">Điểm mạnh</span>
                <ul>
                  {criterion.strengths.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <span className="section-kicker">Cần cải thiện</span>
                <ul>
                  {criterion.improvements.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rubric-grid">
        <div className="rubric-card">
          <div className="section-kicker">
            <Lightbulb size={11} /> Gợi ý
          </div>
          <ul className="scoring-plain-list">
            {data.suggestions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="rubric-card">
          <div className="section-kicker">
            <CircleCheck size={11} /> Bước tiếp theo
          </div>
          <ul className="scoring-plain-list">
            {data.next_steps.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
