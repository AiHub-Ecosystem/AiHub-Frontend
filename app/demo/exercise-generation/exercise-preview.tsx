import { EXERCISE_TYPE_LABELS, type ExerciseType } from "@/data/aiwriting";

type ExerciseMeta = {
  id: string;
  type: ExerciseType;
  ai_grading: string;
  error_code: string;
  difficulty: string;
  instruction: string;
  number_of_questions: number;
};

type ExerciseItem = Record<string, unknown>;

function ExerciseQuestion({ type, item }: { type: ExerciseType; item: ExerciseItem }) {
  const questionsNo = item.questions_no as number;
  const questionText = item.question_text as string;
  const questionImage = item.question_image as string | null;
  const explanation = item.explanation as string | undefined;

  return (
    <div className="aihub-exercise-item">
      <p className="aihub-exercise-q">
        Câu {questionsNo}. {questionText}
      </p>
      {questionImage && <img src={questionImage} alt={`Minh hoạ câu ${questionsNo}`} />}

      {type === "multiple_choice_single" && (
        <ul className="aihub-options">
          {Object.entries(item.options as Record<string, string>).map(([key, text]) => (
            <li key={key} data-correct={key === item.correct}>
              <strong>{key}.</strong> {text}
            </li>
          ))}
        </ul>
      )}

      {type === "multiple_choice_multiple" && (
        <ul className="aihub-options">
          {Object.entries(item.options as Record<string, string>).map(([key, text]) => (
            <li key={key} data-correct={(item.correct as string[]).includes(key)}>
              <strong>{key}.</strong> {text}
            </li>
          ))}
        </ul>
      )}

      {type === "gap_filling" && (
        <div className="aihub-chiprow">
          <span className="aihub-chip">Đáp án: {item.correct as string}</span>
        </div>
      )}

      {type === "choose_from_list" && (
        <div className="aihub-chiprow">
          {(item.choices as string[]).map((choice) => (
            <span className="aihub-chip" key={choice} data-order={choice === item.correct ? "" : undefined}>
              {choice}
              {choice === item.correct ? " ✓" : ""}
            </span>
          ))}
        </div>
      )}

      {type === "reorder" && (
        <div className="aihub-chiprow">
          {(item.correct as number[]).map((originalIndex, position) => (
            <span className="aihub-chip" data-order key={position}>
              {position + 1}. {(item.items as string[])[originalIndex]}
            </span>
          ))}
        </div>
      )}

      {type === "annotation" && (
        <div className="aihub-chiprow">
          <span className="aihub-chip" data-order>
            Cụm bị đánh dấu: “{item.correct as string}”
          </span>
        </div>
      )}

      {type === "short_writing" && (
        <>
          {Array.isArray(item.hint) && (
            <div className="aihub-chiprow">
              {(item.hint as string[]).map((h) => (
                <span className="aihub-chip" key={h}>
                  {h}
                </span>
              ))}
            </div>
          )}
          <div className="aihub-sample-answer">
            {(item.correct as { sample_answer: string }).sample_answer}
          </div>
        </>
      )}

      {explanation && <p className="aihub-explain">{explanation}</p>}
    </div>
  );
}

export function ExercisePreview({ meta, exercise }: { meta: ExerciseMeta; exercise: ExerciseItem[] }) {
  return (
    <div>
      <div className="aihub-preview-meta">
        <span className="aihub-badge" data-status="stable">
          {EXERCISE_TYPE_LABELS[meta.type]}
        </span>
        <span className="aihub-badge">{meta.number_of_questions} câu</span>
        <span className="aihub-badge">Độ khó {meta.difficulty}</span>
        {meta.ai_grading === "true" && <span className="aihub-badge">Có AI chấm</span>}
      </div>
      <p className="aihub-explain" style={{ marginBottom: 16 }}>
        {meta.instruction}
      </p>
      {exercise.map((item) => (
        <ExerciseQuestion key={item.questions_no as number} type={meta.type} item={item} />
      ))}
    </div>
  );
}
