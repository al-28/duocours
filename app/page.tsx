import Link from "next/link";

export default function Home() {
  return (
    <main className="shell">
      <section className="hero">
        <div className="brand">DUOCOURS</div>
        <p className="eyebrow">Apprentissage adaptatif</p>
        <h1>Apprends ce que tu veux.<br />À ton rythme.</h1>
        <p className="subtitle">
          Duocours transforme ton objectif en parcours structuré, puis adapte
          les exercices à tes progrès et à tes erreurs.
        </p>
        <Link className="primary-button hero-button" href="/courses/new">
          Commencer un parcours
        </Link>
        <p className="hint">Connecte-toi pour créer et suivre tes parcours.</p>
      </section>
    </main>
  );
}
