"use server";

import { redirect } from "next/navigation";
import { generateCurriculum } from "@/lib/ai/curriculum";
import { createClient } from "@/lib/supabase/server";

function errorRedirect(code: string): never {
  redirect(`/courses/new?error=${encodeURIComponent(code)}`);
}

export async function createCourse(formData: FormData) {
  const goal = String(formData.get("goal") ?? "").trim();

  if (goal.length < 3 || goal.length > 500) {
    errorRedirect("Décris ce que tu veux apprendre en quelques mots.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?error=missing");

  try {
    const curriculum = await generateCurriculum(goal);

    const { data: courseId, error } = await supabase.rpc("create_course_from_curriculum", {
      p_title: curriculum.title,
      p_description: curriculum.description,
      p_subject: curriculum.subject,
      p_levels: curriculum.levels,
    });

    if (error || !courseId) {
      console.error("Course creation RPC failed:", error);
      errorRedirect("Le parcours n’a pas pu être enregistré. Réessaie.");
    }

    redirect(`/courses/${courseId}`);
  } catch (error) {
    console.error("Course generation failed:", error);
    errorRedirect(
      error instanceof Error && error.message.includes("OPENAI_API_KEY")
        ? "Le moteur IA n’est pas encore configuré sur le serveur."
        : "Impossible de construire ce parcours pour le moment. Réessaie.",
    );
  }
}
