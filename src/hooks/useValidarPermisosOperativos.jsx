import { toast } from "sonner";
import { usePermisosStore } from "../store/PermisosStore";
import { useUsuariosStore } from "../store/UsuariosStore";

export const useValidarPermisosOperativos = () => {
  const { dataPermisosGlobales } = usePermisosStore();
  const { datausuarios } = useUsuariosStore();

  const validarPermiso = (p) => {
    const isAdmin = ["superadmin", "administrador", "admin"].includes(
      datausuarios?.roles?.nombre?.toLowerCase()
    );

    if (isAdmin) return true;

    const hasPermission = dataPermisosGlobales?.some(
      (item) => item.modulos?.nombre === p
    );
    if (!hasPermission) {
      toast.warning("No tienes permisos para realizar esta acción");
      return false;
    }
    return true;
  };
  return { validarPermiso };
};
