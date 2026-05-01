import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2 font-bold tracking-tight", className)}>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <span className="text-sm">WFY</span>
      </div>
      {!compact && (
        <div className="leading-tight">
          <div className="text-sm font-extrabold uppercase">We Fix You.</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Fisioterapia</div>
        </div>
      )}
    </div>
  );
}
