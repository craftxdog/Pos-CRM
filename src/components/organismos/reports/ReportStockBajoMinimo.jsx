"use client";
import {
  Document,
  Page,
  Text,
  View,
  PDFViewer,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import styled from "styled-components";
import { useQuery } from "@tanstack/react-query";
import { useReportStore } from "../../../store/ReportStore";
import { useAlmacenesStore } from "../../../store/AlmacenesStore";
import { useSucursalesStore } from "../../../store/SucursalesStore";

const ReportStockBajoMinimo = () => {
  const { reportStockBajoMinimo } = useReportStore();
  const { almacenSelectItem } = useAlmacenesStore();
  const { sucursalesItemSelect } = useSucursalesStore();

  const { data, isLoading, error } = useQuery({
    queryKey: [
      "report Stock Por Almacen Sucursal Bajo Minimo",
      {
        sucursal_id: sucursalesItemSelect?.id,
        almacen_id: almacenSelectItem?.id,
      },
    ],
    queryFn: () =>
      reportStockBajoMinimo({
        sucursal_id: sucursalesItemSelect?.id,
        almacen_id: almacenSelectItem?.id,
      }),
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return <div>Cargando...</div>;
  }
  if (error) {
    return <span>Error {error.message}</span>;
  }

  // Register the font
  Font.register({
    family: "Inconsolata",
    src: "http://fonts.gstatic.com/s/inconsolata/v15/7bMKuoy6Nh0ft0SHnIGMuaCWcynf_cDxXwCLxiixG1c.ttf",
  });

  const styles = StyleSheet.create({
    page: {
      flexDirection: "row",
      position: "relative",
      padding: 20,
    },
    section: {
      margin: 10,
      padding: 10,
      flexGrow: 1,
    },
    table: {
      width: "100%",
      margin: "auto",
      marginTop: 10,
      borderTop: 1,
      borderRight: 1,
      borderColor: "#000",
    },
    row: {
      flexDirection: "row",
      borderBottom: 1,
      borderBottomColor: "#000",
      alignItems: "center",
      height: 24,
      borderLeftColor: "#000",
      borderLeft: 1,
      textAlign: "left",
      justifyContent: "flex-start",
    },
    cell: {
      flex: 1,
      textAlign: "center",
      fontFamily: "Inconsolata",
      fontSize: 9,
      padding: 3,
      borderRightColor: "#000",
      borderRight: 0,
    },
    headerCell: {
      flex: 1,

      fontWeight: "bold",
      fontFamily: "Inconsolata",
      textAlign: "center",
      fontSize: 9,
      padding: 3,
      borderRightColor: "#000",
      borderRight: 0,
    },
    reportInfo: {
      fontSize: 12,
      fontFamily: "Inconsolata",
      marginBottom: 5,
    },
    title: {
      fontSize: 18,
      fontWeight: "bold",
      textAlign: "left",
      marginBottom: 10,
      fontFamily: "Inconsolata",
    },
    subTitle: {
      fontSize: 12,
      fontFamily: "Inconsolata",
      marginBottom: 5,
      textAlign: "left",
    },
    totalRow: {
      fontWeight: "bold",
      textAlign: "right",
      fontSize: 12,
      marginTop: 10,
      fontFamily: "Inconsolata",
    },
    codeCell: {
      flex: 0.8,
      textAlign: "center",
      fontFamily: "Inconsolata",
      fontSize: 9,
      padding: 3,
    },
    descriptionCell: {
      flex: 2,
      textAlign: "left",
      fontFamily: "Inconsolata",
      fontSize: 9,
      padding: 3,
      paddingLeft: 5,
    },
    numberCell: {
      flex: 0.8,
      textAlign: "center",
      fontFamily: "Inconsolata",
      fontSize: 9,
      padding: 3,
      paddingRight: 5,
    },
    headerCodeCell: {
      flex: 0.8,

      fontWeight: "bold",
      fontFamily: "Inconsolata",
      textAlign: "center",
      fontSize: 9,
      padding: 3,
    },
    headerDescriptionCell: {
      flex: 2,
      fontWeight: "bold",
      fontFamily: "Inconsolata",
      textAlign: "center",
      fontSize: 9,
      padding: 3,
    },
    headerNumberCell: {
      flex: 0.8,

      fontWeight: "bold",
      fontFamily: "Inconsolata",
      textAlign: "center",
      fontSize: 9,
      padding: 3,
    },
    totalLabelCell: {
      flex: 2.8,
      textAlign: "right",
      fontFamily: "Inconsolata",
      fontWeight: "bold",
      fontSize: 9,
      padding: 3,
      paddingRight: 5,
    },
  });

  const renderTableHeader = () => (
    <View style={styles.row}>
      <Text style={styles.headerCodeCell}>CÓDIGO</Text>
      <Text style={styles.headerDescriptionCell}>PRODUCTO</Text>
      <Text style={styles.headerNumberCell}>STOCK</Text>
      <Text style={styles.headerNumberCell}>STOCK MINIMO</Text>
      <Text style={styles.headerNumberCell}>PRECIO COSTO</Text>
      <Text style={styles.headerNumberCell}>TOTAL</Text>
    </View>
  );

  const renderTableRow = (rowData) => (
    <View style={styles.row} key={rowData.codigo_articulo}>
      <Text style={styles.codeCell}>{rowData.codigo_articulo}</Text>
      <Text style={styles.descriptionCell}>{rowData.descripcion_articulo}</Text>
      <Text style={styles.numberCell}>
        {typeof rowData.stock === "number"
          ? rowData.stock.toFixed(2)
          : rowData.stock}
      </Text>
      <Text style={styles.numberCell}>
        {typeof rowData.stock === "number"
          ? rowData.stock_minimo.toFixed(2)
          : rowData.stock_minimo}
      </Text>
      <Text style={styles.numberCell}>
        {typeof rowData.precio_costo === "number"
          ? rowData.precio_costo.toFixed(2)
          : rowData.precio_costo}
      </Text>
      <Text style={styles.numberCell}>
        {typeof rowData.total === "number"
          ? rowData.total.toFixed(2)
          : rowData.total}
      </Text>
    </View>
  );

  // Calcular totales del inventario
  const totalStock =
    data?.reduce((acc, item) => acc + (item.stock || 0), 0) || 0;
  const totalValor =
    data?.reduce((acc, item) => acc + (item.total || 0), 0) || 0;

  const currentDate = new Date();
  const formattedDate = `${currentDate.toLocaleDateString()} ${currentDate.toLocaleTimeString()}`;

  // Sample data for preview (will be replaced by actual data in production)
  const sampleData = [
    {
      codigo_articulo: "0001",
      descripcion_articulo: "Servicio de Consultoría Técnica",
      stock: 11,
      precio_costo: null,
      total: null,
    },
   
  ];

  // Use sample data for preview if no data is available
  const displayData = data?.length > 0 ? data : sampleData;

  return (
    <Container className="main">
      {
        data?.length > 0 ? ( <PDFViewer className="pdfviewer">
          <Document title="Reporte de Inventario Valorizado">
            <Page size="A4" orientation="portrait">
              <View style={styles.page}>
                <View style={styles.section}>
                  {/* ENCABEZADO */}
                  <Text style={styles.title}>Reporte de stock bajo minimo</Text>
                  <Text style={styles.subTitle}>
                    Fecha y Hora del reporte: {formattedDate}
                  </Text>
                  <Text style={styles.subTitle}>
                    Sucursal: {sucursalesItemSelect?.nombre || "Genérica"}
                  </Text>
                  <Text style={styles.subTitle}>
                    Almacén: {almacenSelectItem?.nombre || "Almacén principal"}
                  </Text>
  
                  <View style={styles.table}>
                    {renderTableHeader()}
                    {displayData.map((item) => renderTableRow(item))}
  
                    {/* Total general */}
                    <View style={styles.row}>
                      <Text style={styles.totalLabelCell}>TOTAL</Text>
                      <Text style={styles.numberCell}>
                        {totalStock.toFixed(2)}
                      </Text>
                      <Text style={styles.numberCell}></Text>
                      <Text style={styles.numberCell}>
                        {totalValor.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </Page>
          </Document>
        </PDFViewer>):(<span>sin datos</span>)
      }
     
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

export default ReportStockBajoMinimo;
