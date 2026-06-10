import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, User, Clock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  STATUS_LABEL, STATUS_COLOR, TYPE_LABEL,
  type AppointmentStatus, type AppointmentType,
  formatDate, formatTime,
} from "@/lib/appointments";

export interface CalendarAppointment {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  type: AppointmentType;
  status: AppointmentStatus;
  notes: string | null;
  player?: { full_name: string | null; email: string } | null;
}

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function AppointmentsCalendar({ appointments }: { appointments: CalendarAppointment[] }) {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarAppointment[]>();
    for (const a of appointments) {
      const key = ymd(new Date(a.scheduled_at));
      const arr = map.get(key);
      if (arr) arr.push(a);
      else map.set(key, [a]);
    }
    for (const arr of map.values()) {
      arr.sort((x, y) => +new Date(x.scheduled_at) - +new Date(y.scheduled_at));
    }
    return map;
  }, [appointments]);

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    // Monday-first offset (getDay: 0=Sun..6=Sat)
    const offset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const result: (Date | null)[] = [];
    for (let i = 0; i < offset; i++) result.push(null);
    for (let d = 1; d <= daysInMonth; d++) result.push(new Date(year, month, d));
    while (result.length % 7 !== 0) result.push(null);
    return result;
  }, [cursor]);

  const todayKey = ymd(today);
  const selectedAppts = selected ? byDay.get(selected) ?? [] : [];

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-3 sm:px-4">
        <h2 className="text-base font-semibold capitalize sm:text-lg">
          {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
        </h2>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
          >
            Hoy
          </Button>
          <Button
            size="icon"
            variant="outline"
            aria-label="Mes anterior"
            onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            aria-label="Mes siguiente"
            onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center text-[11px] font-medium uppercase text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((date, i) => {
          if (!date) return <div key={`e${i}`} className="min-h-[64px] border-b border-r border-border/60 sm:min-h-[96px]" />;
          const key = ymd(date);
          const dayAppts = byDay.get(key) ?? [];
          const isToday = key === todayKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => dayAppts.length && setSelected(key)}
              className={`flex min-h-[64px] flex-col gap-1 border-b border-r border-border/60 p-1 text-left transition-colors sm:min-h-[96px] sm:p-1.5 ${
                dayAppts.length ? "cursor-pointer hover:bg-muted/50" : "cursor-default"
              }`}
            >
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  isToday ? "bg-primary font-bold text-primary-foreground" : "text-foreground"
                }`}
              >
                {date.getDate()}
              </span>
              <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                {dayAppts.slice(0, 3).map((a) => (
                  <span
                    key={a.id}
                    className="truncate rounded bg-primary/15 px-1 py-0.5 text-[10px] font-medium text-primary sm:text-[11px]"
                  >
                    {formatTime(a.scheduled_at)} {a.player?.full_name || a.player?.email || "Cita"}
                  </span>
                ))}
                {dayAppts.length > 3 && (
                  <span className="px-1 text-[10px] text-muted-foreground">+{dayAppts.length - 3} más</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle className="capitalize">{selected && formatDate(selected)}</SheetTitle>
            <SheetDescription>
              {selectedAppts.length} {selectedAppts.length === 1 ? "cita" : "citas"} este día
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {selectedAppts.map((a) => (
              <div key={a.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{a.player?.full_name || a.player?.email || "Jugador"}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{formatTime(a.scheduled_at)} · {a.duration_minutes} min</span>
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{TYPE_LABEL[a.type]}</span>
                    </div>
                    {a.notes && <p className="mt-2 text-sm text-foreground/80">{a.notes}</p>}
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLOR[a.status]}`}>
                    {STATUS_LABEL[a.status]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
