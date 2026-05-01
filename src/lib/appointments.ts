export type AppointmentStatus = "requested" | "confirmed" | "cancelled" | "completed" | "rejected";
export type AppointmentType = "in_person" | "home_visit" | "sports_event";

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  requested: "Pendiente",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Completada",
  rejected: "Rechazada",
};

export const STATUS_COLOR: Record<AppointmentStatus, string> = {
  requested: "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200",
  confirmed: "bg-primary/15 text-primary",
  cancelled: "bg-muted text-muted-foreground",
  completed: "bg-accent/20 text-accent-foreground",
  rejected: "bg-destructive/15 text-destructive",
};

export const TYPE_LABEL: Record<AppointmentType, string> = {
  in_person: "En consulta",
  home_visit: "A domicilio",
  sports_event: "Evento deportivo",
};

export const DURATIONS = [30, 45, 60, 75, 90] as const;

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}
