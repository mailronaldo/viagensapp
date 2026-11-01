import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Minhas Viagens",
  description:
    "Roteiro, reservas, custos e documentos de cada viagem em um só lugar.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
