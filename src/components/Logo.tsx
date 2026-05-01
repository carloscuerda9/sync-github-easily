import { cn } from "@/lib/utils";
import logoMark from "@/assets/logo-mark.png";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <img
        src={logoMark}
        alt="We Fix You"
        width={40}
        height={40}
        loading="lazy"
        className="h-10 w-10 shrink-0 object-contain"
      />
      {!compact && (
        <div className="leading-tight">
          <div className="text-sm font-extrabold uppercase tracking-tight text-foreground">
            We Fix You.
          </div>
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent">
            Fisioterapia
          </div>
        </div>
      )}
    </div>
  );
}
