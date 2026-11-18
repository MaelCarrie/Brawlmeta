import type { Metadata } from "next";
import { Inter, Lilita_One } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { DemoBanner } from "@/components/demo-banner";
import "./globals.css";

const body = Inter({ variable: "--font-body", subsets: ["latin"] });
const display = Lilita_One({ variable: "--font-display-face", weight: "400", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "BrawlMeta : la méta Brawl Stars en classé", template: "%s · BrawlMeta" },
  description:
    "Tier list, meilleures compos par map classée, buffs et nerfs, et assistant de draft pour Brawl Stars.",
};

const NAV = [
  { href: "/meta", label: "Tier list" },
  { href: "/maps", label: "Maps" },
  { href: "/draft", label: "Assistant draft" },
  { href: "/patchs", label: "Buffs & nerfs" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${body.variable} ${display.variable} antialiased`}>
      <body className="min-h-screen flex flex-col">
        <header className="z-20 md:sticky md:top-0 border-b border-line bg-bg/85 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="h-display text-2xl text-accent">
              Brawl<span className="text-ink">Meta</span>
            </Link>
            <nav className="flex flex-wrap gap-1 text-sm">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="rounded-lg px-3 py-1.5 text-muted transition hover:bg-surface-2 hover:text-ink"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <Suspense>
          <DemoBanner />
        </Suspense>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-line py-6 text-center text-xs text-muted">
          Données issues de l&apos;API officielle Brawl Stars. Ce site n&apos;est pas affilié à Supercell.
        </footer>
      </body>
    </html>
  );
}
