"use client";

import { useActionState, useState } from "react";
import { submitExercise } from "./actions";

type Exercise = {
  id: string;
  prompt: string;
  explanation: string;
  difficulty: number;
  metadata: { options?: string[] } | null;
};

export default function ExerciseCard({ exercise, index }: { exercise: Exercise; index: number }) {
  const [state, action, pending] = useActionState(submitExercise, null);
  const [selected, setSelected] = useState<number | null>(null);
  const answered = Boolean(state?.result);

  return (
    <article className="exercise-card">
      <div className="exercise-topline">
        <span>Exercice {index + 1}</span>
        <span>Difficulté {exercise.difficulty}/5</span>
      </div>
      <h2>{exercise.prompt}</h2>

      <form action={action} className="answer-form">
        <input type="hidden" name="exerciseId" value={exercise.id} />
        <input type="hidden" name="startedAt" value={Date.now()} />
        <div className="options">
          {(exercise.metadata?.options ?? []).map((option, optionIndex) => (
            <label className={selected === optionIndex ? "option selected" : "option"} key={optionIndex}>
              <input
                type="radio"
                name="answer"
                value={optionIndex}
                checked={selected === optionIndex}
                onChange={() => setSelected(optionIndex)}
                disabled={pending || answered}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>

        {state?.error ? <p className="form-error">{state.error}</p> : null}

        {!answered ? (
          <button className="primary-button" type="submit" disabled={pending || selected === null}>
            {pending ? "Vérification…" : "Vérifier"}
          </button>
        ) : (
          <div className={state.result?.is_correct ? "feedback correct" : "feedback incorrect"}>
            <strong>{state.result?.is_correct ? "Correct ✓" : "Pas encore."}</strong>
            <p>{exercise.explanation}</p>
            <small>
              Maîtrise du concept : {Math.round(Number(state.result?.mastery_score ?? 0) * 100)}%
            </small>
          </div>
        )}
      </form>
    </article>
  );
}
