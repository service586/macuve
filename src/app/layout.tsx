import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MaCuve — Livraison d'eau à Libreville",
  description: "Commandez une citerne d'eau livrée chez vous dans le Grand Libreville, payez par Airtel Money.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0369a1",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const testMode = (process.env.PAYMENT_PROVIDER ?? "mock") === "mock";
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        {testMode && (
          <div className="bg-amber-400 px-4 py-1.5 text-center text-sm font-semibold text-amber-950">
            Mode test : aucun paiement réel n&apos;est effectué
          </div>
        )}
        <header className="bg-sky-800 text-white">
          <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
            <Link href="/" className="mr-auto text-lg font-bold tracking-tight">
              💧 MaCuve
            </Link>
            <Link href="/" className="text-sm hover:underline">
              Commander
            </Link>
            <Link href="/suivi" className="text-sm hover:underline">
              Suivre ma commande
            </Link>
            <Link href="/fournisseur" className="text-sm hover:underline">
              Espace livreur
            </Link>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
          MaCuve · Grand Libreville
        </footer>
      </body>
    </html>
  );
}
