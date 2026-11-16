import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-between px-6 py-10 sm:px-8">
      <header className="flex items-center justify-between border-b border-line pb-4">
        <span className="text-sm font-medium tracking-[0.42em]">PATIO</span>
        <span className="patio-label">Uso interno</span>
      </header>

      <section className="py-16">
        <p className="patio-label">Herramienta privada</p>
        <h1 className="mt-6 text-4xl font-medium tracking-tight sm:text-5xl">
          Simulador de mockups
        </h1>
        <p className="mt-5 max-w-xl text-sm leading-6 text-ink-soft">
          Genera fotografías de producto de nuestras camisetas con el diseño y el
          logo en su posición exacta, listas para la tienda online.
        </p>
        <Link
          href="/simulador"
          className="mt-10 inline-flex items-center gap-4 border border-ink bg-ink px-6 py-3 text-[11px] uppercase tracking-[0.2em] text-paper transition-colors hover:bg-surface hover:text-ink"
        >
          Abrir simulador
          <svg
            viewBox="0 0 16 12"
            aria-hidden="true"
            className="h-3 w-4 fill-none stroke-current"
            strokeWidth={1.5}
          >
            <path d="M0 6h14M9 1l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </section>

      <footer className="border-t border-line pt-4">
        <p className="patio-label">PATIO · Mockups generados con IA</p>
      </footer>
    </main>
  )
}
