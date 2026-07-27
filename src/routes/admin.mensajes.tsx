import { createFileRoute } from "@tanstack/react-router";
import { MessagesView } from "@/components/MessagesView";

export const Route = createFileRoute("/admin/mensajes")({
  component: () => (
    <MessagesView
      contactRole={["player", "physio"]}
      subtitle="Escribe a cualquier jugador o fisioterapeuta de la plataforma."
      emptyTitle="Selecciona un contacto"
      emptyDesc="Elige un jugador o fisioterapeuta de la lista para empezar la conversación."
    />
  ),
});
