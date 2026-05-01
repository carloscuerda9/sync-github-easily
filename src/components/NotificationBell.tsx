import { Bell, MessageSquare, Calendar, ClipboardList, FileText, Receipt } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useNotifications, type NotificationItem } from "@/lib/notifications-context";
import { cn } from "@/lib/utils";

const ICONS: Record<NotificationItem["kind"], typeof Bell> = {
  message: MessageSquare,
  appointment: Calendar,
  form: ClipboardList,
  document: FileText,
  invoice: Receipt,
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}

export function NotificationBell({ className }: { className?: string }) {
  const { total, recent, markAllSeen } = useNotifications();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className={cn("relative", className)} aria-label="Notificaciones">
          <Bell className="h-5 w-5" />
          {total > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
              {total > 9 ? "9+" : total}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div className="text-sm font-semibold">Notificaciones</div>
          {total > 0 && (
            <button onClick={markAllSeen} className="text-xs text-muted-foreground hover:text-foreground">
              Marcar como vistas
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {recent.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Sin novedades</div>
          ) : (
            recent.map((n) => {
              const Icon = ICONS[n.kind];
              return (
                <Link
                  key={n.id}
                  to={n.href}
                  className="flex items-start gap-3 border-b border-border/50 px-3 py-2.5 transition-colors hover:bg-muted/50"
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{n.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{n.body}</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">{timeAgo(n.created_at)}</div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
