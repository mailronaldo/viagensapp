import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Minhas Viagens",
  description:
    "Roteiro, reservas, custos e documentos de cada viagem em um só lugar.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`h-full antialiased ${jakarta.variable}`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
