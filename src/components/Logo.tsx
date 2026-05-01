import { cn } from "@/lib/utils";
import logoFull from "@/assets/wefixyou-logo.png";
import logoMark from "@/assets/wefixyou-mark.png";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center", className)}>
      <img
        src={compact ? logoMark : logoFull}
        alt="We Fix You — Fisioterapia"
        loading="lazy"
        className={cn("object-contain", compact ? "h-9 w-auto" : "h-14 w-auto")}
      />
    </div>
  );
}
