import { NavLink, Outlet, useLocation, useMatch } from "react-router-dom";
import styled from "styled-components";
import { useMostrarSucursalesQuery } from "../tanstack/SucursalesStack";
import {
  useMostrarAlmacenesXSucursalQuery,
  useMostrarAlmacenesXSucursalSelectQuery,
} from "../tanstack/AlmacenesStack";
import { SelectList } from "../components/ui/lists/SelectList";
import { useSucursalesStore } from "../store/SucursalesStore";
import { useAlmacenesStore } from "../store/AlmacenesStore";
import { useState } from "react";
import { Device } from "../styles/breakpoints";
import { DashboardHeader } from "../components/organismos/DashboardDesign/DashboardHeader";

export const Reportes = () => {
  const [reporteSeleccionado, setReporteSeleccionado] = useState(1);
  const { data: dataSucursales } = useMostrarSucursalesQuery();
  const { data: dataAlmacenes } = useMostrarAlmacenesXSucursalSelectQuery();
  const { sucursalesItemSelect, selectSucursal } = useSucursalesStore();
  const { almacenSelectItem, setAlmacenSelectItem } = useAlmacenesStore();

  const tiposReporte = [
    {
      id: 1,
      nombre: "Inventario valorado",
      icono: "mdi:file-document-outline",
      to: "inventario_valorado",
    },
    {
      id: 2,
      nombre: "Productos con Stock Bajo",
      icono: "mdi:file-alert-outline",

      to: "report_stock_bajo_minimo",
    },
    {
      id: 3,
      nombre: "Reporte de Ventas",
      icono: "mdi:file-chart-outline",

      to: "report_ventas",
    },
  ];
    // ✅ ¿Estamos en /reportes/report_ventas ?
 const location = useLocation();
  const isReportVentas = location.pathname.includes("report_ventas");  return (
    <Container>
      <section className="barra-lateral">
        <div className="titulo-barra">
          <h1>Reportes</h1>
        </div>
        <nav className="navegacion">
          {tiposReporte.map((reporte, index) => (
            <SidebarItem
              key={index}
              to={reporte.to}
              className={reporteSeleccionado === reporte.id ? "activo" : ""}
            >
              <span>{reporte.nombre} </span>
            </SidebarItem>
          ))}
        </nav>
      </section>
      <section className="contenido-principal">
        <div className="barra-superior">
          <div className="contenedor-barra-superior">
            <h2>{reporteSeleccionado?.nombre}</h2>
          </div>
          <div className="panel-filtros">
            <div className="grid-filtros">
              <div className="contentFiltros">
                <div className="filtro">
                  <label>Sucursal</label>
                  <SelectList
                    data={dataSucursales}
                    itemSelect={sucursalesItemSelect}
                    onSelect={selectSucursal}
                    displayField="nombre"
                  />
                </div>
                <div className="filtro">
                  <label>Almacen</label>
                  <SelectList
                    data={dataAlmacenes}
                    itemSelect={almacenSelectItem}
                    onSelect={setAlmacenSelectItem}
                    displayField="nombre"
                  />
                </div>
              </div>
               {isReportVentas && <DashboardHeader />}
            </div>
          </div>
        </div>

        <div>
          <Outlet />
        </div>
      </section>
    </Container>
  );
};
const SidebarItem = styled(NavLink)`
display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: 12px;
  cursor: pointer;
  margin: 5px 0;
  transition: all 0.3s ease-in-out;
  padding: 0 5%;
  position: relative;
  text-decoration: none;
  color: ${(props) => props.theme.text};
  height: 60px;

  &:hover {
    color: ${(props) => props.theme.colorSubtitle};
  }
  &.active {
    background: ${(props) => props.theme.bg6};
    border: 2px solid ${(props) => props.theme.bg5};
    color: ${(props) => props.theme.color1};
    font-weight: 600;
  }
`;
const Container = styled.main`
 display: flex;
  height: 100vh;
    display:flex;
    flex-direction:column;
      @media ${Device.tablet} {
       flex-direction:row;
      }
  .barra-lateral {
    width: 100%;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
    border-right: 1px solid ${({ theme }) => theme.color2};
     @media ${Device.tablet} {
         width: 16rem;
      }
    .titulo-barra {
      padding: 1rem;

      h1 {
        font-size: 1.25rem;
        font-weight: bold;
      }
    }

    .navegacion {
      padding: 0.5rem;
    
      button {
        display: flex;
        align-items: center;
        width: 100%;
        padding: 0.75rem;
        border-radius: 0.5rem;
        text-align: left;
        margin-bottom: 0.25rem;
        transition: background-color 0.2s;
        background-color: ${(props) => props.theme.bgtotal};
        color: ${(props) => props.theme.text};
        border: none;
        &:hover {
          background-color: #f3f4f6;
          color: #202020;
        }

        &.activo {
          background-color: #ffffff;
          color: #202020;
          font-weight: 700;
        }

        span {
          margin-left: 0.75rem;
        }
      }
    }
  }

  .contenido-principal {
    flex: 1;
    display: flex;
    flex-direction: column;

    .barra-superior {
      background-color: ${({ theme }) => theme.body};
      padding: 1rem;
      box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);

      .contenedor-barra-superior {
        display: flex;
        justify-content: space-between;
        align-items: center;

        h2 {
          font-size: 1.25rem;
          font-weight: 600;
        }

       
      }
    }

    .panel-filtros {
      margin-top: 1rem;
      padding: 1rem;
      background-color: ${({ theme }) => theme.bg};
      border-radius: 0.5rem;

      .grid-filtros {
        display: flex;
        grid-template-columns: repeat(1, minmax(0, 1fr));
        gap: 1rem;
        flex-direction: column;
        .contentFiltros {
          display: flex;
          gap: 8px;
        }
        @media (min-width: 768px) {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        @media (min-width: 1024px) {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

       
      }

    
    }

    .visor-pdf {
      flex: 1;
      padding: 1rem;
      overflow: hidden;

      .contenedor-pdf {
        background-color: white;
        border-radius: 0.5rem;
        box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1),
          0 1px 2px 0 rgba(0, 0, 0, 0.06);
        padding: 1rem;
        min-height: 100%;
        display: flex;
        flex-direction: column;

        .controles-pdf {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;

          .navegacion-pdf {
            display: flex;
            align-items: center;

            button {
              padding: 0.25rem 0.75rem;
              border: 1px solid #d1d5db;
              border-radius: 0.375rem;
              margin-right: 0.5rem;
              font-size: 0.875rem;

              &:disabled {
                opacity: 0.5;
                cursor: not-allowed;
              }
            }

            span {
              font-size: 0.875rem;
            }
          }

          select {
            padding: 0.25rem 0.75rem;
            border: 1px solid #d1d5db;
            border-radius: 0.375rem;
            font-size: 0.875rem;
          }
        }

        .documento-pdf {
          flex: 1;
          display: flex;
          justify-content: center;
          overflow: auto;

          .pagina-pdf {
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1),
              0 2px 4px -1px rgba(0, 0, 0, 0.06);
          }
        }

        .mensaje-sin-pdf {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #6b7280;

          .icono-archivo {
            font-size: 4rem;
            margin-bottom: 1rem;
          }

          h3 {
            font-size: 1.25rem;
            font-weight: 500;
            margin-bottom: 0.5rem;
          }

          p {
            font-size: 0.875rem;
            text-align: center;
            max-width: 28rem;
          }
        }
      }
    }
  }
`;
