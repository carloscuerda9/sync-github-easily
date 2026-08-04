import { createFileRoute } from "@tanstack/react-router";
import { MessagesView } from "@/components/MessagesView";

export const Route = createFileRoute("/jugador/mensajes")({
  component: () => (
    <MessagesView
      contactRole={["physio", "coach"]}
      emptyTitle="Selecciona un contacto"
      emptyDesc="Escríbele a los fisios o a tu entrenador desde la lista de la izquierda."
    />
  ),
});
