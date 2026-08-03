import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@iconify/react/dist/iconify.js";
import Swal from "sweetalert2";
import styled from "styled-components";
import { toast } from "sonner";
import { useAlmacenesStore } from "../../../store/AlmacenesStore";
import { useEmpresaStore } from "../../../store/EmpresaStore";
import { useSucursalesStore } from "../../../store/SucursalesStore";
import { Device } from "../../../styles/breakpoints";
import { formatDateTime } from "../../../utils/dateTime";
import { ButtonDashed } from "../../ui/buttons/ButtonDashed";
import { BarLoader } from "../../ui/loaders/BarLoader";

const number = (value) => Number(value || 0).toLocaleString("es-NI");

export const ListAlmacenes = () => {
  const queryClient = useQueryClient();
  const { setStateSucursal, setAccion, selectSucursal } = useSucursalesStore();
  const { dataempresa } = useEmpresaStore();
  const {
    setStateAlmacen,
    setAlmacenSelectItem,
    setAccion: setAccionAlmacen,
    cambiarEstadoAlmacen,
    diagnosticarRetiroAlmacen,
    mostrarAlmacenesXEmpresa,
  } = useAlmacenesStore();

  const { data = [], isLoading, error } = useQuery({
    queryKey: ["mostrar almacenes X empresa", dataempresa?.id],
    queryFn: () => mostrarAlmacenesXEmpresa({ id_empresa: dataempresa?.id }),
    enabled: Boolean(dataempresa?.id),
  });

  const stateMutation = useMutation({
    mutationKey: ["cambiar estado almacen"],
    mutationFn: cambiarEstadoAlmacen,
    onError: (mutationError) => toast.error(mutationError.message),
    onSuccess: (_, variables) => {
      toast.success(
        variables.estado === "activa"
          ? "Almacén reactivado correctamente"
          : "Almacén retirado; su historial permanece intacto",
      );
      queryClient.invalidateQueries({ queryKey: ["mostrar almacenes X empresa"] });
      queryClient.invalidateQueries({ queryKey: ["mostrar almacen por sucursal"] });
    },
  });

  const editarSucursal = (sucursal) => {
    selectSucursal(sucursal);
    setStateSucursal(true);
    setAccion("Editar");
  };

  const agregarAlmacen = (sucursal) => {
    setAccionAlmacen("Nuevo");
    setAlmacenSelectItem(sucursal);
    setStateAlmacen(true);
  };

  const editarAlmacen = (almacen) => {
    setAccionAlmacen("Editar");
    setAlmacenSelectItem(almacen);
    setStateAlmacen(true);
  };

  const solicitarRetiro = async (almacen) => {
    try {
      const diagnostico = await diagnosticarRetiroAlmacen({ id: almacen.id });
      if (!diagnostico.puede_retirar) {
        const reason = Number(diagnostico.filas_con_stock) > 0
          ? `Todavía contiene ${number(diagnostico.existencias)} unidad(es). Transfiere o ajusta las existencias a cero.`
          : "La sucursal debe conservar por lo menos un almacén activo.";
        await Swal.fire({
          icon: "warning",
          title: "El almacén aún no se puede retirar",
          text: reason,
          confirmButtonText: "Entendido",
        });
        return;
      }

      const result = await Swal.fire({
        icon: "question",
        title: `Retirar ${almacen.nombre}`,
        html: `
          <p style="margin:0 0 12px">Dejará de aparecer en operaciones nuevas. Los movimientos anteriores seguirán visibles.</p>
          <div style="text-align:left;line-height:1.7;background:#f4f7fb;padding:12px 16px;border-radius:12px">
            Existencias actuales: <b>${number(diagnostico.existencias)}</b><br>
            Movimientos conservados: <b>${number(diagnostico.movimientos_historicos)}</b><br>
            Otros almacenes activos: <b>${number(diagnostico.otras_activas)}</b>
          </div>`,
        showCancelButton: true,
        confirmButtonText: "Sí, retirar almacén",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#b45309",
      });
      if (result.isConfirmed) {
        stateMutation.mutate({ id: almacen.id, estado: "inactiva" });
      }
    } catch (diagnosticError) {
      toast.error(diagnosticError.message);
    }
  };

  const solicitarReactivacion = async (almacen) => {
    const result = await Swal.fire({
      icon: "info",
      title: `Reactivar ${almacen.nombre}`,
      text: "Volverá a estar disponible para inventario, compras y ventas.",
      showCancelButton: true,
      confirmButtonText: "Reactivar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#15803d",
    });
    if (result.isConfirmed) {
      stateMutation.mutate({ id: almacen.id, estado: "activa" });
    }
  };

  if (isLoading) return <BarLoader color="#6d6d6d" />;
  if (error) return <ErrorMessage>No fue posible cargar los almacenes: {error.message}</ErrorMessage>;

  return (
    <Container>
      {data.map((sucursal) => {
        const warehouses = sucursal.almacen || [];
        const activeCount = warehouses.filter((item) => item.estado !== "inactiva").length;
        return (
          <Sucursal key={sucursal.id}>
            <SucursalHeader>
              <div>
                <Eyebrow>Sucursal</Eyebrow>
                <SucursalTitle>{sucursal.nombre}</SucursalTitle>
                <Summary>{activeCount} activo(s) · {warehouses.length - activeCount} retirado(s)</Summary>
              </div>
              <IconButton type="button" onClick={() => editarSucursal(sucursal)} aria-label={`Editar sucursal ${sucursal.nombre}`}>
                <Icon icon="mdi:pencil-outline" width="20" />
              </IconButton>
            </SucursalHeader>

            <WarehouseList>
              {warehouses.map((almacen) => {
                const isActive = almacen.estado !== "inactiva";
                return (
                  <WarehouseItem key={almacen.id} $inactive={!isActive}>
                    <WarehouseTopline>
                      <Status $active={isActive}>{isActive ? "Activo" : "Retirado"}</Status>
                      <small>{isActive ? "Disponible para operar" : `Retirado ${formatDateTime(almacen.archived_at)}`}</small>
                    </WarehouseTopline>
                    <WarehouseName>{almacen.nombre}</WarehouseName>
                    <CreatedAt>Creado: {formatDateTime(almacen.created_at || almacen.fecha_creacion)}</CreatedAt>
                    <Actions>
                      <ActionButton type="button" onClick={() => editarAlmacen(almacen)}>
                        <Icon icon="mdi:pencil-outline" width="18" /> Editar
                      </ActionButton>
                      <ActionButton
                        type="button"
                        $danger={isActive}
                        $success={!isActive}
                        disabled={stateMutation.isPending}
                        onClick={() => (isActive ? solicitarRetiro(almacen) : solicitarReactivacion(almacen))}
                      >
                        <Icon icon={isActive ? "mdi:archive-arrow-down-outline" : "mdi:restore"} width="18" />
                        {isActive ? "Retirar" : "Reactivar"}
                      </ActionButton>
                    </Actions>
                  </WarehouseItem>
                );
              })}
            </WarehouseList>

            <ButtonDashed title="agregar almacén" funcion={() => agregarAlmacen(sucursal)} />
          </Sucursal>
        );
      })}
    </Container>
  );
};

const Container = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
  width: min(92%, 1200px);
  margin: auto;
  @media ${Device.tablet} { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  @media ${Device.desktop} { grid-template-columns: repeat(3, minmax(0, 1fr)); }
`;
const Sucursal = styled.article`
  align-self: start;
  background: ${({ theme }) => theme.body};
  border: 1px solid ${({ theme }) => theme.bordercolorDash};
  border-radius: 20px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.08);
`;
const SucursalHeader = styled.header`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
`;
const Eyebrow = styled.span`
  display: block;
  color: #0284c7;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
`;
const SucursalTitle = styled.h3`
  margin: 3px 0;
  color: ${({ theme }) => theme.text};
  font-size: 19px;
  font-weight: 800;
  overflow-wrap: anywhere;
`;
const Summary = styled.small`color: #64748b;`;
const IconButton = styled.button`
  width: 38px;
  height: 38px;
  border: 1px solid #d7dee8;
  border-radius: 11px;
  background: #fff;
  color: #334155;
  display: grid;
  place-items: center;
  cursor: pointer;
  &:hover { border-color: #38bdf8; color: #0284c7; }
`;
const WarehouseList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;
const WarehouseItem = styled.li`
  border: 1px solid ${({ $inactive }) => ($inactive ? "#d8dee8" : "#bae6fd")};
  background: ${({ $inactive }) => ($inactive ? "#f8fafc" : "#f8fdff")};
  border-radius: 15px;
  padding: 14px;
  opacity: ${({ $inactive }) => ($inactive ? 0.82 : 1)};
`;
const WarehouseTopline = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  small { color: #64748b; font-size: 10px; text-align: right; }
`;
const Status = styled.span`
  border-radius: 999px;
  padding: 4px 8px;
  color: ${({ $active }) => ($active ? "#075985" : "#475569")};
  background: ${({ $active }) => ($active ? "#e0f2fe" : "#e2e8f0")};
  font-size: 11px;
  font-weight: 800;
`;
const WarehouseName = styled.strong`
  display: block;
  margin-top: 11px;
  color: ${({ theme }) => theme.text};
  font-size: 17px;
`;
const CreatedAt = styled.small`
  display: block;
  margin-top: 4px;
  color: #64748b;
`;
const Actions = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 13px;
`;
const ActionButton = styled.button`
  min-height: 38px;
  border: 1px solid ${({ $danger, $success }) => ($danger ? "#fed7aa" : $success ? "#bbf7d0" : "#d7dee8")};
  border-radius: 10px;
  background: ${({ $danger, $success }) => ($danger ? "#fff7ed" : $success ? "#f0fdf4" : "#fff")};
  color: ${({ $danger, $success }) => ($danger ? "#9a3412" : $success ? "#166534" : "#334155")};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-weight: 750;
  cursor: pointer;
  &:disabled { cursor: wait; opacity: 0.55; }
`;
const ErrorMessage = styled.p`
  width: min(92%, 900px);
  margin: 24px auto;
  padding: 16px;
  border-radius: 12px;
  background: #fef2f2;
  color: #991b1b;
`;
