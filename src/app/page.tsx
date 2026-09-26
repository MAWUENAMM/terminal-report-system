import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-950 text-white">
      <div className="container mx-auto px-4 py-16">
        <header className="flex items-center justify-between mb-20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-ghana-gold flex items-center justify-center text-primary-900 font-bold text-xl">
              TR
            </div>
            <span className="text-xl font-semibold">Terminal Report System</span>
          </div>
          <Link
            href="/login"
            className="px-5 py-2.5 bg-white text-primary-900 font-medium rounded-lg hover:bg-primary-50 transition"
          >
            Sign In
          </Link>
        </header>

        <main className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 rounded-full text-sm mb-8">
            <span className="w-2 h-2 rounded-full bg-ghana-gold animate-pulse"></span>
            GES & NaCCA Aligned
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Modern Terminal Reports<br />
            <span className="text-ghana-gold">for Ghanaian Basic Schools</span>
          </h1>
          
          <p className="text-lg md:text-xl text-primary-100 mb-10 max-w-2xl mx-auto">
            Automate SBA calculations, generate professional report cards, track attendance & conduct — 
            all in one secure platform built for Ghana Education Service standards.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link
              href="/login"
              className="px-8 py-3.5 bg-ghana-gold text-primary-900 font-semibold rounded-lg hover:bg-yellow-300 transition shadow-lg"
            >
              Launch Dashboard
            </Link>
            <Link
              href="/login"
              className="px-8 py-3.5 bg-white/10 border border-white/20 font-medium rounded-lg hover:bg-white/20 transition"
            >
              Sign In
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-6 text-left">
            {[
              {
                title: "SBA + Exam Automation",
                desc: "Enter raw scores once. System scales to 50:50, assigns grades, and ranks students automatically.",
              },
              {
                title: "Professional PDF Reports",
                desc: "Branded terminal reports with photos, attendance, conduct, and teacher remarks — ready to print or share.",
              },
              {
                title: "Role-Based Access",
                desc: "Admin, Headteacher, Class Teacher and Subject Teacher roles with appropriate permissions.",
              },
            ].map((f) => (
              <div key={f.title} className="bg-white/5 border border-white/10 rounded-xl p-6">
                <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-primary-200 text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </main>

        <footer className="mt-24 text-center text-primary-300 text-sm">
          Built for Ghanaian Basic Schools · Free Prototype · September 2026
        </footer>
      </div>
    </div>
  );
}
