import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";
export const Route = createFileRoute("/fisio/facturacion")({ component: () => <ComingSoon title="Facturación" desc="Crear facturas, exportar PDF y resumen de ingresos." /> });
