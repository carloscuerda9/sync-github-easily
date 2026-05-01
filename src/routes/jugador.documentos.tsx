import { createFileRoute } from "@tanstack/react-router";
import { DocumentsView } from "@/components/DocumentsView";

export const Route = createFileRoute("/jugador/documentos")({
  component: () => <DocumentsView contactRole="physio" />,
});
