import Link from "next/link";
import {
  ArrowRight,
  Check,
  ClipboardList,
  FileOutput,
  Shield,
  Users,
} from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/90 backdrop-blur-md">
        <div className="mx-auto flex h-[64px] max-w-6xl items-center justify-between px-5 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-md bg-ink text-[13px] font-bold tracking-tight text-white">
              ER
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-gold ring-2 ring-paper" />
            </div>
            <div className="leading-none">
              <div className="text-[15px] font-semibold tracking-tight">EduReport</div>
              <div className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted">
                Ghana Basic Schools
              </div>
            </div>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-muted md:flex">
            <a href="#system" className="hover:text-ink">The system</a>
            <a href="#workflow" className="hover:text-ink">Workflow</a>
            <a href="#proof" className="hover:text-ink">For schools</a>
          </nav>
          <Link href="/login" className="btn-primary !py-2.5 !px-4 text-[13px]">
            Open system
            <ArrowRight size={15} />
          </Link>
        </div>
      </header>

      <section className="border-b border-line">
        <div className="mx-auto grid max-w-6xl lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col justify-center border-r border-line px-5 py-16 lg:px-8 lg:py-24">
            <div className="inline-flex w-fit items-center gap-2 border border-line bg-paper-elevated px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-forest" />
              Terminal reporting · GES aligned
            </div>

            <h1 className="font-display mt-7 max-w-[15ch] text-[2.75rem] font-medium leading-[1.08] tracking-[-0.02em] text-ink md:text-[3.4rem]">
              Report cards your school can stand behind.
            </h1>

            <p className="mt-6 max-w-[38ch] text-[17px] leading-8 text-muted">
              EduReport replaces manual mark books and inconsistent report sheets
              with one verified workspace—SBA, exams, attendance, conduct, and
              print-ready terminal reports.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/login" className="btn-primary">
                Launch demonstration
                <ArrowRight size={16} />
              </Link>
              <a href="#workflow" className="btn-secondary">
                See the workflow
              </a>
            </div>

            <div className="mt-12 grid grid-cols-3 gap-6 border-t border-line pt-8">
              {[
                ["50:50", "SBA + Exam"],
                ["A–F", "GES grades"],
                ["PDF", "Print ready"],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="font-display text-2xl font-medium tracking-tight text-ink">{k}</div>
                  <div className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-muted">{v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative min-h-[420px] lg:min-h-full">
            <img
              src="https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1400&q=80"
              alt="Students learning in a classroom"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/20 to-transparent" />

            <div className="absolute bottom-6 left-6 right-6 sm:left-auto sm:right-6 sm:w-[280px]">
              <div className="border border-white/15 bg-ink/90 p-4 text-white shadow-lift backdrop-blur-sm">
                <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">
                  <span>Terminal report</span>
                  <span className="text-gold">Term 1 · 2025/26</span>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-11 w-11 overflow-hidden rounded-full border border-white/20 bg-white/10">
                    <img
                      src="https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=200&q=80"
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Abena Osei</div>
                    <div className="text-[11px] text-white/55">Basic 4 · Adm. BS/2024/001</div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-3 text-center">
                  <div>
                    <div className="text-lg font-semibold">78.5</div>
                    <div className="text-[9px] uppercase tracking-wider text-white/45">Average</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-gold">B</div>
                    <div className="text-[9px] uppercase tracking-wider text-white/45">Grade</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold">3rd</div>
                    <div className="text-[9px] uppercase tracking-wider text-white/45">Position</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="system" className="border-b border-line bg-paper-elevated">
        <div className="mx-auto max-w-6xl px-5 py-20 lg:px-8">
          <div className="max-w-2xl">
            <div className="eyebrow">What the system does</div>
            <h2 className="font-display mt-3 text-3xl font-medium tracking-[-0.02em] text-ink md:text-4xl">
              Built for how Ghanaian basic schools actually work.
            </h2>
          </div>

          <div className="mt-12 grid gap-px overflow-hidden border border-line bg-line md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: ClipboardList,
                title: "Assessment entry",
                body: "Enter SBA and exam marks once. The system scales to 50:50, grades, and ranks automatically.",
              },
              {
                icon: Users,
                title: "Learner records",
                body: "Photos, admission numbers, class placement, and guardian contacts—kept in one place.",
              },
              {
                icon: FileOutput,
                title: "Terminal reports",
                body: "Branded PDF report cards with scores, attendance, conduct, and teacher remarks.",
              },
              {
                icon: Shield,
                title: "Role-based access",
                body: "Admin, headteacher, class teacher, and subject teacher—each sees what they need.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="bg-paper-elevated p-7">
                <div className="flex h-10 w-10 items-center justify-center border border-line bg-paper text-ink">
                  <Icon size={18} strokeWidth={1.75} />
                </div>
                <h3 className="mt-5 text-[15px] font-semibold tracking-tight">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="workflow" className="border-b border-line">
        <div className="mx-auto max-w-6xl px-5 py-20 lg:px-8">
          <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <div className="eyebrow">Term workflow</div>
              <h2 className="font-display mt-3 text-3xl font-medium tracking-[-0.02em] md:text-4xl">
                From mark entry to signed report.
              </h2>
              <p className="mt-4 text-[15px] leading-7 text-muted">
                One continuous path—no spreadsheet hand-offs, no recalculation errors, no mismatched templates.
              </p>
              <Link href="/login" className="btn-primary mt-8">
                Try the full flow
                <ArrowRight size={16} />
              </Link>
            </div>

            <ol className="space-y-0 border border-line">
              {[
                ["01", "Register learners", "Import or add students by class with photos and guardian details."],
                ["02", "Enter assessment", "Capture continuous assessment and end-of-term examination scores."],
                ["03", "Verify totals", "System applies school weights, assigns grades, and computes positions."],
                ["04", "Issue reports", "Generate consistent terminal report PDFs ready for print and parent meetings."],
              ].map(([n, title, desc], i) => (
                <li
                  key={n}
                  className={`flex gap-5 px-6 py-5 ${i !== 3 ? "border-b border-line" : ""} bg-paper-elevated`}
                >
                  <span className="font-display text-2xl font-medium text-gold">{n}</span>
                  <div>
                    <div className="font-semibold tracking-tight">{title}</div>
                    <p className="mt-1 text-sm leading-6 text-muted">{desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section id="proof" className="border-b border-line bg-ink text-white">
        <div className="mx-auto max-w-6xl px-5 py-20 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-end">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
                Designed for basic schools
              </div>
              <h2 className="font-display mt-4 text-3xl font-medium leading-snug tracking-[-0.02em] md:text-4xl">
                Aligned with how assessment actually runs in Ghana.
              </h2>
            </div>
            <ul className="space-y-3 text-sm text-white/70">
              {[
                "SBA and examination weighting configurable per school",
                "Letter grades with competency-style descriptors",
                "Attendance, conduct, and dual teacher remarks",
                "Class ranking and on-roll totals on every report",
                "Role separation for headteacher and class teachers",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <Check size={16} className="mt-0.5 shrink-0 text-gold" strokeWidth={2.5} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-b border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-5 py-16 md:flex-row md:items-center lg:px-8">
          <div>
            <h2 className="font-display text-2xl font-medium tracking-tight md:text-3xl">
              Ready to walk stakeholders through a live term?
            </h2>
            <p className="mt-2 text-sm text-muted">
              Demonstration environment · no installation · works in the browser.
            </p>
          </div>
          <Link href="/login" className="btn-gold shrink-0">
            Enter demonstration
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <footer className="bg-paper">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-ink text-[11px] font-bold text-white">
              ER
            </div>
            <div>
              <div className="text-sm font-semibold">EduReport</div>
              <div className="text-[11px] text-muted">Automated Terminal Report System</div>
            </div>
          </div>
          <div className="text-xs text-muted">
            Prototype for stakeholder demonstration · Ghana Basic Schools
          </div>
        </div>
      </footer>
    </main>
  );
}
