import Link from "next/link";

export default function DashboardPage() {
  return (
    <main className="dashboard">
      <header className="topbar">
        <div className="brand">DUOCOURS</div>
        <span className="status">Fondation active</span>
      </header>
      <section className="dashboard-card">
        <p className="eyebrow">Ton espace</p>
        <h1>Bienvenue sur Duocours.</h1>
        <p className="subtitle">
          Le moteur de cours, l’authentification et la progression seront
          branchés ici, étape par étape.
        </p>
        <Link className="secondary-button" href="/">
          Retour à l’accueil
        </Link>
      </section>
    </main>
  );
}