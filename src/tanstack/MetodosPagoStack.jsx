import { useQuery } from "@tanstack/react-query";
import { useMetodosPagoStore } from "../store/MetodosPagoStore";
import { useEmpresaStore } from "../store/EmpresaStore";

export const useMostrarMetodosPagoQuery = () => {
  const { mostrarMetodosPago } = useMetodosPagoStore();
  const { dataempresa } = useEmpresaStore();
  return useQuery({
    queryKey: ["mostrar metodos de pago", dataempresa?.id],
    queryFn: () => mostrarMetodosPago({ id_empresa: dataempresa?.id }),
    enabled: Boolean(dataempresa?.id),
  });
};
