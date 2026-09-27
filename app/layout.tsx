import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Duocours",
  description: "Apprends n’importe quel sujet avec un parcours personnalisé.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}