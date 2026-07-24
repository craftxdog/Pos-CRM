import { useLocation } from "react-router-dom";
import { CRMTemplate } from "../components/templates/CRMTemplate";

const tabByPath = {
  "/crm": "procesos",
  "/crm/procesos": "procesos",
  "/crm/clientes": "clientes",
  "/crm/pagos": "pagos",
  "/crm/horarios": "horarios",
  "/crm/trabajadores": "trabajadores",
  "/crm/whatsapp": "whatsapp",
  "/crm/permisos": "permisos",
};

export function CRM() {
  const location = useLocation();
  return <CRMTemplate initialTab={tabByPath[location.pathname] || "procesos"} />;
}
