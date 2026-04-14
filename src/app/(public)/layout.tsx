export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="border-b border-border bg-surface">
        <div className="max-w-2xl mx-auto px-6 h-14 flex items-center gap-2">
          <span className="text-sm font-bold tracking-tight text-text-muted">
            myHotel
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] bg-labs-yellow-bg text-labs-yellow px-1.5 py-0.5 rounded">
            Labs
          </span>
          <span className="text-[10px] text-text-dim ml-1">
            Product Intelligence System
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-6 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-12">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <p className="text-[10px] text-text-dim">
            myHotel Labs &middot; Product Intelligence System &middot; Las iniciativas enviadas serán evaluadas por IA y presentadas al comité de producto.
          </p>
        </div>
      </footer>
    </div>
  );
}
