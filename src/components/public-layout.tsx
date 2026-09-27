import Link from "next/link";
import { GraduationCap } from "lucide-react";
import type { ReactNode } from "react";
export function Footer() {
  return (
    <footer className="border-t border-line bg-[var(--cream)]">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
        <div>
          <Link href="/" className="flex items-center gap-3 font-semibold">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--g-green)] text-white">
              <GraduationCap size={22} />
            </span>
            EduReport
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-6 text-muted">
            School workspaces for learner records, assessment and terminal
            reporting.
          </p>
          <p className="mt-4 text-xs text-muted">
            © {new Date().getFullYear()} EduReport · Pilot service
          </p>
        </div>
        <nav aria-label="Information" className="space-y-3 text-sm">
          <div className="font-semibold">Information</div>
          {[
            ["/about", "About"],
            ["/contact", "Contact"],
            ["/privacy", "Privacy"],
            ["/terms", "Terms"],
          ].map(([path, label]) => (
            <Link
              key={path}
              className="block text-muted hover:text-ink"
              href={path}
            >
              {label}
            </Link>
          ))}
        </nav>
        <nav aria-label="School access" className="space-y-3 text-sm">
          <div className="font-semibold">Your school</div>
          <Link href="/login" className="block text-muted hover:text-ink">
            Sign in
          </Link>
          <Link
            href="/request-access"
            className="block font-semibold text-[var(--g-green)]"
          >
            Request school access →
          </Link>
          <p className="text-xs leading-6 text-muted">
            Access is approved before a school workspace is created.
          </p>
        </nav>
      </div>
    </footer>
  );
}
export function PublicPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <>
      <div className="kente-bar" />
      <header className="border-b border-line bg-white">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
          <Link
            className="flex items-center gap-2 font-semibold text-[var(--g-green)]"
            href="/"
          >
            <GraduationCap size={24} />
            EduReport
          </Link>
          <Link className="btn-secondary !py-2" href="/login">
            Sign in
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-12 md:py-16">
        <div className="eyebrow">EduReport</div>
        <h1 className="page-title mt-3">{title}</h1>
        <p className="mt-4 text-base leading-7 text-muted">{intro}</p>
        <div className="mt-8 space-y-7 text-sm leading-7">{children}</div>
      </main>
      <Footer />
    </>
  );
}
