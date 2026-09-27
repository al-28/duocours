import Link from "next/link";
import { login } from "@/app/login/actions";

const errors: Record<string, string> = {
  missing: "Renseigne ton email et ton mot de passe.",
  invalid: "Email ou mot de passe incorrect.",
  callback: "Le lien de connexion n’est plus valide. Recommence.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const params = await searchParams;
  const error = params.error ? errors[params.error] : undefined;
  const created = params.created === "1";

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link className="brand" href="/">DUOCOURS</Link>
        <p className="eyebrow">Connexion</p>
        <h1>Content de te revoir.</h1>
        <p className="auth-subtitle">Connecte-toi pour retrouver tes parcours et ta progression.</p>
        {created && <p className="form-success" role="status">Compte créé. Vérifie ton email si une confirmation est demandée.</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <form action={login} className="auth-form">
          <label>Email<input name="email" type="email" autoComplete="email" required /></label>
          <label>Mot de passe<input name="password" type="password" autoComplete="current-password" required /></label>
          <button className="primary-button" type="submit">Se connecter</button>
        </form>
        <p className="auth-footer">Pas encore de compte ? <Link href="/signup">Créer un compte</Link></p>
      </section>
    </main>
  );
}
