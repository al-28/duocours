import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateExercises } from "./actions";
import ExerciseCard from "./ExerciseCard";

export default async function LearnPage({
  params,
  searchParams,
}: {
  params: Promise<{ lessonId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { lessonId } = await params;
  const query = await searchParams;
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
    .select("id, title, position, course_id")
    .eq("id", lesson.level_id)
    .maybeSingle();

  if (!level) redirect("/dashboard");

  const { data: course } = await supabase
    .from("courses")
    .select("id, title, subject")
    .eq("id", level.course_id)
    .maybeSingle();

  const { data: concepts } = await supabase
    .from("lesson_concepts")
    .select("concepts(name)")
    .eq("lesson_id", lessonId);

  const { data: exercises } = await supabase
    .from("exercises")
    .select("id, prompt, explanation, difficulty, metadata")
    .eq("lesson_id", lessonId)
    .order("created_at", { ascending: true });

  const content = (lesson.content ?? {}) as Record<string, unknown>;
  const objectives = Array.isArray(content.objectives)
    ? content.objectives.filter((x): x is string => typeof x === "string")
    : [];
  const conceptNames = (concepts ?? [])
    .map((row) => Array.isArray(row.concepts) ? row.concepts[0]?.name : row.concepts?.name)
    .filter((name): name is string => Boolean(name));

  return (
    <main className="dashboard">
      <header className="topbar">
        <Link className="brand" href={`/courses/${course?.id}`}>DUOCOURS</Link>
        <Link className="text-button" href={`/courses/${course?.id}`}>Retour au parcours</Link>
      </header>

      <section className="lesson-hero">
        <p className="eyebrow">{course?.subject} · {level.title}</p>
        <h1>{lesson.title}</h1>
        <p>{lesson.description}</p>
      </section>

      <section className="lesson-content">
        <article className="lesson-card">
          <p className="eyebrow">Objectifs</p>
          <ul>{objectives.map((objective) => <li key={objective}>{objective}</li>)}</ul>
          {conceptNames.length > 0 ? (
            <div className="concepts">
              {conceptNames.map((name) => <span key={name}>{name}</span>)}
            </div>
          ) : null}
          {typeof content.summary === "string" && content.summary ? (
            <>
              <p className="eyebrow lesson-summary-label">À retenir</p>
              <p className="lesson-summary">{content.summary}</p>
            </>
          ) : null}
        </article>

        {query.error === "generation" ? (
          <p className="form-error">Impossible de générer les exercices pour le moment. Vérifie la configuration IA puis réessaie.</p>
        ) : null}

        {exercises && exercises.length > 0 ? (
          <div className="exercise-list">
            {exercises.map((exercise, index) => (
              <ExerciseCard key={exercise.id} exercise={exercise} index={index} />
            ))}
          </div>
        ) : (
          <form action={generateExercises} className="lesson-start">
            <input type="hidden" name="lessonId" value={lesson.id} />
            <h2>Prêt à vérifier ta compréhension ?</h2>
            <p>Duocours va générer une série d’exercices ciblés sur cette leçon.</p>
            <button className="primary-button" type="submit">Générer les exercices</button>
          </form>
        )}
      </section>
    </main>
  );
}
