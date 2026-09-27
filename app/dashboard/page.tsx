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
        <p className="subtitle">Ton moteur d’apprentissage va bientôt construire ton premier parcours personnalisé.</p>
        <Link className="secondary-button" href="/">Créer mon premier cours</Link>
      </section>
    </main>
  );
}
