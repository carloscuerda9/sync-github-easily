import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/entrenador/")({
  beforeLoad: () => {
    throw redirect({ to: "/entrenador/mensajes" });
  },
});
