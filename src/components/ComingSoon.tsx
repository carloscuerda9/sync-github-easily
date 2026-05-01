import { Construction } from "lucide-react";

export function ComingSoon({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Construction className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
        <p className="mt-4 text-xs text-muted-foreground">
          Próximamente en la siguiente fase de desarrollo.
        </p>
      </div>
    </div>
  );
}
