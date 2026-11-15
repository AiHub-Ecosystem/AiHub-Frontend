import { EXERCISE_TYPE_LABELS, type ExerciseType } from "@/data/aiwriting";

type AcademicAnswerDetails = {
  sample_answer?: string;
  answer?: string;
  ai_grading_rubric?: string;
  explanation?: string;
};

type AcademicCorrectAnswer =
  string | Array<string | number> | number | AcademicAnswerDetails | null;

type AcademicExercise = {
  questions_no?: number | string;
  question_text?: string;
  question?: string;
  question_image?: string | null;
  image?: string | null;
  image_url?: string | null;
  imageUrl?: string | null;
  chart?: string | null;
  options?: Record<string, string>;
  choices?: string[];
  items?: string[];
  correct?: AcademicCorrectAnswer;
  hint?: string[] | string;
  ai_grading_rubric?: string;
  explanation?: string;
};

function answerDetails(
  answer: AcademicCorrectAnswer | undefined
): AcademicAnswerDetails | null {
  return typeof answer === "object" && answer !== null && !Array.isArray(answer)
    ? answer
    : null;
}
type ExerciseMeta = {
  id: string;
  type: ExerciseType;
  ai_grading: string;
  error_code: string;
  difficulty: string;
  instruction: string;
  number_of_questions: number;
  image?: string | null;
  image_url?: string | null;
  imageUrl?: string | null;
};

type ExerciseItem = AcademicExercise;

function ExerciseQuestion({
  type,
  item,
  index,
}: {
  type: ExerciseType;
  item: ExerciseItem;
  index: number;
}) {
  const questionsNo = item.questions_no || index + 1;
  const questionText = item.question_text || "";
  const questionImage =
    item.question_image ||
    item.image ||
    item.image_url ||
    item.imageUrl ||
    item.chart ||
    null;

  // Handle correct object (short_writing) or raw values
  const correctDetails = answerDetails(item.correct);
  const sampleAns = correctDetails?.sample_answer ?? item.correct;

  const rubric = correctDetails?.ai_grading_rubric ?? item.ai_grading_rubric;

  const explanation = correctDetails?.explanation || item.explanation;

  return (
    <div
      className="aihub-exercise-item"
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
        padding: "18px",
        background: "#ffffff",
        boxShadow: "0 1px 4px rgba(0, 0, 0, 0.03)",
        marginBottom: "16px",
        transition: "all 0.2s ease",
      }}
    >
      {/* Header câu hỏi */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "8px",
          marginBottom: "12px",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "12px",
            fontWeight: 800,
            color: "#3a64fa",
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: "6px",
            padding: "2px 8px",
            flexShrink: 0,
          }}
        >
          Câu {questionsNo}
        </span>
        <p
          style={{
            margin: 0,
            fontSize: "14px",
            lineHeight: "1.6",
            color: "#1e293b",
            fontWeight: 600,
          }}
        >
          {String(questionText)}
        </p>
      </div>

      {questionImage && (
        <div style={{ margin: "10px 0" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- exercise image URLs can come from generated customer data. */}
          <img
            src={questionImage}
            alt={`Minh hoạ câu ${questionsNo}`}
            style={{
              maxWidth: "100%",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
            }}
          />
        </div>
      )}

      {/* 1. Multiple Choice Single */}
      {type === "multiple_choice_single" &&
        item.options &&
        typeof item.options === "object" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              margin: "12px 0",
            }}
          >
            {Object.entries(item.options).map(([key, text]) => {
              const isCorrect = key === item.correct;
              return (
                <div
                  key={key}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: `1px solid ${isCorrect ? "#86efac" : "#e2e8f0"}`,
                    background: isCorrect ? "#f0fdf4" : "#f8fafc",
                    fontSize: "13.5px",
                    lineHeight: "1.5",
                    color: isCorrect ? "#166534" : "#334155",
                    fontWeight: isCorrect ? 600 : 400,
                    transition: "all 0.15s ease",
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "22px",
                      height: "22px",
                      borderRadius: "50%",
                      fontSize: "12px",
                      fontWeight: 700,
                      background: isCorrect ? "#22c55e" : "#e2e8f0",
                      color: isCorrect ? "#ffffff" : "#475467",
                      flexShrink: 0,
                    }}
                  >
                    {key}
                  </span>
                  <div style={{ flex: 1 }}>{String(text)}</div>
                  {isCorrect && (
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "#16a34a",
                        background: "#dcfce7",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        flexShrink: 0,
                      }}
                    >
                      ✓ Đáp án đúng
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

      {/* 2. Multiple Choice Multiple */}
      {type === "multiple_choice_multiple" &&
        item.options &&
        typeof item.options === "object" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              margin: "12px 0",
            }}
          >
            {Object.entries(item.options).map(([key, text]) => {
              const correctArr = Array.isArray(item.correct)
                ? item.correct
                : [];
              const isCorrect = correctArr.includes(key);
              return (
                <div
                  key={key}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: `1px solid ${isCorrect ? "#86efac" : "#e2e8f0"}`,
                    background: isCorrect ? "#f0fdf4" : "#f8fafc",
                    fontSize: "13.5px",
                    lineHeight: "1.5",
                    color: isCorrect ? "#166534" : "#334155",
                    fontWeight: isCorrect ? 600 : 400,
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "22px",
                      height: "22px",
                      borderRadius: "4px",
                      fontSize: "12px",
                      fontWeight: 700,
                      background: isCorrect ? "#22c55e" : "#e2e8f0",
                      color: isCorrect ? "#ffffff" : "#475467",
                      flexShrink: 0,
                    }}
                  >
                    {key}
                  </span>
                  <div style={{ flex: 1 }}>{String(text)}</div>
                  {isCorrect && (
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "#16a34a",
                        background: "#dcfce7",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        flexShrink: 0,
                      }}
                    >
                      ✓ Đáp án
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

      {/* 3. Reorder */}
      {type === "reorder" && item.items && Array.isArray(item.items) && (
        <div style={{ margin: "12px 0" }}>
          <p
            style={{
              margin: "0 0 8px",
              fontSize: "12px",
              fontWeight: 700,
              color: "#64748b",
            }}
          >
            CÁC CÂU CẦN SẮP XẾP:
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              marginBottom: "12px",
            }}
          >
            {item.items.map((sent: string, i: number) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  fontSize: "13px",
                  color: "#334155",
                }}
              >
                <span
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    background: "#e2e8f0",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#475467",
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </span>
                <span>{String(sent)}</span>
              </div>
            ))}
          </div>

          {/* Thứ tự đúng */}
          {Array.isArray(item.correct) && (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "8px",
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  fontSize: "11.5px",
                  fontWeight: 800,
                  color: "#166534",
                  marginBottom: "6px",
                }}
              >
                ✓ TRÌNH TỰ LOGIC CHUẨN:
              </span>
              <ol
                style={{
                  margin: 0,
                  paddingLeft: "18px",
                  fontSize: "13px",
                  color: "#14532d",
                  lineHeight: "1.6",
                }}
              >
                {item.correct.map((origIdx, pos) => (
                  <li key={pos} style={{ marginBottom: "2px" }}>
                    {String(
                      item.items?.[
                        typeof origIdx === "number"
                          ? origIdx
                          : Number.parseInt(origIdx, 10)
                      ] || ""
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* 4. Gap Filling */}
      {type === "gap_filling" && (
        <div
          style={{
            margin: "12px 0",
            padding: "10px 14px",
            borderRadius: "8px",
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#166534" }}>
            Đáp án điền khuyết:
          </span>
          <span
            style={{
              background: "#ffffff",
              color: "#15803d",
              padding: "3px 10px",
              borderRadius: "6px",
              border: "1px solid #86efac",
              fontSize: "13px",
              fontWeight: 700,
            }}
          >
            {String(item.correct || "")}
          </span>
        </div>
      )}

      {/* 5. Choose From List */}
      {type === "choose_from_list" &&
        item.choices &&
        Array.isArray(item.choices) && (
          <div style={{ margin: "12px 0" }}>
            <p
              style={{
                margin: "0 0 6px",
                fontSize: "12px",
                fontWeight: 700,
                color: "#64748b",
              }}
            >
              LỰA CHỌN TỪ DANH SÁCH:
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {item.choices.map((choice: string) => {
                const isCorrect = choice === item.correct;
                return (
                  <span
                    key={choice}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontWeight: isCorrect ? 700 : 500,
                      border: `1px solid ${isCorrect ? "#86efac" : "#cbd5e1"}`,
                      background: isCorrect ? "#f0fdf4" : "#f8fafc",
                      color: isCorrect ? "#166534" : "#334155",
                    }}
                  >
                    {String(choice)}
                    {isCorrect && (
                      <span style={{ color: "#16a34a", fontWeight: 800 }}>
                        ✓
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        )}

      {/* 6. Annotation */}
      {type === "annotation" && (
        <div
          style={{
            margin: "12px 0",
            padding: "10px 14px",
            borderRadius: "8px",
            background: "#fffbeb",
            border: "1px solid #fde68a",
            fontSize: "13px",
            color: "#92400e",
          }}
        >
          <strong style={{ display: "block", marginBottom: "4px" }}>
            Vị trí / Cụm từ cần sửa:
          </strong>
          <span style={{ fontWeight: 700, color: "#78350f" }}>
            “{String(item.correct || "")}”
          </span>
        </div>
      )}

      {/* 7. Short Writing (Hints, Sample Answer, Grading Rubric) */}
      {type === "short_writing" && (
        <div
          style={{
            margin: "12px 0",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          {/* Hints */}
          {Array.isArray(item.hint) && item.hint.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span
                style={{
                  fontSize: "11.5px",
                  fontWeight: 700,
                  color: "#64748b",
                  marginRight: "4px",
                }}
              >
                💡 Gợi ý (Hints):
              </span>
              {item.hint.map((h: string) => (
                <span
                  key={h}
                  style={{
                    background: "#f1f5f9",
                    color: "#334155",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    fontWeight: 600,
                    border: "1px solid #e2e8f0",
                  }}
                >
                  {String(h)}
                </span>
              ))}
            </div>
          )}

          {/* Sample Answer */}
          {sampleAns && (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "8px",
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                fontSize: "13.5px",
                color: "#166534",
              }}
            >
              <strong
                style={{
                  display: "block",
                  fontSize: "11.5px",
                  fontWeight: 800,
                  marginBottom: "4px",
                  color: "#15803d",
                }}
              >
                ✨ ĐÁP ÁN MẪU (BAND 8.5+):
              </strong>
              <span>{String(sampleAns)}</span>
            </div>
          )}

          {/* AI Grading Rubric */}
          {rubric && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                fontSize: "12px",
                color: "#475467",
                lineHeight: "1.5",
              }}
            >
              <strong
                style={{
                  display: "block",
                  marginBottom: "3px",
                  color: "#1e293b",
                }}
              >
                📋 Tiêu chí chấm điểm AI (Rubric):
              </strong>
              {String(rubric)}
            </div>
          )}
        </div>
      )}

      {/* Academic Explanation */}
      {explanation && (
        <div
          style={{
            margin: "12px 0 0",
            padding: "10px 14px",
            borderRadius: "8px",
            background: "#f8fafc",
            borderLeft: "3px solid #3a64fa",
            fontSize: "12.5px",
            lineHeight: "1.5",
            color: "#334155",
          }}
        >
          <strong
            style={{
              display: "block",
              marginBottom: "3px",
              color: "#1e293b",
              fontSize: "11.5px",
            }}
          >
            📘 Giải thích học thuật:
          </strong>
          {String(explanation)}
        </div>
      )}
    </div>
  );
}

export function ExercisePreview({
  meta,
  exercise,
}: {
  meta: ExerciseMeta;
  exercise: ExerciseItem[];
}) {
  const exerciseList = Array.isArray(exercise) ? exercise : [];

  return (
    <div>
      {/* 1. Header Badges chuẩn theo phong cách Lab */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          alignItems: "center",
          marginBottom: "14px",
        }}
      >
        <span
          style={{
            background: "#3a64fa",
            color: "#ffffff",
            padding: "4px 12px",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: 700,
          }}
        >
          Dạng bài:{" "}
          {EXERCISE_TYPE_LABELS[meta?.type] || meta?.type || "Bài tập Writing"}
        </span>
        <span
          style={{
            background: "#f1f5f9",
            color: "#334155",
            padding: "4px 10px",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: 600,
            border: "1px solid #e2e8f0",
          }}
        >
          {meta?.number_of_questions || exerciseList.length} câu hỏi
        </span>
        <span
          style={{
            background: "#fef3c7",
            color: "#92400e",
            padding: "4px 10px",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: 600,
            border: "1px solid #fde68a",
          }}
        >
          Độ khó: {meta?.difficulty || "B2"}
        </span>
        {meta?.ai_grading === "true" && (
          <span
            style={{
              background: "#ecfdf5",
              color: "#065f46",
              padding: "4px 10px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 600,
              border: "1px solid #a7f3d0",
            }}
          >
            Có AI chấm điểm
          </span>
        )}
      </div>

      {/* 2. Instruction Banner */}
      {meta?.instruction && (
        <div
          style={{
            margin: "0 0 16px",
            padding: "10px 14px",
            borderRadius: "8px",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            fontSize: "13px",
            color: "#475467",
            lineHeight: "1.5",
          }}
        >
          {meta.instruction}
        </div>
      )}

      {/* 2.1 Main Task / Chart Image if present */}
      {Boolean(meta.image || meta.image_url || meta.imageUrl) && (
        <div
          style={{
            margin: "0 0 16px",
            padding: "12px",
            borderRadius: "10px",
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            textAlign: "center",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- exercise images can come from customer supplied URLs, so load them directly. */}
          <img
            src={meta.image || meta.image_url || meta.imageUrl || ""}
            alt="Đề bài / Biểu đồ Task"
            style={{
              maxWidth: "100%",
              maxHeight: "380px",
              objectFit: "contain",
              borderRadius: "8px",
            }}
          />
        </div>
      )}

      {/* 3. Danh sách câu hỏi */}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {exerciseList.map((item, idx) => (
          <ExerciseQuestion
            key={(item.questions_no as number) || idx}
            type={meta.type}
            item={item}
            index={idx}
          />
        ))}
      </div>
    </div>
  );
}
