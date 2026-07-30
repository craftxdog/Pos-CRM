import { NavLink, Outlet, useLocation } from "react-router-dom";
import styled from "styled-components";
import { Icon } from "@iconify/react/dist/iconify.js";
import { useMostrarSucursalesQuery } from "../tanstack/SucursalesStack";
import { useMostrarAlmacenesXSucursalSelectQuery } from "../tanstack/AlmacenesStack";
import { SelectList } from "../components/ui/lists/SelectList";
import { useSucursalesStore } from "../store/SucursalesStore";
import { useAlmacenesStore } from "../store/AlmacenesStore";
import { Device } from "../styles/breakpoints";
import { DateRangeFilter } from "../components/organismos/DashboardDesign/DateRangeFilter";

const REPORTS = [
  {
    id: 1,
    nombre: "Inventario valorado",
    descripcion: "Existencias y valor por almacén",
    icono: "solar:box-minimalistic-bold-duotone",
    to: "inventario_valorado",
  },
  {
    id: 2,
    nombre: "Productos con stock bajo",
    descripcion: "Reposición prioritaria",
    icono: "solar:danger-triangle-bold-duotone",
    to: "report_stock_bajo_minimo",
  },
  {
    id: 3,
    nombre: "Reporte de ventas",
    descripcion: "Ventas, impuestos y productos",
    icono: "solar:chart-2-bold-duotone",
    to: "report_ventas",
  },
];

export const Reportes = () => {
  const location = useLocation();
  const { data: dataSucursales } = useMostrarSucursalesQuery();
  const { data: dataAlmacenes } = useMostrarAlmacenesXSucursalSelectQuery();
  const { sucursalesItemSelect, selectSucursal } = useSucursalesStore();
  const { almacenSelectItem, setAlmacenSelectItem } = useAlmacenesStore();

  const selectedReport =
    REPORTS.find((report) => location.pathname.includes(report.to)) || REPORTS[0];
  const isSalesReport = selectedReport.to === "report_ventas";

  return (
    <Container>
      <aside className="sidebar">
        <div className="sidebar-title">
          <span>Centro de análisis</span>
          <h1>Reportes</h1>
        </div>
        <nav aria-label="Tipos de reporte">
          {REPORTS.map((report) => (
            <SidebarItem key={report.id} to={report.to}>
              <Icon icon={report.icono} width="24" />
              <span>
                <strong>{report.nombre}</strong>
                <small>{report.descripcion}</small>
              </span>
            </SidebarItem>
          ))}
        </nav>
      </aside>

      <section className="content">
        <header className="report-header">
          <div>
            <span className="eyebrow">Vista previa actualizada</span>
            <h2>{selectedReport.nombre}</h2>
            <p>{selectedReport.descripcion}</p>
          </div>
          <span className="ready-badge">
            <Icon icon="solar:document-add-bold-duotone" />
            Listo para exportar
          </span>
        </header>

        <section className="filters" aria-label="Filtros del reporte">
          <div className="select-filters">
            <div className="filter">
              <label>Sucursal</label>
              <SelectList
                data={dataSucursales}
                itemSelect={sucursalesItemSelect}
                onSelect={selectSucursal}
                displayField="nombre"
              />
            </div>
            {!isSalesReport && (
              <div className="filter">
                <label>Almacén</label>
                <SelectList
                  data={dataAlmacenes}
                  itemSelect={almacenSelectItem}
                  onSelect={setAlmacenSelectItem}
                  displayField="nombre"
                />
              </div>
            )}
          </div>
          {isSalesReport && <DateRangeFilter compact />}
        </section>

        <div className="viewer">
          <Outlet />
        </div>
      </section>
    </Container>
  );
};

const SidebarItem = styled(NavLink)`
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 72px;
  padding: 12px 14px;
  border: 1px solid transparent;
  border-radius: 14px;
  text-decoration: none;
  color: ${({ theme }) => theme.text};
  transition: 0.2s ease;

  span {
    display: grid;
    gap: 3px;
  }

  strong {
    font-size: 14px;
  }

  small {
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 11px;
  }

  &:hover {
    transform: translateX(2px);
    border-color: ${({ theme }) => theme.color2};
  }

  &.active {
    border-color: ${({ theme }) => theme.bg5};
    background: ${({ theme }) => theme.bg6};
    color: ${({ theme }) => theme.color1};
  }
`;

const Container = styled.main`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.body};

  .sidebar {
    width: 100%;
    padding: 18px 12px;
    border-right: 1px solid ${({ theme }) => theme.color2};
    background: ${({ theme }) => theme.bg};

    .sidebar-title {
      padding: 4px 10px 16px;

      span {
        color: ${({ theme }) => theme.color1};
        font-size: 11px;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.1em;
      }

      h1 {
        margin: 5px 0 0;
        font-size: 24px;
      }
    }

    nav {
      display: grid;
      gap: 6px;
    }
  }

  .content {
    flex: 1;
    min-width: 0;
    padding: clamp(16px, 2.5vw, 30px);
  }

  .report-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 16px;

    .eyebrow {
      color: ${({ theme }) => theme.color1};
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    h2 {
      margin: 4px 0;
      font-size: clamp(25px, 4vw, 38px);
    }

    p {
      margin: 0;
      color: ${({ theme }) => theme.colorSubtitle};
    }
  }

  .ready-badge {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 9px 12px;
    border-radius: 999px;
    color: #15803d;
    background: rgba(34, 197, 94, 0.12);
    font-size: 12px;
    font-weight: 800;
    white-space: nowrap;
  }

  .filters {
    display: grid;
    gap: 12px;
    margin-bottom: 16px;
    padding: 14px;
    border: 1px solid ${({ theme }) => theme.color2};
    border-radius: 18px;
    background: ${({ theme }) => theme.bg};
  }

  .select-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .filter {
    min-width: min(100%, 220px);

    label {
      display: block;
      margin: 0 0 6px;
      color: ${({ theme }) => theme.colorSubtitle};
      font-size: 11px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
  }

  .viewer {
    min-height: 400px;
    overflow: hidden;
    border-radius: 18px;
  }

  @media ${Device.tablet} {
    flex-direction: row;

    .sidebar {
      width: 270px;
      min-height: 100vh;
      position: sticky;
      top: 0;
      align-self: flex-start;
    }

    .filters {
      grid-template-columns: auto minmax(0, 1fr);
      align-items: start;
    }
  }

  @media (max-width: 640px) {
    .report-header {
      flex-direction: column;
    }

    .ready-badge {
      display: none;
    }
  }
`;
