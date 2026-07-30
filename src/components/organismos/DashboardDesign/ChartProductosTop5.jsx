import styled from "styled-components";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Icon } from "@iconify/react/dist/iconify.js";
import { useEmpresaStore } from "../../../store/EmpresaStore";
import { useDetalleVentasStore } from "../../../store/DetalleVentasStore";
import { useQuery } from "@tanstack/react-query";
import { BarLoader } from "../../ui/loaders/BarLoader";
import { useDashboardStore } from "../../../store/DashboardStore";

const COLORS = ["#38bdf8", "#6366f1", "#8b5cf6", "#f59e0b", "#22c55e"];

export const ChartProductosTop5 = () => {
  const { dataempresa } = useEmpresaStore();
  const { fechaInicio, fechaFin } = useDashboardStore();
  const { mostrartop5productosmasvendidosxcantidad } = useDetalleVentasStore();
  const { data = [], isLoading, error } = useQuery({
    queryKey: [
      "mostrar top5 productos mas vendidos xcantidad",
      {
        _id_empresa: dataempresa?.id,
        _fecha_inicio: fechaInicio,
        _fecha_fin: fechaFin,
      },
    ],
    queryFn: () =>
      mostrartop5productosmasvendidosxcantidad({
        _id_empresa: dataempresa?.id,
        _fecha_inicio: fechaInicio,
        _fecha_fin: fechaFin,
      }),
    enabled: Boolean(dataempresa?.id),
  });

  if (isLoading) return <LoadingWrap><BarLoader color="#38bdf8" /></LoadingWrap>;

  return (
    <Container>
      <Header>
        <span>
          <Icon icon="solar:cup-star-bold-duotone" width="22" />
          Ranking del período
        </span>
        <h3>Productos más vendidos</h3>
        <p>Participación por unidades</p>
      </Header>

      {error ? (
        <EmptyState $error>{error.message}</EmptyState>
      ) : data.length ? (
        <>
          <Ranking>
            {data.map((item, index) => (
              <li key={`${item.nombre_producto}-${index}`}>
                <Rank $color={COLORS[index % COLORS.length]}>{index + 1}</Rank>
                <span title={item.nombre_producto}>{item.nombre_producto}</span>
                <strong>{Number(item.total_vendido || 0)}</strong>
                <small>{Number(item.porcentaje || 0).toFixed(0)}%</small>
              </li>
            ))}
          </Ranking>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              layout="vertical"
              data={data}
              margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
              barCategoryGap="30%"
            >
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="nombre_producto" hide />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(148, 163, 184, 0.08)" }} />
              <Bar dataKey="total_vendido" radius={[0, 9, 9, 0]} minPointSize={5}>
                {data.map((item, index) => (
                  <Cell
                    key={`${item.nombre_producto}-bar`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </>
      ) : (
        <EmptyState>
          <Icon icon="solar:box-minimalistic-outline" width="36" />
          Aún no hay productos vendidos en este período.
        </EmptyState>
      )}
    </Container>
  );
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <TooltipContainer>
      <span>{item.nombre_producto}</span>
      <strong>{item.total_vendido} unidades</strong>
      <small>{Number(item.porcentaje || 0).toFixed(0)}% del total</small>
    </TooltipContainer>
  );
};

const Container = styled.div`
  padding: 22px;
`;

const LoadingWrap = styled.div`
  min-height: 420px;
  display: grid;
  place-items: center;
`;

const Header = styled.header`
  margin-bottom: 20px;

  span {
    display: flex;
    align-items: center;
    gap: 7px;
    color: #38bdf8;
    font-size: 11px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  h3 {
    margin: 7px 0 3px;
    color: ${({ theme }) => theme.text};
    font-size: 21px;
  }

  p {
    margin: 0;
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 13px;
  }
`;

const Ranking = styled.ol`
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr) auto 38px;
    align-items: center;
    gap: 8px;
    min-height: 38px;
    padding: 5px 8px;
    border-radius: 10px;
    background: ${({ theme }) => theme.bg};
  }

  li > span {
    overflow: hidden;
    color: ${({ theme }) => theme.text};
    font-size: 12px;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    color: ${({ theme }) => theme.text};
    font-size: 13px;
  }

  small {
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 11px;
    text-align: right;
  }
`;

const Rank = styled.b`
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  color: ${({ $color }) => $color};
  background: ${({ $color }) => `${$color}18`};
  font-size: 12px;
`;

const EmptyState = styled.div`
  min-height: 390px;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 10px;
  padding: 20px;
  color: ${({ $error, theme }) => ($error ? "#dc2626" : theme.colorSubtitle)};
  text-align: center;
  font-size: 13px;
  font-weight: 700;
`;

const TooltipContainer = styled.div`
  display: grid;
  gap: 3px;
  padding: 10px 12px;
  border: 1px solid ${({ theme }) => theme.color2};
  border-radius: 12px;
  background: ${({ theme }) => theme.bg};
  box-shadow: ${({ theme }) => theme.boxshadow};

  span,
  strong {
    color: ${({ theme }) => theme.text};
  }

  small {
    color: ${({ theme }) => theme.colorSubtitle};
  }
`;
