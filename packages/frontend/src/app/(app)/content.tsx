"use client";

// ponytail: home sections wired to atoms when API groups are ready
export function HomeContent({ section }: { readonly section: string }) {
  return (
    <div className="text-muted-foreground py-4 text-center text-sm">
      {section} — connecting to API...
    </div>
  );
}
