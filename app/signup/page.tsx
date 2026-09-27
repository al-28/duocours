import Link from "next/link";
import { signup } from "@/app/signup/actions";

const errors: Record<string, string> = {
  invalid: "Utilise un email valide et un mot de passe d’au moins 8 caractères.",
  failed: "Impossible de créer le compte. Vérifie tes informations ou utilise un autre email.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const error = params.error ? errors[params.error] : undefined;

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link className="brand" href="/">DUOCOURS</Link>
        <p className="eyebrow">Créer ton compte</p>
        <h1>Commence ton parcours.</h1>
        <p className="auth-subtitle">Un compte te permet de sauvegarder tes cours et ta progression.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <form action={signup} className="auth-form">
          <label>Nom<input name="displayName" type="text" autoComplete="name" maxLength={80} /></label>
          <label>Email<input name="email" type="email" autoComplete="email" required /></label>
          <label>Mot de passe<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
          <button className="primary-button" type="submit">Créer mon compte</button>
        </form>
        <p className="auth-footer">Déjà un compte ? <Link href="/login">Se connecter</Link></p>
      </section>
    </main>
  );
}
