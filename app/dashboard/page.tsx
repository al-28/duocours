import Link from "next/link";
import { redirect } from "next/navigation";
import { logout } from "@/app/logout/actions";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const { data: courses } = await supabase
    .from("user_courses")
    .select("course_id, last_accessed_at, courses(id, title, description, subject, status)")
    .eq("user_id", user.id)
    .order("last_accessed_at", { ascending: false });

  const name = profile?.display_name || user.email?.split("@")[0] || "apprenant";

  return (
    <main className="dashboard">
      <header className="topbar">
        <Link className="brand" href="/">DUOCOURS</Link>
        <form action={logout}><button className="text-button" type="submit">Déconnexion</button></form>
      </header>

      <section className="dashboard-card">
        <p className="eyebrow">Ton espace</p>
        <h1>Bonjour, {name}.</h1>
        <p className="subtitle">
          Crée un parcours à partir de n’importe quel objectif, puis reprends
          tes apprentissages là où tu les as laissés.
        </p>
        <Link className="primary-button" href="/courses/new">Créer un parcours</Link>
      </section>

      {courses && courses.length > 0 ? (
        <section className="levels-list">
          <div className="level-heading">
            <div>
              <span className="level-number">Tes parcours</span>
              <h2>Continuer à apprendre</h2>
            </div>
          </div>
          {courses.map((item) => {
            const course = Array.isArray(item.courses) ? item.courses[0] : item.courses;
            if (!course) return null;
            return (
              <Link className="lesson-row" href={`/courses/${course.id}`} key={item.course_id}>
                <span className="lesson-index">→</span>
                <span>
                  <strong>{course.title}</strong>
                  <small>{course.subject} · {course.description}</small>
                </span>
                <span className="lesson-arrow">→</span>
              </Link>
            );
          })}
        </section>
      ) : null}
    </main>
  );
}
