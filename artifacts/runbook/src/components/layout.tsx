import { Link } from "wouter";
import { Terminal, Settings, BookOpen } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground font-mono">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 font-bold text-primary hover:text-primary/80 transition-colors">
              <Terminal className="h-5 w-5" />
              <span>GITHUB_ACTIONS_RUNBOOK</span>
            </Link>
            <nav className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
              <Link href="/" className="flex items-center gap-1 hover:text-foreground transition-colors">
                <BookOpen className="h-4 w-4" />
                Index
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/runbooks/new" className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-sm font-semibold hover:bg-primary/90 transition-colors" data-testid="link-new-runbook">
              + NEW RUNBOOK
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
