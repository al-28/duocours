import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function CoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: course } = await supabase
    .from("courses")
    .select("id, title, description, subject, status, owner_id")
    .eq("id", courseId)
    .maybeSingle();

  if (!course) notFound();

  const { data: levels } = await supabase
    .from("course_levels")
    .select("id, title, position")
    .eq("course_id", courseId)
    .order("position", { ascending: true });

  const levelIds = (levels ?? []).map((level) => level.id);
  const { data: lessons } = levelIds.length
    ? await supabase
        .from("lessons")
        .select("id, level_id, title, description, position, content")
        .in("level_id", levelIds)
        .order("position", { ascending: true })
    : { data: [] };

  const lessonCount = lessons?.length ?? 0;

  return (
    <main className="dashboard">
      <header className="topbar">
        <Link className="brand" href="/">DUOCOURS</Link>
        <Link className="text-button" href="/dashboard">Tableau de bord</Link>
      </header>

      <section className="course-hero">
        <p className="eyebrow">{course.subject}</p>
        <h1>{course.title}</h1>
        <p>{course.description}</p>
        <div className="course-meta">
          <span>{levels?.length ?? 0} niveaux</span>
          <span>{lessonCount} leçons</span>
        </div>
      </section>

      <section className="levels-list">
        {(levels ?? []).map((level, levelIndex) => {
          const levelLessons = (lessons ?? [])
            .filter((lesson) => lesson.level_id === level.id)
            .sort((a, b) => a.position - b.position);

          return (
            <article className="level-card" key={level.id}>
              <div className="level-heading">
                <div>
                  <span className="level-number">Niveau {levelIndex + 1}</span>
                  <h2>{level.title}</h2>
                </div>
                <span className="lesson-count">{levelLessons.length} leçons</span>
              </div>

              <div className="lesson-list">
                {levelLessons.map((lesson, index) => (
                  <Link className="lesson-row" href={`/learn/${lesson.id}`} key={lesson.id}>
                    <span className="lesson-index">{index + 1}</span>
                    <span>
                      <strong>{lesson.title}</strong>
                      <small>{lesson.description}</small>
                    </span>
                    <span className="lesson-arrow">→</span>
                  </Link>
                ))}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
