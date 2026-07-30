import { useQuery } from "@tanstack/react-query";
import { useCierreCajaStore } from "../store/CierreCajaStore";
import { useEmpresaStore } from "../store/EmpresaStore";
import { useUsuariosStore } from "../store/UsuariosStore";
import { useAsignacionCajaSucursalStore } from "../store/AsignacionCajaSucursalStore";

export const useMostrarCierreCajaPorEmpresaQuery = () => {
  const { mostrarCierreCajaPorEmpresa } = useCierreCajaStore();

  const { dataempresa } = useEmpresaStore();
  return useQuery({
    queryKey: [
      "mostrar cierre caja por empresa",
      {
        _id_empresa: dataempresa?.id,
      },
    ],
    queryFn: () =>
      mostrarCierreCajaPorEmpresa({
        _id_empresa: dataempresa?.id,
      }),
    enabled: Boolean(dataempresa?.id),
  });
};
export const useMostrarAperturasCajaPorUsuarioQuery = () => {
  const { mostrarCierreCajaPorUsuario } = useCierreCajaStore();

  const { datausuarios } = useUsuariosStore();
  const { sucursalesItemSelectAsignadas } =
    useAsignacionCajaSucursalStore();
  const assignedCashboxId = sucursalesItemSelectAsignadas?.id_caja;
  return useQuery({
    queryKey: [
      "mostrar caja aperturada por usuario",
      {
        id_usuario: datausuarios?.id,
        id_caja: assignedCashboxId,
      },
    ],
    queryFn: () =>
      mostrarCierreCajaPorUsuario({
        id_usuario: datausuarios?.id,
        id_caja: assignedCashboxId,
      }),
    enabled: Boolean(datausuarios?.id),
    retry: false,
  });
};
