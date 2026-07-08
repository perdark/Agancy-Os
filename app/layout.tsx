import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agency OS",
  description:
    "A personal operating system for running a premium digital agency — from idea to development.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-6">
          <header className="flex items-center justify-between border-b py-5">
            <Link href="/" className="text-sm font-semibold tracking-tight">
              Agency OS
            </Link>
            <nav className="flex items-center gap-4 text-sm text-muted-foreground">
              <Link href="/projects" className="hover:text-foreground">
                Projects
              </Link>
              <Link href="/projects/new" className="hover:text-foreground">
                New
              </Link>
            </nav>
          </header>
          <main className="flex-1 py-10">{children}</main>
          <footer className="border-t py-5 text-xs text-muted-foreground">
            Foundation Sprint · Version 1 · Architecture only
          </footer>
        </div>
      </body>
    </html>
  );
}
