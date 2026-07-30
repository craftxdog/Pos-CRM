import styled from "styled-components";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Icon } from "@iconify/react/dist/iconify.js";
import { useEmpresaStore } from "../../../store/EmpresaStore";
import { FormatearNumeroDinero } from "../../../utils/Conversiones";
import {
  useMostrarVentasDashboardPeriodoAnteriorQuery,
  useMostrarVentasDashboardQuery,
  useMostrarCantidadDetalleVentaDashboardQuery,
  useGananciasDetalleVentaQuery,
} from "../../../tanstack/ReportesStack";
import { useReportesStore } from "../../../store/ReportesStore";
import { useDashboardStore } from "../../../store/DashboardStore";

const formatShortDate = (value) => {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es", {
    day: "2-digit",
    month: "short",
  }).format(date);
};

export const ChartVentas = () => {
  const { data = [], isLoading } = useMostrarVentasDashboardQuery();
  useMostrarVentasDashboardPeriodoAnteriorQuery();
  useMostrarCantidadDetalleVentaDashboardQuery();
  useGananciasDetalleVentaQuery();

  const { totalventas, porcentajeCambio } = useReportesStore();
  const { activeRange } = useDashboardStore();
  const { dataempresa } = useEmpresaStore();
  const isPositive = porcentajeCambio > 0;
  const isNeutral = porcentajeCambio === 0;
  const canCompare = activeRange !== "all";

  return (
    <Container>
      <Header>
        <div>
          <Eyebrow>
            <Icon icon="solar:chart-2-bold-duotone" />
            Evolución de ventas
          </Eyebrow>
          <Title>Ingresos del período</Title>
        </div>
        <LiveBadge>
          <span />
          Datos actualizados
        </LiveBadge>
      </Header>

      <MainInfo>
        <Revenue>
          {FormatearNumeroDinero(
            totalventas || 0,
            dataempresa?.currency,
            dataempresa?.iso
          )}
        </Revenue>
        {canCompare ? (
          <Percentage $isPositive={isPositive} $isNeutral={isNeutral}>
            <Icon
              width="20"
              icon={
                isNeutral
                  ? "solar:minus-circle-bold"
                  : isPositive
                    ? "solar:arrow-up-bold"
                    : "solar:arrow-down-bold"
              }
            />
            {Math.abs(porcentajeCambio)}% frente al período anterior
          </Percentage>
        ) : (
          <ComparisonHint>Vista histórica sin comparación</ComparisonHint>
        )}
      </MainInfo>

      <ChartWrap>
        {isLoading ? (
          <EmptyState>Cargando tendencia…</EmptyState>
        ) : data.length ? (
          <ResponsiveContainer width="100%" height={270}>
            <AreaChart
              data={data}
              margin={{ top: 12, right: 18, left: 2, bottom: 0 }}
            >
              <defs>
                <linearGradient id="salesAccentGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.48} />
                  <stop offset="55%" stopColor="#6366f1" stopOpacity={0.16} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke="currentColor"
                strokeOpacity={0.1}
                strokeDasharray="4 6"
                vertical={false}
              />
              <XAxis
                dataKey="fecha"
                axisLine={false}
                tickLine={false}
                tickFormatter={formatShortDate}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                minTickGap={22}
              />
              <YAxis
                width={56}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickFormatter={(value) =>
                  new Intl.NumberFormat("es", {
                    notation: "compact",
                    maximumFractionDigits: 1,
                  }).format(value)
                }
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="total_ventas"
                stroke="#38bdf8"
                strokeWidth={3}
                fill="url(#salesAccentGradient)"
                activeDot={{ r: 6, fill: "#6366f1", stroke: "#fff", strokeWidth: 2 }}
                dot={data.length < 8 ? { r: 3, fill: "#38bdf8" } : false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState>
            <Icon icon="solar:chart-square-outline" width="34" />
            No hay ventas en este período
          </EmptyState>
        )}
      </ChartWrap>
    </Container>
  );
};

const CustomTooltip = ({ active, payload, label }) => {
  const { dataempresa } = useEmpresaStore();
  if (!active || !payload?.length) return null;
  return (
    <TooltipContainer>
      <span>{formatShortDate(label)}</span>
      <strong>
        {FormatearNumeroDinero(
          Number(payload[0].value || 0),
          dataempresa?.currency,
          dataempresa?.iso
        )}
      </strong>
    </TooltipContainer>
  );
};

const Container = styled.div`
  padding: clamp(18px, 2.5vw, 28px);
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
`;

const Eyebrow = styled.span`
  display: flex;
  align-items: center;
  gap: 6px;
  color: #38bdf8;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
`;

const Title = styled.h3`
  margin: 5px 0 0;
  color: ${({ theme }) => theme.text};
  font-size: 18px;
`;

const LiveBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 10px;
  border-radius: 999px;
  color: ${({ theme }) => theme.colorSubtitle};
  background: ${({ theme }) => theme.bg};
  font-size: 11px;
  font-weight: 700;

  span {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #22c55e;
    box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.13);
  }
`;

const MainInfo = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 10px 16px;
  margin: 22px 0 8px;
`;

const Revenue = styled.div`
  color: ${({ theme }) => theme.text};
  font-size: clamp(28px, 4vw, 38px);
  font-weight: 900;
  letter-spacing: -0.03em;
`;

const Percentage = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: ${({ $isNeutral, $isPositive }) =>
    $isNeutral ? "#64748b" : $isPositive ? "#16a34a" : "#e11d48"};
  font-size: 12px;
  font-weight: 800;
`;

const ComparisonHint = styled.span`
  color: ${({ theme }) => theme.colorSubtitle};
  font-size: 12px;
`;

const ChartWrap = styled.div`
  min-height: 270px;
`;

const EmptyState = styled.div`
  min-height: 270px;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 8px;
  color: ${({ theme }) => theme.colorSubtitle};
  font-size: 13px;
  font-weight: 700;
`;

const TooltipContainer = styled.div`
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid ${({ theme }) => theme.color2};
  border-radius: 12px;
  background: ${({ theme }) => theme.bg};
  box-shadow: ${({ theme }) => theme.boxshadow};

  span {
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 11px;
  }

  strong {
    color: ${({ theme }) => theme.text};
    font-size: 14px;
  }
`;
