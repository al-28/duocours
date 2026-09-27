import Link from "next/link";
import { redirect } from "next/navigation";
import { createCourse } from "./actions";
import { createClient } from "@/lib/supabase/server";

const errors: Record<string, string> = {
  "Décris ce que tu veux apprendre en quelques mots.": "Décris ce que tu veux apprendre en quelques mots.",
};

export default async function NewCoursePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const params = await searchParams;
  const error = params.error ? errors[params.error] ?? params.error : null;

  return (
    <main className="dashboard">
      <header className="topbar">
        <Link className="brand" href="/">DUOCOURS</Link>
        <Link className="text-button" href="/dashboard">Retour</Link>
      </header>

      <section className="dashboard-card course-create-card">
        <p className="eyebrow">Nouveau parcours</p>
        <h1>Qu’est-ce que tu veux apprendre ?</h1>
        <p className="subtitle">
          Décris ton objectif naturellement. Duocours va construire une progression
          avec des niveaux, des leçons, des objectifs et les concepts à maîtriser.
        </p>

        {error ? <p className="form-error">{error}</p> : null}

        <form action={createCourse} className="goal-form">
          <label htmlFor="goal">Ton objectif d’apprentissage</label>
          <textarea
            id="goal"
            name="goal"
            rows={4}
            maxLength={500}
            required
            placeholder="Ex. Je veux apprendre l’électrocinétique à partir des bases pour réussir mes exercices de physique."
          />
          <button className="primary-button" type="submit">
            Construire mon parcours
          </button>
        </form>

        <div className="course-create-note">
          <strong>Après génération</strong>
          <span>Tu arriveras directement sur ton parcours et pourras commencer la première leçon.</span>
        </div>
      </section>
    </main>
  );
}
