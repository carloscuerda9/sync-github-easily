import { cn } from "@/lib/utils";
import logoFull from "@/assets/wefixyou-logo.png";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center", className)}>
      <img
        src={logoFull}
        alt="We Fix You — Fisioterapia"
        loading="lazy"
        className={cn(
          "object-contain",
          compact ? "h-9 w-auto" : "h-12 w-auto"
        )}
      />
    </div>
  );
}
