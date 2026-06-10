import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, User, Clock, MapPin, Pencil, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  STATUS_LABEL, STATUS_COLOR, TYPE_LABEL, DURATIONS,
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

export interface AppointmentChanges {
  scheduled_at: string;
  duration_minutes: number;
  type: AppointmentType;
  notes: string | null;
}

interface AppointmentsCalendarProps {
  appointments: CalendarAppointment[];
  onSave?: (id: string, changes: AppointmentChanges) => Promise<void> | void;
  onCancel?: (id: string) => Promise<void> | void;
}

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function ymd(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function toDateInput(iso: string) {
  return ymd(new Date(iso));
}
function toTimeInput(iso: string) {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AppointmentsCalendar({ appointments, onSave, onCancel }: AppointmentsCalendarProps) {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<string | null>(null);

  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<{ date: string; time: string; duration: number; type: AppointmentType; notes: string }>({
    date: "", time: "", duration: 60, type: "in_person", notes: "",
  });
  const [busy, setBusy] = useState(false);

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

  // Close the day sheet automatically when its appointments are gone (e.g. after cancelling).
  useEffect(() => {
    if (selected && (byDay.get(selected)?.length ?? 0) === 0) {
      setSelected(null);
      setEditing(null);
    }
  }, [byDay, selected]);

  const startEdit = (a: CalendarAppointment) => {
    setEditing(a.id);
    setForm({
      date: toDateInput(a.scheduled_at),
      time: toTimeInput(a.scheduled_at),
      duration: a.duration_minutes,
      type: a.type,
      notes: a.notes ?? "",
    });
  };

  const submitEdit = async (id: string) => {
    if (!onSave || !form.date || !form.time) return;
    const scheduled = new Date(`${form.date}T${form.time}`);
    if (isNaN(scheduled.getTime())) return;
    setBusy(true);
    try {
      await onSave(id, {
        scheduled_at: scheduled.toISOString(),
        duration_minutes: form.duration,
        type: form.type,
        notes: form.notes.trim() ? form.notes.trim() : null,
      });
      setEditing(null);
    } finally {
      setBusy(false);
    }
  };

  const cancelAppointment = async (id: string) => {
    if (!onCancel) return;
    setBusy(true);
    try {
      await onCancel(id);
      setEditing(null);
    } finally {
      setBusy(false);
    }
  };

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

      <Sheet open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setEditing(null); } }}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle className="capitalize">{selected && formatDate(selected)}</SheetTitle>
            <SheetDescription>
              {selectedAppts.length} {selectedAppts.length === 1 ? "cita" : "citas"} este día
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {selectedAppts.map((a) => (
              <div key={a.id} className="rounded-xl border border-border bg-card p-3">
                {editing === a.id ? (
                  <div className="space-y-3">
                    <div className="text-sm font-semibold">{a.player?.full_name || a.player?.email || "Jugador"}</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor={`date-${a.id}`} className="text-xs">Fecha</Label>
                        <Input id={`date-${a.id}`} type="date" value={form.date}
                          onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`time-${a.id}`} className="text-xs">Hora</Label>
                        <Input id={`time-${a.id}`} type="time" value={form.time}
                          onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Duración</Label>
                        <Select value={String(form.duration)}
                          onValueChange={(v) => setForm((f) => ({ ...f, duration: Number(v) }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {DURATIONS.map((d) => (
                              <SelectItem key={d} value={String(d)}>{d} min</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Tipo</Label>
                        <Select value={form.type}
                          onValueChange={(v) => setForm((f) => ({ ...f, type: v as AppointmentType }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(Object.keys(TYPE_LABEL) as AppointmentType[]).map((t) => (
                              <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`notes-${a.id}`} className="text-xs">Notas</Label>
                      <Textarea id={`notes-${a.id}`} rows={2} value={form.notes}
                        onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing(null)}>
                        Cancelar
                      </Button>
                      <Button size="sm" disabled={busy} onClick={() => submitEdit(a.id)}>
                        <Save className="mr-1 h-3.5 w-3.5" /> Guardar
                      </Button>
                    </div>
                  </div>
                ) : (
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
                      {(onSave || onCancel) && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {onSave && (
                            <Button size="sm" variant="outline" disabled={busy} onClick={() => startEdit(a)}>
                              <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                            </Button>
                          )}
                          {onCancel && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="outline" disabled={busy}
                                  className="text-destructive hover:text-destructive">
                                  <X className="mr-1 h-3.5 w-3.5" /> Rechazar
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Rechazar esta cita?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    La cita se cancelará y el jugador será notificado. Esta acción no se puede deshacer.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Volver</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => cancelAppointment(a.id)}>
                                    Rechazar cita
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      )}
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLOR[a.status]}`}>
                      {STATUS_LABEL[a.status]}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
