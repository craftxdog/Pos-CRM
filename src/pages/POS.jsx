import { POSTemplate, SpinnerSecundario } from "../index";

import { PantallaAperturaCaja } from "../components/organismos/POSDesign/CajaDesign/PantallaAperturaCaja";

import { useMostrarAperturasCajaPorUsuarioQuery } from "../tanstack/CierresCajaStack";
import { useMostrarMetodosPagoQuery } from "../tanstack/MetodosPagoStack";

export function POS() {
  const {
    isLoading: isLoadingMetodosPago,
    error: errorMetodosPago,
  } = useMostrarMetodosPagoQuery()
  const {data:dataCierreCaja, isLoading, error } = useMostrarAperturasCajaPorUsuarioQuery();
  // Mostrar spinner mientras alguna de las consultas está cargando
  if (isLoading || isLoadingMetodosPago) {
    return <SpinnerSecundario texto="Verificando aperturas de caja" />;
  }
  // Manejar errores de la consulta de cierre de caja
  if (error || errorMetodosPago) {
    const message = error?.message || errorMetodosPago?.message;
    return (
      <main style={{ padding: "48px", maxWidth: "720px", margin: "0 auto" }}>
        <h2>No se pudo preparar la caja</h2>
        <p>{message}</p>
        <button type="button" onClick={() => window.location.reload()}>
          Reintentar
        </button>
      </main>
    );
  }

  return dataCierreCaja ? <POSTemplate /> : <PantallaAperturaCaja />;
}
