"use client";
import {
  Document,
  Page,
  Text,
  View,
  PDFViewer,
  StyleSheet,
} from "@react-pdf/renderer";
import styled from "styled-components";
import { useQuery } from "@tanstack/react-query";
import { useReportStore } from "../../../store/ReportStore";
import { useSucursalesStore } from "../../../store/SucursalesStore";
import { useDashboardStore } from "../../../store/DashboardStore";

const ReportVentas = () => {
  const { reportVentasPorSucursal } = useReportStore();
  const { sucursalesItemSelect } = useSucursalesStore();
  const { fechaInicio, fechaFin } = useDashboardStore();

  const { data, isLoading, error } = useQuery({
    queryKey: [
      "report Ventas Por Sucursal",
      {
        sucursal_id: sucursalesItemSelect?.id,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
      },
    ],
    queryFn: () =>
      reportVentasPorSucursal({
        sucursal_id: sucursalesItemSelect?.id,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
      }),
    refetchOnWindowFocus: false,
  });

  if (isLoading) return <div>Cargando...</div>;
  if (error) return <span>Error {(error)?.message}</span>;

  // --------- helpers (JS puro) ----------
  const n = (v) =>
    new Intl.NumberFormat("es-PE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(v || 0));

  const d = (iso) => {
    if (!iso) return "-";
    const dt = new Date(iso);
    return `${dt.toLocaleDateString("es-PE")} ${dt
      .toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })
      .replace(".", "")}`;
  };

  const rows = Array.isArray(data) ? data : [];

  const totalVentas = rows.reduce((a, x) => a + (x.monto_total || 0), 0);
  const totalImpuestos = rows.reduce((a, x) => a + (x.total_impuestos || 0), 0);
  const totalProductos = rows.reduce(
    (a, x) => a + (x.cantidad_productos || 0),
    0
  );

  const generatedAt = new Date();

  // --------- styles ----------
  const C = {
    ink: "#0F172A",
    sub: "#475569",
    line: "#E2E8F0",
    soft: "#F8FAFC",
    brand: "#0EA5E9",
    head: "#F1F5F9",
  };

  const styles = StyleSheet.create({
    viewer: { width: "100%", height: "100%" },
    page: { padding: 28, fontFamily: "Helvetica", color: C.ink },
    headerWrap: { marginBottom: 14 },
    brandBar: {
      height: 6,
      backgroundColor: C.brand,
      borderRadius: 2,
      marginBottom: 10,
    },
    title: { fontSize: 16, fontFamily: "Helvetica-Bold" },
    subtitle: { marginTop: 2, fontSize: 10, color: C.sub },
    meta: {
      marginTop: 10,
      borderWidth: 1,
      borderColor: C.line,
      borderRadius: 6,
      padding: 8,
    },
    metaRow: { flexDirection: "row" },
    metaItem: { flex: 1 },
    metaItemPad: { marginRight: 10 },
    metaLabel: { fontSize: 8, color: C.sub, marginBottom: 2 },
    metaValue: { fontSize: 10 },

    kpis: { flexDirection: "row", marginTop: 10, marginBottom: 8 },
    kpi: {
      flex: 1,
      backgroundColor: C.soft,
      borderWidth: 1,
      borderColor: C.line,
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 10,
      marginRight: 8,
    },
    kpiLast: { marginRight: 0 },
    kpiLabel: { fontSize: 9, color: C.sub, marginBottom: 2 },
    kpiValue: { fontSize: 14, fontFamily: "Helvetica-Bold" },

    table: {
      width: "100%",
      borderWidth: 1,
      borderColor: C.line,
      borderRadius: 8,
      overflow: "hidden",
      marginTop: 8,
    },
    thead: {
      flexDirection: "row",
      backgroundColor: C.head,
      borderBottomWidth: 1,
      borderBottomColor: C.line,
    },
    th: {
      paddingVertical: 6,
      paddingHorizontal: 6,
      fontSize: 9,
      fontFamily: "Helvetica-Bold",
      borderRightWidth: 1,
      borderRightColor: C.line,
    },
    row: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: C.line,
      minHeight: 22,
      alignItems: "center",
    },
    zebra: { backgroundColor: "#FCFEFF" },
    td: {
      paddingVertical: 5,
      paddingHorizontal: 6,
      fontSize: 9,
      borderRightWidth: 1,
      borderRightColor: C.line,
    },
    right: { textAlign: "right" },
    center: { textAlign: "center" },

    totalRow: { flexDirection: "row", backgroundColor: C.head },
    totalText: { fontFamily: "Helvetica-Bold" },

    empty: { padding: 14, textAlign: "center", color: C.sub, fontSize: 10 },

    footerLeft: {
      position: "absolute",
      left: 28,
      bottom: 16,
      fontSize: 9,
      color: C.sub,
    },
    footerRight: {
      position: "absolute",
      right: 28,
      bottom: 16,
      fontSize: 9,
      color: C.sub,
      textAlign: "right",
    },
  });

  // proporciones por columna
  const COL = { id: 10, fecha: 16, total: 12, imp: 10, sub: 12, pago: 10, cant: 8, cajero: 12, estado: 10 };
  const cw = (p) => ({ flexBasis: `${p}%`, flexGrow: 0, flexShrink: 0 });

  return (
    <Container>
      <PDFViewer style={styles.viewer}>
        <Document title="Reporte de Ventas">
          <Page size="A4" orientation="portrait" style={styles.page}>
            {/* Header */}
            <View style={styles.headerWrap}>
              <View style={styles.brandBar} />
              <Text style={styles.title}>Reporte de Ventas</Text>
              <Text style={styles.subtitle}>
                Generado: {generatedAt.toLocaleString("es-PE", { hour12: false })}
              </Text>

              <View style={styles.meta}>
                <View style={styles.metaRow}>
                  <View style={[styles.metaItem, styles.metaItemPad]}>
                    <Text style={styles.metaLabel}>Sucursal</Text>
                    <Text style={styles.metaValue}>
                      {sucursalesItemSelect?.nombre || "Genérica"}
                    </Text>
                  </View>
                  <View style={[styles.metaItem, styles.metaItemPad]}>
                    <Text style={styles.metaLabel}>Desde</Text>
                    <Text style={styles.metaValue}>{d(fechaInicio)}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Hasta</Text>
                    <Text style={styles.metaValue}>{d(fechaFin)}</Text>
                  </View>
                </View>
              </View>

              {/* KPI cards */}
              <View style={styles.kpis}>
                <View style={styles.kpi}>
                  <Text style={styles.kpiLabel}>Monto total de ventas</Text>
                  <Text style={styles.kpiValue}>S/ {n(totalVentas)}</Text>
                </View>
                <View style={styles.kpi}>
                  <Text style={styles.kpiLabel}>Total impuestos</Text>
                  <Text style={styles.kpiValue}>S/ {n(totalImpuestos)}</Text>
                </View>
                <View style={[styles.kpi, styles.kpiLast]}>
                  <Text style={styles.kpiLabel}>Cantidad de productos</Text>
                  <Text style={styles.kpiValue}>{totalProductos}</Text>
                </View>
              </View>
            </View>

            {/* Tabla */}
            <View style={styles.table}>
              <View style={styles.thead}>
                <Text style={[styles.th, cw(COL.id)]}>ID VENTA</Text>
                <Text style={[styles.th, cw(COL.fecha)]}>FECHA</Text>
                <Text style={[styles.th, cw(COL.total), styles.right]}>MONTO TOTAL</Text>
                <Text style={[styles.th, cw(COL.imp), styles.right]}>IMPUESTOS</Text>
                <Text style={[styles.th, cw(COL.sub), styles.right]}>SUBTOTAL</Text>
                <Text style={[styles.th, cw(COL.pago)]}>PAGO CON</Text>
                <Text style={[styles.th, cw(COL.cant), styles.center]}>CANT.</Text>
                <Text style={[styles.th, cw(COL.cajero)]}>CAJERO</Text>
                <Text style={[styles.th, cw(COL.estado)]}>ESTADO</Text>
              </View>

              {rows.length === 0 ? (
                <Text style={styles.empty}>No hay ventas para el rango seleccionado.</Text>
              ) : (
                rows.map((r, i) => (
                  <View key={r.id_venta || i} style={[styles.row, i % 2 === 1 && styles.zebra]}>
                    <Text style={[styles.td, cw(COL.id)]}>{r.id_venta}</Text>
                    <Text style={[styles.td, cw(COL.fecha)]}>{d(r.fecha)}</Text>
                    <Text style={[styles.td, cw(COL.total), styles.right]}>{n(r.monto_total)}</Text>
                    <Text style={[styles.td, cw(COL.imp), styles.right]}>{n(r.total_impuestos)}</Text>
                    <Text style={[styles.td, cw(COL.sub), styles.right]}>{n(r.subtotal)}</Text>
                    <Text style={[styles.td, cw(COL.pago)]}>{r.pago_con}</Text>
                    <Text style={[styles.td, cw(COL.cant), styles.center]}>{r.cantidad_productos ?? 0}</Text>
                    <Text style={[styles.td, cw(COL.cajero)]}>{r.cajero}</Text>
                    <Text style={[styles.td, cw(COL.estado)]}>{r.estado}</Text>
                  </View>
                ))
              )}

              {rows.length > 0 && (
                <View style={styles.totalRow}>
                  <Text style={[styles.td, cw(COL.id), styles.totalText]}>TOTAL</Text>
                  <Text style={[styles.td, cw(COL.fecha)]}></Text>
                  <Text style={[styles.td, cw(COL.total), styles.right, styles.totalText]}>{n(totalVentas)}</Text>
                  <Text style={[styles.td, cw(COL.imp), styles.right, styles.totalText]}>{n(totalImpuestos)}</Text>
                  <Text style={[styles.td, cw(COL.sub)]}></Text>
                  <Text style={[styles.td, cw(COL.pago)]}></Text>
                  <Text style={[styles.td, cw(COL.cant), styles.center, styles.totalText]}>{totalProductos}</Text>
                  <Text style={[styles.td, cw(COL.cajero)]}></Text>
                  <Text style={[styles.td, cw(COL.estado)]}></Text>
                </View>
              )}
            </View>

            {/* Footer: dos Text fijos */}
            <Text style={styles.footerLeft} fixed>
              {`Generado: ${generatedAt.toLocaleString("es-PE", { hour12: false })}`}
            </Text>
            <Text
              style={styles.footerRight}
              fixed
              render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
            />
          </Page>
        </Document>
      </PDFViewer>
    </Container>
  );
};

const Container = styled.main`
  width: 100%;
  position: relative;
  height: 80vh;
  .pdfviewer {
    width: 100%;
    height: 100%;
  }
`;

export default ReportVentas;
