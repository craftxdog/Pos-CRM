import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@iconify/react/dist/iconify.js";
import Swal from "sweetalert2";
import styled from "styled-components";
import { toast } from "sonner";
import { useCajasStore } from "../../../store/CajasStore";
import { useEmpresaStore } from "../../../store/EmpresaStore";
import { useSucursalesStore } from "../../../store/SucursalesStore";
import { Device } from "../../../styles/breakpoints";
import { formatDateTime } from "../../../utils/dateTime";
import { ButtonDashed } from "../../ui/buttons/ButtonDashed";
import { BarLoader } from "../../ui/loaders/BarLoader";

const number = (value) => Number(value || 0).toLocaleString("es-NI");

export const ListSucursales = () => {
  const queryClient = useQueryClient();
  const { mostrarCajasXSucursal, setStateSucursal, setAccion, selectSucursal } =
    useSucursalesStore();
  const { dataempresa } = useEmpresaStore();
  const {
    setStateCaja,
    setCajaSelectItem,
    setAccion: setAccionCaja,
    cambiarEstadoCaja,
    diagnosticarRetiroCaja,
  } = useCajasStore();

  const { data = [], isLoading, error } = useQuery({
    queryKey: ["mostrar Cajas XSucursal", dataempresa?.id],
    queryFn: () => mostrarCajasXSucursal({ id_empresa: dataempresa?.id }),
    enabled: Boolean(dataempresa?.id),
  });

  const stateMutation = useMutation({
    mutationKey: ["cambiar estado caja"],
    mutationFn: cambiarEstadoCaja,
    onError: (mutationError) => toast.error(mutationError.message),
    onSuccess: (_, variables) => {
      toast.success(
        variables.estado === "activa"
          ? "Caja reactivada correctamente"
          : "Caja retirada; su historial permanece intacto",
      );
      queryClient.invalidateQueries({ queryKey: ["mostrar Cajas XSucursal"] });
      queryClient.invalidateQueries({ queryKey: ["mostrar caja por sucursal"] });
    },
  });

  const editarSucursal = (sucursal) => {
    selectSucursal(sucursal);
    setStateSucursal(true);
    setAccion("Editar");
  };

  const agregarCaja = (sucursal) => {
    setAccionCaja("Nuevo");
    setCajaSelectItem(sucursal);
    setStateCaja(true);
  };

  const editarCaja = (caja) => {
    setAccionCaja("Editar");
    setCajaSelectItem(caja);
    setStateCaja(true);
  };

  const solicitarRetiro = async (caja) => {
    try {
      const diagnostico = await diagnosticarRetiroCaja({ id: caja.id });
      if (!diagnostico.puede_retirar) {
        const reason = Number(diagnostico.turnos_abiertos) > 0
          ? "Primero debes cerrar y conciliar el turno activo."
          : "La sucursal debe conservar por lo menos una caja activa.";
        await Swal.fire({
          icon: "warning",
          title: "La caja aún no se puede retirar",
          text: reason,
          confirmButtonText: "Entendido",
        });
        return;
      }

      const result = await Swal.fire({
        icon: "question",
        title: `Retirar ${caja.descripcion}`,
        html: `
          <p style="margin:0 0 12px">La caja dejará de aparecer al vender, pero no se borrará ningún dato.</p>
          <div style="text-align:left;line-height:1.7;background:#f4f7fb;padding:12px 16px;border-radius:12px">
            <b>${number(diagnostico.cierres_historicos)}</b> cierres conservados<br>
            <b>${number(diagnostico.movimientos_historicos)}</b> movimientos conservados<br>
            <b>${number(diagnostico.ventas_historicas)}</b> ventas conservadas<br>
            <b>${number(diagnostico.asignaciones)}</b> asignaciones se liberarán
          </div>`,
        showCancelButton: true,
        confirmButtonText: "Sí, retirar caja",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#b45309",
      });

      if (result.isConfirmed) {
        stateMutation.mutate({ id: caja.id, estado: "inactiva" });
      }
    } catch (diagnosticError) {
      toast.error(diagnosticError.message);
    }
  };

  const solicitarReactivacion = async (caja) => {
    const result = await Swal.fire({
      icon: "info",
      title: `Reactivar ${caja.descripcion}`,
      text: "Volverá a estar disponible para asignaciones y nuevas aperturas de caja.",
      showCancelButton: true,
      confirmButtonText: "Reactivar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#15803d",
    });
    if (result.isConfirmed) {
      stateMutation.mutate({ id: caja.id, estado: "activa" });
    }
  };

  if (isLoading) return <BarLoader color="#6d6d6d" />;
  if (error) return <ErrorMessage>No fue posible cargar las cajas: {error.message}</ErrorMessage>;

  return (
    <Container>
      {data.map((sucursal) => {
        const cashboxes = sucursal.caja || [];
        const activeCount = cashboxes.filter((item) => item.estado !== "inactiva").length;
        return (
          <Sucursal key={sucursal.id}>
            <SucursalHeader>
              <div>
                <Eyebrow>Sucursal</Eyebrow>
                <SucursalTitle>{sucursal.nombre}</SucursalTitle>
                <Summary>{activeCount} activa(s) · {cashboxes.length - activeCount} retirada(s)</Summary>
              </div>
              <IconButton type="button" onClick={() => editarSucursal(sucursal)} aria-label={`Editar sucursal ${sucursal.nombre}`}>
                <Icon icon="mdi:pencil-outline" width="20" />
              </IconButton>
            </SucursalHeader>

            <CajaList>
              {cashboxes.map((caja) => {
                const isActive = caja.estado !== "inactiva";
                return (
                  <CajaItem key={caja.id} $inactive={!isActive}>
                    <CajaTopline>
                      <Status $active={isActive}>{isActive ? "Activa" : "Retirada"}</Status>
                      <small>{isActive ? "Disponible para operar" : `Retirada ${formatDateTime(caja.archived_at)}`}</small>
                    </CajaTopline>
                    <CajaDescripcion>{caja.descripcion}</CajaDescripcion>
                    <FechaCreacion>Creada: {formatDateTime(caja.created_at || caja.fecha_creacion)}</FechaCreacion>
                    <Actions>
                      <ActionButton type="button" onClick={() => editarCaja(caja)}>
                        <Icon icon="mdi:pencil-outline" width="18" /> Editar
                      </ActionButton>
                      <ActionButton
                        type="button"
                        $danger={isActive}
                        $success={!isActive}
                        disabled={stateMutation.isPending}
                        onClick={() => (isActive ? solicitarRetiro(caja) : solicitarReactivacion(caja))}
                      >
                        <Icon icon={isActive ? "mdi:archive-arrow-down-outline" : "mdi:restore"} width="18" />
                        {isActive ? "Retirar" : "Reactivar"}
                      </ActionButton>
                    </Actions>
                  </CajaItem>
                );
              })}
            </CajaList>

            <ButtonDashed title="agregar caja" funcion={() => agregarCaja(sucursal)} />
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
const CajaList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;
const CajaItem = styled.li`
  border: 1px solid ${({ $inactive }) => ($inactive ? "#d8dee8" : "#b7e2c5")};
  background: ${({ $inactive }) => ($inactive ? "#f8fafc" : "#fbfffc")};
  border-radius: 15px;
  padding: 14px;
  opacity: ${({ $inactive }) => ($inactive ? 0.82 : 1)};
`;
const CajaTopline = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  small { color: #64748b; font-size: 10px; text-align: right; }
`;
const Status = styled.span`
  border-radius: 999px;
  padding: 4px 8px;
  color: ${({ $active }) => ($active ? "#166534" : "#475569")};
  background: ${({ $active }) => ($active ? "#dcfce7" : "#e2e8f0")};
  font-size: 11px;
  font-weight: 800;
`;
const CajaDescripcion = styled.strong`
  display: block;
  margin-top: 11px;
  color: ${({ theme }) => theme.text};
  font-size: 17px;
`;
const FechaCreacion = styled.small`
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
