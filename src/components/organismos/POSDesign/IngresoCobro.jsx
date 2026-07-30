import styled from "styled-components";

import { Icon } from "@iconify/react/dist/iconify.js";
import { InputText } from "../formularios/InputText";
import { FormatearNumeroDinero } from "../../../utils/Conversiones";
import { useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { Btn1 } from "../../moleculas/Btn1";
import { useUsuariosStore } from "../../../store/UsuariosStore";
import { useSucursalesStore } from "../../../store/SucursalesStore";
import { useEmpresaStore } from "../../../store/EmpresaStore";
import { useVentasStore } from "../../../store/VentasStore";
import { useDetalleVentasStore } from "../../../store/DetalleVentasStore";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PanelBuscador } from "./PanelBuscador";
import { useClientesProveedoresStore } from "../../../store/ClientesProveedoresStore";
import { useMetodosPagoStore } from "../../../store/MetodosPagoStore";
import { useCierreCajaStore } from "../../../store/CierreCajaStore";
import { useFormattedDate } from "../../../hooks/useFormattedDate";
import { useAsignacionCajaSucursalStore } from "../../../store/AsignacionCajaSucursalStore";
import { useSerializacionStore } from "../../../store/SerializacionStore";
import { useImpresorasStore } from "../../../store/ImpresorasStore";
import { getPrintServiceUrl } from "../../../store/ImpresorasStore";
import ticket from "../../../reports/TicketVenta";
import { RegistrarClientesProveedores } from "../formularios/RegistrarClientesProveedores";
import { useGlobalStore } from "../../../store/GlobalStore";
export const IngresoCobro = forwardRef((props, ref) => {
  const fechaActual = useFormattedDate();
  const {
    tipocobro,
    items,
    setStatePantallaCobro,
    resetState,
    confirmarVenta,
    dataventaconfirmada,
  } = useVentasStore();
  const { total } = useDetalleVentasStore();
  //Valores a calcular
  const [stateBuscadorClientes, setStateBuscadorClientes] = useState(false);
  const [precioVenta, setPrecioVenta] = useState(total);
  const [valoresPago, setValoresPago] = useState({});
  const [valorTarjeta, setValorTarjeta] = useState(
    tipocobro === "tarjeta" ? total : 0
  );
  const [valorEfectivo, setValorEfectivo] = useState(
    tipocobro === "efectivo" ? total : 0
  );
  const [valorCredito, setValorCredito] = useState(
    tipocobro === "credito" ? total : 0
  );
  //Valores a mostrar
  const [vuelto, setVuelto] = useState(0);
  const [restante, setRestante] = useState(0);
  //datos de tipos de pago
  const { dataMetodosPago } = useMetodosPagoStore();
  //datos de la store
  const { datausuarios } = useUsuariosStore();
  const { sucursalesItemSelectAsignadas } = useAsignacionCajaSucursalStore();
  const { dataempresa } = useEmpresaStore();
  const { idventa, insertarVentas } = useVentasStore();
  const { datadetalleventa } = useDetalleVentasStore();
  const { dataComprobantes, itemComprobanteSelect, setItemComprobanteSelect } =
    useSerializacionStore();
  //mostrar data de impresoras
  const { dataImpresorasPorCaja } = useImpresorasStore();
  //#region Clientes
  const {
    buscarCliPro,
    setBuscador,
    buscador,
    selectCliPro,
    cliproItemSelect,
  } = useClientesProveedoresStore();
  const queryClient = useQueryClient();
  const { data: dataBuscadorcliente, isLoading: isloadingBuscadorCliente } =
    useQuery({
      queryKey: ["buscar cliente", [dataempresa?.id, "cliente", buscador]],
      queryFn: () =>
        buscarCliPro({
          id_empresa: dataempresa?.id,
          tipo: "cliente",
          buscador: buscador,
        }),
      enabled: !!dataempresa,
      refetchOnWindowFocus: false,
    });
  //#endregion
  //Mostrar cierres de caja
  const { dataCierreCaja } = useCierreCajaStore();
  // Función para calcular vuelto y restante
  const calcularVueltoYRestante = () => {
    const totalPagado = Object.values(valoresPago).reduce(
      (acc, curr) => acc + curr,
      0
    );
    const totalSinEfectivo = totalPagado - (valoresPago["Efectivo"] || 0);
    // Si el total sin efectivo excede el precio de venta, no permitir el exceso
    if (totalSinEfectivo > precioVenta) {
      setVuelto(0);
      setRestante(precioVenta - totalSinEfectivo); //Restante negativo para indicar que se excede sin efectivo
    } else {
      // Permitir el exceso solo si es en efectivo
      if (totalPagado >= precioVenta) {
        const exceso = totalPagado - precioVenta;
        setVuelto(valoresPago["Efectivo"] ? exceso : 0);
        setRestante(0);
      } else {
        // Si el total pagado no cubre el precio de venta, calcular el restante
        setVuelto(0);
        setRestante(precioVenta - totalPagado);
      }
    }
  };
  //Manejadores de cambio
  const handleChangePago = (tipo, valor) => {
    setValoresPago((prev) => ({
      ...prev,
      [tipo]: parseFloat(valor) || 0,
    }));
    console.log(valoresPago);
    //{100,50,10}
  };
  // Exponiendo la función mutation a través de ref
  useImperativeHandle(ref, () => ({
    mutateAsync: mutation.mutateAsync,
  }));
  //Funcion para realizar la venta
  const mutation = useMutation({
    mutationKey: "insertar ventas",
    mutationFn: ConfirmarVenta,
    onSuccess: () => {
      if (restante != 0) {
        return;
      }
      resetState();
      queryClient.invalidateQueries(["mostrar detalle venta"]);
      toast.success("🎉 venta generada correctamente!!!");
    },
    onError: (error) => {
      toast.error(
        error?.message ||
          "No se pudo confirmar la venta. La caja no registró movimientos."
      );
    },
  });
  async function ConfirmarVenta() {
    if (restante === 0) {
      const nuevosMetodosPago = Object.entries(valoresPago)
        .filter(([, monto]) => monto > 0)
        .map(([tipo, monto]) => {
          const metodoPago = dataMetodosPago.find(
            (item) => item.nombre === tipo
          );
          return {
            tipo,
            monto,
            id_metodo_pago: metodoPago?.id,
            vuelto: tipo === "Efectivo" ? vuelto : 0,
          };
        });
      const pventas = {
        _id_venta: idventa,
        _id_usuario: datausuarios?.id,
        _vuelto: vuelto,
        _id_tipo_comprobante: itemComprobanteSelect?.id_tipo_comprobante,
        _serie: itemComprobanteSelect?.serie,
        _id_sucursal: dataCierreCaja?.caja?.id_sucursal,
        _id_cliente: cliproItemSelect?.id || null,
        _fecha: fechaActual,
        _monto_total: total,
        _id_cierre_caja: dataCierreCaja?.id,
        _pagos: nuevosMetodosPago,
      };
      const dataVentaConfirmada = await confirmarVenta(pventas);
      const pPrint = {
        dataempresa: dataempresa,
        productos: datadetalleventa,
        dataventas: dataVentaConfirmada,
        nombreComprobante: itemComprobanteSelect?.tipo_comprobantes?.nombre,
        nombrecajero: datausuarios?.nombres,
        dataCliente: cliproItemSelect,
        metodosPago: nuevosMetodosPago,
      };
      dataImpresorasPorCaja?.state
        ? imprimirDirectoTicket(pPrint)
        : imprimirConVentanaEmergente(pPrint);
    } else {
      toast.warning("Falta completar el pago, el restante tiene que ser 0");
    }
  }
  const imprimirConVentanaEmergente = async (p) => {
    console.log("pprint", p);
    await ticket("print", p);
  };
  const imprimirDirectoTicket = async (p) => {
    const printServiceUrl = getPrintServiceUrl();
    if (!printServiceUrl) {
      toast.info("En macOS se abrirá el diálogo de impresión del sistema.");
      return imprimirConVentanaEmergente(p);
    }
    if (dataImpresorasPorCaja?.name === "-") {
      return toast.error(
        "Impresora no reconocida, configura tu impresora desde modulo de configuración"
      );
    }
    const response = await ticket("b64", p);
    // Convertir el contenido base64 en un archivo Blob
    const binaryString = atob(response.content);
    const binaryLen = binaryString.length;
    const bytes = new Uint8Array(binaryLen);
    for (let i = 0; i < binaryLen; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: "application/pdf" });
    // Crear un archivo simulando un archivo subido
    const file = new File([blob], "GeneratedTicket.pdf", {
      type: "application/pdf",
    });
    const formData = new FormData();
    formData.append("file", file);
    formData.append("printerName", dataImpresorasPorCaja?.name);
    const responseApi = await fetch(`${printServiceUrl}/api/print-ticket`, {
      method: "POST",
      body: formData,
    });
    if (responseApi.ok) {
      toast.success("El PDF se envió a imprimir correctamente.");

    }else{
      const error = await responseApi.text();
      toast.error("Error al imprimir" + error);
    }

  };
  const { setTipo: setTipocliente } = useClientesProveedoresStore();
  const { setStateClose, setAccion, stateClose, accion, setIsExploding } =
    useGlobalStore();
  function registrarNuevoCliente() {
    const tipo = "cliente";
    setTipocliente(tipo);
    setAccion("Nuevo");
    setStateClose(true);
  }
  //useEffect para recalcular cuando los valores cambian
  useEffect(() => {
    if (tipocobro !== "Mixto" && valoresPago[tipocobro] != total) {
      setValoresPago((prev) => ({
        ...prev,
        [tipocobro]: total,
      }));
    }
  }, [tipocobro, total]);
  useEffect(() => {
    calcularVueltoYRestante();
  }, [precioVenta, tipocobro, valoresPago]);
  return (
    <Container>
      {mutation.isPending ? (
        <span>guardando...🐖</span>
      ) : (
        <>
          <header className="receipt-header">
            <div className="brand">
              {dataempresa?.logo && dataempresa.logo !== "-" ? (
                <img src={dataempresa.logo} alt={`Logo de ${dataempresa?.nombre || "la empresa"}`} />
              ) : (
                <span className="brand-fallback">
                  {(dataempresa?.nombre || "AS").slice(0, 2).toUpperCase()}
                </span>
              )}
              <div>
                <strong>{dataempresa?.nombre || "Punto de venta"}</strong>
                <small>Nuevo comprobante</small>
              </div>
            </div>
            <span className="tipocobro">{tipocobro}</span>
          </header>
          <section className="area1">
            <section className="document-number">
              <small>Documento</small>
              <strong>
                {itemComprobanteSelect?.tipo_comprobantes?.nombre || "Comprobante"}{" "}
                {itemComprobanteSelect?.serie}-
                {itemComprobanteSelect?.correlativo}
              </strong>
            </section>

            <section className="areacomprobantes">
              {dataComprobantes?.map((item, index) => {
                return (
                  <article
                    className={`box ${
                      item?.id === itemComprobanteSelect?.id ? "active" : ""
                    }`}
                    key={item?.id || index}
                  >
                    <Btn1
                      titulo={item?.tipo_comprobantes?.nombre}
                      border="0"
                      height="70px"
                      width="100%"
                      funcion={() => setItemComprobanteSelect(item)}
                    />
                  </article>
                );
              })}
            </section>
            <section className="client-row">
              <div>
                <small>Cliente</small>
                <strong className="cliente">
                  {cliproItemSelect?.nombres || "Cliente genérico"}
                </strong>
              </div>
              <EditButton
                type="button"
                aria-label="Seleccionar o editar cliente"
                onClick={() => setStateBuscadorClientes(!stateBuscadorClientes)}
              >
                <Icon className="icono" icon="lets-icons:edit-fill" />
              </EditButton>
            </section>
          </section>
          <Linea />
          <section className="area2">
            {dataMetodosPago?.map((item, index) => {
              return (tipocobro === "Mixto" && item.nombre !== "Mixto") ||
                (tipocobro === item.nombre && item.nombre !== "Mixto") ? (
                <InputText textalign="center" key={index}>
                  <input
                    onChange={(e) =>
                      handleChangePago(item.nombre, e.target.value)
                    }
                    defaultValue={tipocobro === item.nombre ? total : ""}
                    className="form__field"
                    type="number"
                    disabled={
                      tipocobro === "Mixto" || tipocobro === "Efectivo"
                        ? false
                        : true
                    }
                  />
                  <label className="form__label">{item.nombre} </label>
                </InputText>
              ) : null;
            })}
          </section>
          <Linea />
          <section className="area3">
            <article className="etiquetas">
              <span className="total">Total: </span>
              <span>Vuelto: </span>
              <span>Restante: </span>
            </article>
            <article>
              <span className="total">
                {FormatearNumeroDinero(
                  total,
                  dataempresa?.currency,
                  dataempresa?.iso
                )}
              </span>
              <span>
                {FormatearNumeroDinero(
                  vuelto,
                  dataempresa?.currency,
                  dataempresa?.iso
                )}
              </span>
              <span>
                {FormatearNumeroDinero(
                  restante,
                  dataempresa?.currency,
                  dataempresa?.iso
                )}
              </span>
            </article>
          </section>
          <Linea />
          <section className="area4">
            <Btn1
              funcion={() => mutation.mutate()}
              border="2px"
              titulo="COBRAR (enter)"
              bgcolor="#0aca21"
              color="#ffffff"
              width="100%"
            />
          </section>
          {stateBuscadorClientes && (
            <PanelBuscador
              funcion={registrarNuevoCliente}
              selector={selectCliPro}
              setBuscador={setBuscador}
              displayField="nombres"
              data={dataBuscadorcliente}
              setStateBuscador={() =>
                setStateBuscadorClientes(!stateBuscadorClientes)
              }
            />
          )}
          {stateClose && (
            <RegistrarClientesProveedores
              setIsExploding={setIsExploding}
              accion={accion}
              onClose={() => setStateClose(false)}
            />
          )}
        </>
      )}
    </Container>
  );
});
IngresoCobro.displayName = "IngresoCobro";
const Container = styled.div`
  position: relative;
  box-sizing: border-box;
  width: min(520px, calc(100vw - 28px));
  max-height: calc(100dvh - 150px);
  overflow-y: auto;
  padding: clamp(18px, 4vw, 28px);
  border: 1px solid #e2e8f0;
  border-radius: 22px;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.13);
  gap: 16px;
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
  color: #000;
  align-items: stretch;
  justify-content: flex-start;
  font-size: clamp(16px, 3vw, 20px);

  .receipt-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding-bottom: 15px;
    border-bottom: 1px solid #e2e8f0;

    .brand {
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 12px;

      img,
      .brand-fallback {
        width: 50px;
        height: 50px;
        flex: 0 0 50px;
        border-radius: 14px;
        object-fit: contain;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
      }

      .brand-fallback {
        display: grid;
        place-items: center;
        color: #0f172a;
        font-weight: 900;
      }

      div {
        min-width: 0;
        display: flex;
        flex-direction: column;
      }

      strong {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      small {
        color: #64748b;
      }
    }
  }

  .tipocobro {
    flex: 0 0 auto;
    background: #fce7f3;
    padding: 7px 10px;
    color: #be185d;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 800;
  }

  input {
    color: #000 !important;
    font-weight: 700;
  }
  &:before,
  &:after {
    content: "";
    position: absolute;
    left: 5px;
    height: 6px;
    width: calc(100% - 10px);
  }
  &:before {
    top: -5px;
    background: radial-gradient(
        circle,
        transparent,
        transparent 50%,
        #fbfbfb 50%,
        #fbfbfb 100%
      ) -7px -8px / 16px 16px repeat-x;
  }
  &:after {
    bottom: -5px;
    background: radial-gradient(
        circle,
        transparent,
        transparent 50%,
        #fbfbfb 50%,
        #fbfbfb 100%
      ) -7px -2px / 16px 16px repeat-x;
  }
  .area1 {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 12px;

    .document-number {
      display: flex;
      flex-direction: column;
      text-align: center;

      small {
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 11px;
        font-weight: 750;
      }

      strong {
        font-size: clamp(20px, 4vw, 26px);
      }
    }

    .areacomprobantes {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      padding: 10px;
      .box {
        flex: 1 1 40%;
        display: flex;
        gap: 10px;

        &.active button {
          outline: 3px solid rgba(14, 165, 233, 0.25);
          background: #e0f2fe;
          color: #075985;
        }
      }
    }

    .client-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 12px 14px;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      background: #f8fafc;

      > div {
        display: flex;
        flex-direction: column;
      }

      small {
        color: #64748b;
        font-size: 12px;
      }

      .cliente {
        font-weight: 750;
      }
    }
  }
  .area2 {
    display: flex;
    flex-direction: column;
    gap: 12px;

    input {
      font-size: clamp(30px, 8vw, 42px);
    }
  }
  .area3 {
    display: flex;
    justify-content: space-between;
    width: 100%;

    article {
      display: flex;
      flex-direction: column;
    }
    .total {
      font-weight: 700;
    }
    .etiquetas {
      text-align: end;
    }
  }

  .area4 {
    display: flex;
    width: 100%;
  }

  @media (max-height: 760px) {
    max-height: calc(100dvh - 120px);
  }
`;

const Linea = styled.span`
  width: 100%;
  border-bottom: dashed 1px #d4d4d4;
`;
const EditButton = styled.button`
  background-color: #62c6f7;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  width: 30px;
  height: 30px;
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 0 0 36px;
  width: 36px;
  height: 36px;
  margin: 0;
  .icono {
    font-size: 20px;
  }
`;
