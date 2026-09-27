"use server";

import { redirect } from "next/navigation";
import { generateExercisePack } from "@/lib/ai/exercises";
import { createClient } from "@/lib/supabase/server";

async function getAuthenticatedClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

async function getLessonContext(supabase: Awaited<ReturnType<typeof createClient>>, lessonId: string) {
  const { data: lesson } = await supabase.from("lessons")
    .select("id, title, description, content, level_id").eq("id", lessonId).maybeSingle();
  if (!lesson) redirect("/dashboard");
  const { data: level } = await supabase.from("course_levels")
    .select("id, course_id").eq("id", lesson.level_id).maybeSingle();
  if (!level) redirect("/dashboard");
  return { lesson, level };
}

function lessonInput(lesson: { title: string; description: string | null; content: unknown }, concepts: string[]) {
  const content = (lesson.content ?? {}) as Record<string, unknown>;
  return {
    title: lesson.title,
    description: lesson.description ?? "",
    summary: typeof content.summary === "string" ? content.summary : "",
    objectives: Array.isArray(content.objectives)
      ? content.objectives.filter((x): x is string => typeof x === "string") : [],
    concepts,
  };
}

export async function generateExercises(formData: FormData) {
  const lessonId = String(formData.get("lessonId") ?? "");
  const { supabase } = await getAuthenticatedClient();
  const { lesson, level } = await getLessonContext(supabase, lessonId);

  const { data: concepts } = await supabase.from("lesson_concepts")
    .select("concept_id, concepts(name)").eq("lesson_id", lessonId);
  const conceptNames = (concepts ?? [])
    .map((row) => Array.isArray(row.concepts) ? row.concepts[0]?.name : row.concepts?.name)
    .filter((name): name is string => Boolean(name));

  try {
    const pack = await generateExercisePack(lessonInput(lesson, conceptNames));
    const conceptRows = conceptNames.length
      ? await supabase.from("concepts").select("id, name")
          .eq("course_id", level.course_id).in("name", conceptNames)
      : { data: [] };

    const conceptIds = (conceptRows.data ?? []).map((concept) => concept.id);
    const rows = pack.exercises.map((exercise, index) => ({
      lesson_id: lessonId,
      concept_id: conceptIds.length ? conceptIds[index % conceptIds.length] : null,
      type: exercise.type,
      prompt: exercise.prompt,
      explanation: exercise.explanation,
      difficulty: exercise.difficulty,
      answer: { correct_index: exercise.correct_index },
      metadata: {
        options: exercise.options,
        generation: "lesson",
        target_concept: conceptNames.length ? conceptNames[index % conceptNames.length] : null,
      },
    }));

    const { error } = await supabase.from("exercises").insert(rows);
    if (error) throw error;
  } catch (error) {
    console.error("Exercise generation failed:", error);
    redirect(`/learn/${lessonId}?error=generation`);
  }
  redirect(`/learn/${lessonId}`);
}

export async function generateAdaptiveExercises(formData: FormData) {
  const lessonId = String(formData.get("lessonId") ?? "");
  const conceptId = String(formData.get("conceptId") ?? "");
  if (!lessonId || !conceptId) redirect("/dashboard");

  const { supabase, user } = await getAuthenticatedClient();
  const { lesson } = await getLessonContext(supabase, lessonId);

  const { data: lessonConcept } = await supabase.from("lesson_concepts")
    .select("concept_id, concepts(id, name)").eq("lesson_id", lessonId)
    .eq("concept_id", conceptId).maybeSingle();
  const concept = Array.isArray(lessonConcept?.concepts) ? lessonConcept.concepts[0] : lessonConcept?.concepts;
  if (!concept?.id || !concept.name) redirect(`/learn/${lessonId}`);

  const { data: mastery } = await supabase.from("concept_mastery")
    .select("score, attempts, needs_review").eq("user_id", user.id).eq("concept_id", conceptId).maybeSingle();
  if (!mastery?.needs_review && Number(mastery?.score ?? 0) >= 0.75) redirect(`/learn/${lessonId}`);

  try {
    const pack = await generateExercisePack(lessonInput(lesson, [concept.name]));
    const rows = pack.exercises.map((exercise) => ({
      lesson_id: lessonId, concept_id: conceptId, type: exercise.type,
      prompt: exercise.prompt, explanation: exercise.explanation, difficulty: exercise.difficulty,
      answer: { correct_index: exercise.correct_index },
      metadata: { options: exercise.options, generation: "adaptive", target_concept: concept.name },
    }));
    const { error } = await supabase.from("exercises").insert(rows);
    if (error) throw error;
  } catch (error) {
    console.error("Adaptive exercise generation failed:", error);
    redirect(`/learn/${lessonId}?error=adaptive_generation`);
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

  const { supabase } = await getAuthenticatedClient();
  const { data: exercise } = await supabase.from("exercises").select("id, answer")
    .eq("id", exerciseId).maybeSingle();
  if (!exercise) return { error: "Exercice introuvable." };

  const correctIndex = Number((exercise.answer as { correct_index?: number }).correct_index);
  const startedAt = Number(formData.get("startedAt") ?? Date.now());
  const responseTimeMs = Math.max(0, Math.min(Date.now() - startedAt, 3600000));
  const isCorrect = answerIndex === correctIndex;

  const { data, error } = await supabase.rpc("submit_learning_attempt", {
    p_exercise_id: exerciseId, p_answer: { selected_index: answerIndex },
    p_is_correct: isCorrect, p_response_time_ms: responseTimeMs,
  });
  if (error) return { error: "Impossible d’enregistrer ta réponse. Réessaie." };
  return { result: data as Record<string, unknown> };
}
