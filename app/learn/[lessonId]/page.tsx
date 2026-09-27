import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateAdaptiveExercises, generateExercises } from "./actions";
import ExerciseCard from "./ExerciseCard";

export default async function LearnPage({ params, searchParams }: {
  params: Promise<{ lessonId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { lessonId } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: lesson } = await supabase.from("lessons")
    .select("id, title, description, content, level_id, position").eq("id", lessonId).maybeSingle();
  if (!lesson) redirect("/dashboard");

  const { data: level } = await supabase.from("course_levels")
    .select("id, title, position, course_id").eq("id", lesson.level_id).maybeSingle();
  if (!level) redirect("/dashboard");

  const { data: course } = await supabase.from("courses")
    .select("id, title, subject").eq("id", level.course_id).maybeSingle();

  const { data: concepts } = await supabase.from("lesson_concepts")
    .select("concept_id, concepts(name)").eq("lesson_id", lessonId);
  const { data: exercises } = await supabase.from("exercises")
    .select("id, prompt, explanation, difficulty, metadata").eq("lesson_id", lessonId)
    .order("created_at", { ascending: true });

  const exerciseIds = (exercises ?? []).map((exercise) => exercise.id);
  const { data: attempts } = exerciseIds.length
    ? await supabase.from("learning_attempts")
        .select("exercise_id, is_correct").eq("user_id", user.id).in("exercise_id", exerciseIds)
    : { data: [] };

  const attemptedIds = new Set((attempts ?? []).map((attempt) => attempt.exercise_id));
  const correctAttempts = (attempts ?? []).filter((attempt) => attempt.is_correct).length;
  const lessonProgress = exerciseIds.length
    ? Math.round((attemptedIds.size / exerciseIds.length) * 100)
    : 0;

  const conceptIds = (concepts ?? []).map((row) => row.concept_id);
  const { data: masteryRows } = conceptIds.length
    ? await supabase.from("concept_mastery")
        .select("concept_id, score, attempts, correct_attempts, consecutive_wrong, needs_review")
        .eq("user_id", user.id).in("concept_id", conceptIds)
    : { data: [] };
  const masteryByConcept = new Map((masteryRows ?? []).map((row) => [row.concept_id, row]));

  const conceptNames = (concepts ?? [])
    .map((row) => Array.isArray(row.concepts) ? row.concepts[0]?.name : row.concepts?.name)
    .filter((name): name is string => Boolean(name));

  const weakConcept = (concepts ?? []).map((row) => {
    const name = Array.isArray(row.concepts) ? row.concepts[0]?.name : row.concepts?.name;
    return { id: row.concept_id, name, mastery: masteryByConcept.get(row.concept_id) };
  }).filter((item) => Boolean(item.name && item.mastery &&
    (item.mastery.needs_review || Number(item.mastery.score) < 0.75)))
    .sort((a, b) => Number(a.mastery?.score ?? 0) - Number(b.mastery?.score ?? 0))[0];

  const allConceptsMastered = conceptIds.length > 0 &&
    conceptIds.every((id) => {
      const mastery = masteryByConcept.get(id);
      return Boolean(mastery && !mastery.needs_review && Number(mastery.score) >= 0.75);
    });

  const lessonComplete = exerciseIds.length >= 3 &&
    attemptedIds.size >= Math.min(3, exerciseIds.length) &&
    allConceptsMastered;

  let nextLesson: { id: string; title: string; description: string | null } | null = null;

  if (lessonComplete) {
    const { data: sameLevelNext } = await supabase.from("lessons")
      .select("id, title, description").eq("level_id", lesson.level_id)
      .gt("position", lesson.position).order("position", { ascending: true }).limit(1).maybeSingle();

    if (sameLevelNext) {
      nextLesson = sameLevelNext;
    } else {
      const { data: nextLevel } = await supabase.from("course_levels")
        .select("id").eq("course_id", level.course_id)
        .gt("position", level.position).order("position", { ascending: true }).limit(1).maybeSingle();

      if (nextLevel) {
        nextLesson = await supabase.from("lessons")
          .select("id, title, description").eq("level_id", nextLevel.id)
          .order("position", { ascending: true }).limit(1).maybeSingle().then((result) => result.data);
      }
    }
  }

  const content = (lesson.content ?? {}) as Record<string, unknown>;
  const objectives = Array.isArray(content.objectives)
    ? content.objectives.filter((x): x is string => typeof x === "string") : [];

  return <main className="dashboard">
    <header className="topbar">
      <Link className="brand" href={`/courses/${course?.id}`}>DUOCOURS</Link>
      <Link className="text-button" href={`/courses/${course?.id}`}>Retour au parcours</Link>
    </header>

    <section className="lesson-hero">
      <p className="eyebrow">{course?.subject} · {level.title}</p>
      <h1>{lesson.title}</h1><p>{lesson.description}</p>
      {exercises && exercises.length > 0 ? (
        <div className="progress-wrap">
          <div className="progress-label"><span>Progression de la leçon</span><strong>{lessonProgress}%</strong></div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${lessonProgress}%` }} /></div>
          <small>{attemptedIds.size} exercice{attemptedIds.size > 1 ? "s" : ""} tenté{attemptedIds.size > 1 ? "s" : ""} · {correctAttempts} correct{correctAttempts > 1 ? "s" : ""}</small>
        </div>
      ) : null}
    </section>

    <section className="lesson-content">
      <article className="lesson-card">
        <p className="eyebrow">Objectifs</p>
        <ul>{objectives.map((objective) => <li key={objective}>{objective}</li>)}</ul>
        {conceptNames.length > 0 ? <div className="concepts">{conceptNames.map((name) => <span key={name}>{name}</span>)}</div> : null}
        {typeof content.summary === "string" && content.summary ? <>
          <p className="eyebrow lesson-summary-label">À retenir</p><p className="lesson-summary">{content.summary}</p>
        </> : null}
      </article>

      {query.error === "generation" ? <p className="form-error">Impossible de générer les exercices pour le moment. Vérifie la configuration IA puis réessaie.</p> : null}
      {query.error === "adaptive_generation" ? <p className="form-error">Impossible de générer la pratique ciblée pour le moment. Réessaie dans quelques instants.</p> : null}

      {lessonComplete ? <article className="completion-card">
        <div>
          <p className="eyebrow">Leçon validée</p>
          <h2>Tu maîtrises les concepts essentiels.</h2>
          <p>Tu peux maintenant passer à la suite de ton parcours.</p>
        </div>
        {nextLesson ? (
          <Link className="primary-button" href={`/learn/${nextLesson.id}`}>Continuer →</Link>
        ) : (
          <Link className="primary-button" href={`/courses/${course?.id}`}>Voir le parcours</Link>
        )}
      </article> : null}

      {weakConcept ? <article className="adaptive-card">
        <div><p className="eyebrow">Révision ciblée</p>
          <h2>Retravaillons « {weakConcept.name} »</h2>
          <p>Ta maîtrise est à {Math.round(Number(weakConcept.mastery?.score ?? 0) * 100)}%. Duocours peut générer une nouvelle série uniquement sur ce concept.</p>
        </div>
        <form action={generateAdaptiveExercises}>
          <input type="hidden" name="lessonId" value={lesson.id} />
          <input type="hidden" name="conceptId" value={weakConcept.id} />
          <button className="primary-button" type="submit">Pratiquer ce concept</button>
        </form>
      </article> : null}

      {exercises && exercises.length > 0 ? <div className="exercise-list">
        {exercises.map((exercise, index) => <ExerciseCard key={exercise.id} exercise={exercise} index={index} />)}
      </div> : <form action={generateExercises} className="lesson-start">
        <input type="hidden" name="lessonId" value={lesson.id} />
        <h2>Prêt à vérifier ta compréhension ?</h2>
        <p>Duocours va générer une série d’exercices ciblés sur cette leçon.</p>
        <button className="primary-button" type="submit">Générer les exercices</button>
      </form>}
    </section>
  </main>;
}
