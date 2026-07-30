import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useAsignacionCajaSucursalStore } from "../store/AsignacionCajaSucursalStore"
import { useImpresorasStore } from "../store/ImpresorasStore"
import { toast } from "sonner"

export const useMostrasrImpresorasPorCajaQuery =()=>{
    const  {mostrarImpresoraXCaja}= useImpresorasStore()
    const {sucursalesItemSelectAsignadas} = useAsignacionCajaSucursalStore()
    return useQuery({
        queryKey: ['mostrar impresora por caja',{
            id_caja:sucursalesItemSelectAsignadas?.id_caja
        }],
        queryFn: async () => mostrarImpresoraXCaja({
            id_caja:sucursalesItemSelectAsignadas?.id_caja
        }),
        enabled:!!sucursalesItemSelectAsignadas,
        refetchOnWindowFocus: false,

    })
}
export const useEditarImpresorasMutation = () => {
    const {
      dataImpresorasPorCaja,
      editarImpresoras,
      setStatePrintDirecto,
    } =
      useImpresorasStore();
    const queryClient = useQueryClient();
  
    return useMutation({
      mutationKey: ["editar impresoras"],
      mutationFn: async (nextState) => {
        const p = {
          id: dataImpresorasPorCaja?.id,
          state: nextState,
        };
        if (!p.id) {
          throw new Error("No hay una impresora configurada para esta caja.");
        }
        await editarImpresoras(p);
      },
      onError: (error, nextState) => {
        setStatePrintDirecto(!nextState);
        toast.error("Error al editar impresoras: " + error.message);
      },
      onSuccess: () => {
        toast.success("Preferencia de impresión guardada");
        queryClient.invalidateQueries({ queryKey: ["mostrar impresora por caja"] });
      },
    });
  };
