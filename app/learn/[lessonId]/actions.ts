"use server";

import { redirect } from "next/navigation";
import { generateExercisePack } from "@/lib/ai/exercises";
import { createClient } from "@/lib/supabase/server";

export async function generateExercises(formData: FormData) {
  const lessonId = String(formData.get("lessonId") ?? "");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, title, description, content, level_id")
    .eq("id", lessonId)
    .maybeSingle();

  if (!lesson) redirect("/dashboard");

  const { data: level } = await supabase
    .from("course_levels")
    .select("id, course_id")
    .eq("id", lesson.level_id)
    .maybeSingle();

  if (!level) redirect("/dashboard");

  const { data: concepts } = await supabase
    .from("lesson_concepts")
    .select("concepts(name)")
    .eq("lesson_id", lessonId);

  const conceptNames = (concepts ?? [])
    .map((row) => Array.isArray(row.concepts) ? row.concepts[0]?.name : row.concepts?.name)
    .filter((name): name is string => Boolean(name));

  try {
    const content = (lesson.content ?? {}) as Record<string, unknown>;
    const pack = await generateExercisePack({
      title: lesson.title,
      description: lesson.description,
      summary: typeof content.summary === "string" ? content.summary : "",
      objectives: Array.isArray(content.objectives) ? content.objectives.filter((x): x is string => typeof x === "string") : [],
      concepts: conceptNames,
    });

    const firstConcept = await supabase
      .from("concepts")
      .select("id")
      .eq("course_id", level.course_id)
      .in("name", conceptNames)
      .limit(1)
      .maybeSingle();

    const rows = pack.exercises.map((exercise) => ({
      lesson_id: lessonId,
      concept_id: firstConcept.data?.id ?? null,
      type: exercise.type,
      prompt: exercise.prompt,
      explanation: exercise.explanation,
      difficulty: exercise.difficulty,
      answer: { correct_index: exercise.correct_index },
      metadata: { options: exercise.options },
    }));

    const { error } = await supabase.from("exercises").insert(rows);
    if (error) throw error;
  } catch (error) {
    console.error("Exercise generation failed:", error);
    redirect(`/learn/${lessonId}?error=generation`);
  }

  redirect(`/learn/${lessonId}`);
}

export async function submitExercise(
  _previousState: { error?: string; result?: Record<string, unknown> } | null,
  formData: FormData,
) {
  const exerciseId = String(formData.get("exerciseId") ?? "");
  const answerIndex = Number(formData.get("answer"));

  if (!exerciseId || !Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 3) {
    return { error: "Choisis une réponse." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: exercise } = await supabase
    .from("exercises")
    .select("id, answer")
    .eq("id", exerciseId)
    .maybeSingle();

  if (!exercise) return { error: "Exercice introuvable." };

  const correctIndex = Number((exercise.answer as { correct_index?: number }).correct_index);
  const startedAt = Number(formData.get("startedAt") ?? Date.now());
  const responseTimeMs = Math.max(0, Math.min(Date.now() - startedAt, 3600000));
  const isCorrect = answerIndex === correctIndex;

  const { data, error } = await supabase.rpc("submit_learning_attempt", {
    p_exercise_id: exerciseId,
    p_answer: { selected_index: answerIndex },
    p_is_correct: isCorrect,
    p_response_time_ms: responseTimeMs,
  });

  if (error) return { error: "Impossible d’enregistrer ta réponse. Réessaie." };
  return { result: data as Record<string, unknown> };
}
