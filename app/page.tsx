import Link from "next/link";

export default function Home() {
  return (
    <main className="shell">
      <section className="hero">
        <div className="brand">DUOCOURS</div>
        <p className="eyebrow">Apprentissage adaptatif</p>
        <h1>Qu’est-ce que tu veux apprendre ?</h1>
        <p className="subtitle">
          Duocours transforme ton objectif en parcours structuré, puis adapte
          les exercices à tes progrès et à tes erreurs.
        </p>
        <div className="search-card">
          <input
            aria-label="Sujet à apprendre"
            placeholder="Ex. Je veux apprendre l’électrocinétique"
            disabled
          />
          <Link className="primary-button" href="/signup">
            Commencer
          </Link>
        </div>
        <p className="hint">La création automatique du parcours arrive à l’étape suivante.</p>
      </section>
    </main>
  );
}
