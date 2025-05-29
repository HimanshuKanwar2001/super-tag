import { Tags } from 'lucide-react';
import type React from 'react';

export function AppHeader() {
  return (
    <header className="py-6 px-4 md:px-6 border-b border-border/60">
      <div className="container mx-auto flex items-center gap-3">
        <Tags className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          ReelRank Keywords
        </h1>
      </div>
    </header>
  );
}
