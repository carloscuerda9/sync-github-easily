import { createFileRoute } from "@tanstack/react-router";
import { MessagesView } from "@/components/MessagesView";

export const Route = createFileRoute("/entrenador/mensajes")({
  head: () => ({
    meta: [
      { title: "Mensajes del entrenador | We Fix You" },
      { name: "description", content: "Habla con los jugadores y fisioterapeutas de tu club desde el panel de entrenador." },
      { property: "og:title", content: "Mensajes del entrenador | We Fix You" },
      { property: "og:description", content: "Mensajería directa entre entrenador, jugadores y fisios del club." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <MessagesView
      contactRole={["player", "physio"]}
      emptyTitle="Selecciona un contacto"
      emptyDesc="Escribe a cualquier jugador o fisioterapeuta de tu club desde la lista."
      subtitle="Jugadores y fisios de tu club"
    />
  ),
});
