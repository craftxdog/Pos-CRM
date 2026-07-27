import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSerializacionStore } from "../store/SerializacionStore";
import { useAsignacionCajaSucursalStore } from "../store/AsignacionCajaSucursalStore";
import { useGlobalStore } from "../store/GlobalStore";
import { toast } from "sonner";
import { useCierreCajaStore } from "../store/CierreCajaStore";

export const useMostrarSerializacionesQuery = (idSucursal) => {
  const { mostrarSerializaciones } = useSerializacionStore();
  const { sucursalesItemSelectAsignadas } = useAsignacionCajaSucursalStore();
  const sucursalId = idSucursal || sucursalesItemSelectAsignadas?.id_sucursal;
  return useQuery({
    queryKey: ["mostrar serializaciones", sucursalId],
    queryFn: () =>
      mostrarSerializaciones({
        id_sucursal: sucursalId,
      }),
    enabled: !!sucursalId,
  });
};
export const useMostrarSerializacionesVentasQuery = () => {
  const { mostrarSerializacionesVentas } = useSerializacionStore();
  const {dataCierreCaja} = useCierreCajaStore()
  return useQuery({
    queryKey: ["mostrar serializaciones ventas"],
    queryFn: () =>
      mostrarSerializacionesVentas({
        id_sucursal: dataCierreCaja?.caja?.id_sucursal,
      }),
    enabled: !!dataCierreCaja,
  });
};
export const useEditarSerializacionDefaultMutation = () => {
  const queryClient = useQueryClient();
  const { itemSelect } = useGlobalStore();
  const { editarSerializacionDefault } = useSerializacionStore();
  return useMutation({
    mutationKey: ["editar serializacion default"],
    mutationFn: async (serializacion) => {
      const selected = serializacion || itemSelect;
      const p = {
        _id: selected?.id,
        _id_sucursal: selected?.sucursal_id,
      };
      await editarSerializacionDefault(p);
    },
    onError: (error) => {
      toast.error("Error al editar por default: " + error.message);
    },
    onSuccess: () => {
      toast.success("Datos guardados");
      queryClient.invalidateQueries({ queryKey: ["mostrar serializaciones"] });
    },
  });
};
export const useEditarSerializacionMutation = () => {
  const queryClient = useQueryClient();
const { itemSelect,setStateClose } = useGlobalStore();
const { editarSerializacion } = useSerializacionStore();
return useMutation({
  mutationKey: ["editar serializacion"],
  mutationFn: async (data) => {
    const p = {
      id: itemSelect?.id,
      cantidad_numeros: data?.cantidad_numeros,
      correlativo: data?.correlativo,
      serie: data?.serie,
    };
    await editarSerializacion(p);
  },
  onError: (error) => {
      toast.error("Error al editar: " + error.message);
    },
    onSuccess: () => {
      toast.success("Datos guardados");
      queryClient.invalidateQueries({ queryKey: ["mostrar serializaciones"] });
      setStateClose(false);
    }
});
};
