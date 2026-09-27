import Link from "next/link";
import { login } from "@/app/login/actions";

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link className="brand" href="/">DUOCOURS</Link>
        <p className="eyebrow">Connexion</p>
        <h1>Content de te revoir.</h1>
        <p className="auth-subtitle">Connecte-toi pour retrouver tes parcours et ta progression.</p>
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
