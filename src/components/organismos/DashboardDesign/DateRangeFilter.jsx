import { DatePicker } from "antd";
import dayjs from "dayjs";
import styled from "styled-components";
import { Icon } from "@iconify/react/dist/iconify.js";
import { useDashboardStore } from "../../../store/DashboardStore";
import { isAllDateRange } from "../../../utils/dashboardDates";

const { RangePicker } = DatePicker;

const PRESETS = [
  { key: "today", label: "Hoy", range: () => [dayjs(), dayjs()] },
  {
    key: "yesterday",
    label: "Ayer",
    range: () => [dayjs().subtract(1, "day"), dayjs().subtract(1, "day")],
  },
  {
    key: "this-week",
    label: "Esta semana",
    range: () => [dayjs().startOf("week").add(1, "day"), dayjs()],
  },
  {
    key: "this-month",
    label: "Este mes",
    range: () => [dayjs().startOf("month"), dayjs()],
  },
  {
    key: "last-7",
    label: "Últimos 7 días",
    range: () => [dayjs().subtract(6, "day"), dayjs()],
  },
  {
    key: "last-30",
    label: "Últimos 30 días",
    range: () => [dayjs().subtract(29, "day"), dayjs()],
  },
  {
    key: "last-12-months",
    label: "Últimos 12 meses",
    range: () => [dayjs().subtract(11, "month").startOf("month"), dayjs()],
  },
];

const formatRangeLabel = (start, end) => {
  if (isAllDateRange(start, end)) return "Histórico completo";
  if (start === end) return dayjs(start).format("DD MMM YYYY");
  return `${dayjs(start).format("DD MMM YYYY")} – ${dayjs(end).format("DD MMM YYYY")}`;
};

export const DateRangeFilter = ({ compact = false }) => {
  const {
    activeRange,
    fechaInicio,
    fechaFin,
    setRangoFechas,
    limpiarFechas,
    mostrarTodasLasFechas,
  } = useDashboardStore();

  const applyRange = (key, range) => {
    const [start, end] = range();
    setRangoFechas(
      start.format("YYYY-MM-DD"),
      end.format("YYYY-MM-DD"),
      key
    );
  };

  const handleCustomRange = (value) => {
    if (!value?.[0] || !value?.[1]) return;
    setRangoFechas(
      value[0].format("YYYY-MM-DD"),
      value[1].format("YYYY-MM-DD"),
      "custom"
    );
  };

  const pickerValue =
    activeRange === "all"
      ? null
      : [dayjs(fechaInicio), dayjs(fechaFin)];

  return (
    <Container $compact={compact}>
      <FilterHeader>
        <span>
          <Icon icon="solar:calendar-date-bold-duotone" width="20" />
          Período
        </span>
        <strong>{formatRangeLabel(fechaInicio, fechaFin)}</strong>
      </FilterHeader>

      <ButtonGroup aria-label="Rangos rápidos">
        {PRESETS.map((preset) => (
          <TimeRangeButton
            key={preset.key}
            type="button"
            onClick={() => applyRange(preset.key, preset.range)}
            $isActive={activeRange === preset.key}
          >
            {preset.label}
          </TimeRangeButton>
        ))}
        <TimeRangeButton
          type="button"
          onClick={mostrarTodasLasFechas}
          $isActive={activeRange === "all"}
        >
          Todo
        </TimeRangeButton>
        <TimeRangeButton
          type="button"
          onClick={() => setRangoFechas(fechaInicio, fechaFin, "custom")}
          $isActive={activeRange === "custom"}
        >
          Personalizado
        </TimeRangeButton>
      </ButtonGroup>

      {activeRange === "custom" && (
        <StyledRangePicker
          allowClear={false}
          format="DD/MM/YYYY"
          value={pickerValue}
          onChange={handleCustomRange}
          disabledDate={(current) => current && current > dayjs().endOf("day")}
        />
      )}

      {activeRange !== "today" && (
        <ResetButton type="button" onClick={limpiarFechas}>
          <Icon icon="solar:restart-bold" />
          Volver a hoy
        </ResetButton>
      )}
    </Container>
  );
};

const Container = styled.div`
  display: grid;
  gap: ${({ $compact }) => ($compact ? "10px" : "14px")};
  padding: ${({ $compact }) => ($compact ? "12px" : "16px")};
  border: 1px solid ${({ theme }) => theme.color2};
  border-radius: 16px;
  background: ${({ theme }) => theme.bg};
`;

const FilterHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  span {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 13px;
    font-weight: 800;
    color: ${({ theme }) => theme.text};
  }

  strong {
    font-size: 12px;
    color: ${({ theme }) => theme.colorSubtitle};
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
`;

const TimeRangeButton = styled.button`
  appearance: none;
  border: 1px solid
    ${({ $isActive, theme }) => ($isActive ? theme.color1 : theme.color2)};
  border-radius: 999px;
  padding: 8px 12px;
  color: ${({ $isActive, theme }) => ($isActive ? "#fff" : theme.text)};
  background: ${({ $isActive, theme }) =>
    $isActive ? theme.color1 : "transparent"};
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.18s ease;

  &:hover {
    transform: translateY(-1px);
    border-color: ${({ theme }) => theme.color1};
  }
`;

const StyledRangePicker = styled(RangePicker)`
  width: min(100%, 430px);
  min-height: 42px;
  background: ${({ theme }) => theme.body};
  border-color: ${({ theme }) => theme.color2};

  .ant-picker-input > input,
  .ant-picker-suffix,
  .ant-picker-separator {
    color: ${({ theme }) => theme.text};
  }
`;

const ResetButton = styled.button`
  width: max-content;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 0;
  padding: 2px;
  background: transparent;
  color: ${({ theme }) => theme.color1};
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
`;
