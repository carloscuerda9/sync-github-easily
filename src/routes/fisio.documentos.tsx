import { createFileRoute } from "@tanstack/react-router";
import { DocumentsView } from "@/components/DocumentsView";

export const Route = createFileRoute("/fisio/documentos")({
  component: () => <DocumentsView contactRole="player" />,
});
