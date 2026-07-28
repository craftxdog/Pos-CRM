import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FiEdit3,
  FiLayers,
  FiPlus,
  FiSearch,
  FiToggleLeft,
  FiToggleRight,
  FiX,
} from "react-icons/fi";
import styled from "styled-components";
import { toast } from "sonner";
import { v } from "../../../styles/variables";
import {
  CRM_PLAN_DAYS,
  filterCrmPlans,
  normalizeCrmPlanPayload,
} from "../../../utils/crmPlans";
import { ConfirmDialog } from "../../ui/feedback/ConfirmDialog";

function currency(value, code, locale) {
  try {
    return new Intl.NumberFormat(locale || "es-NI", {
      style: "currency",
      currency: code || "USD",
    }).format(Number(value || 0));
  } catch {
    return `${code || "USD"} ${Number(value || 0).toFixed(2)}`;
  }
}

function periodicityLabel(value) {
  const labels = {
    diario: "Diario",
    semanal: "Semanal",
    quincenal: "Quincenal",
    mensual: "Mensual",
    trimestral: "Trimestral",
    anual: "Anual",
  };
  return labels[value] || value;
}

export function CrmPlansTable({ crm, dataempresa }) {
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [periodicity, setPeriodicity] = useState("mensual");
  const [duration, setDuration] = useState(30);
  const [planToDisable, setPlanToDisable] = useState(null);
  const queryClient = useQueryClient();

  const plans = useMemo(
    () => filterCrmPlans(crm.planes, search),
    [crm.planes, search]
  );

  const subscriptionUsage = useMemo(() => {
    return (crm.suscripciones || []).reduce((usage, subscription) => {
      const id = Number(subscription.id_plan);
      usage[id] = (usage[id] || 0) + 1;
      return usage;
    }, {});
  }, [crm.suscripciones]);

  const refreshPlans = async () => {
    await queryClient.invalidateQueries({ queryKey: ["crm-data"] });
    await queryClient.invalidateQueries({ queryKey: ["crm-subscriptions"] });
  };

  const planMutation = useMutation({
    mutationFn: ({ values, editing }) => {
      const payload = normalizeCrmPlanPayload(values, dataempresa.id);
      return editing
        ? crm.editarPlan({ ...payload, id: editing.id })
        : crm.insertarPlan(payload);
    },
    onSuccess: async (_, variables) => {
      toast.success(variables.editing ? "Plan actualizado" : "Plan creado", {
        description: "El catálogo de planes ya está al día.",
      });
      setEditorOpen(false);
      setEditingPlan(null);
      await refreshPlans();
    },
    onError: (error) =>
      toast.error("No se pudo guardar el plan", {
        description: error.message,
      }),
  });

  const statusMutation = useMutation({
    mutationFn: (plan) =>
      crm.editarPlan({
        id: plan.id,
        id_empresa: dataempresa.id,
        activo: !plan.activo,
      }),
    onSuccess: async (_, plan) => {
      toast.success(plan.activo ? "Plan desactivado" : "Plan activado", {
        description: plan.activo
          ? "Ya no aparecerá al crear nuevas suscripciones."
          : "Vuelve a estar disponible para nuevas suscripciones.",
      });
      setPlanToDisable(null);
      await refreshPlans();
    },
    onError: (error) =>
      toast.error("No se pudo cambiar el estado", {
        description: error.message,
      }),
  });

  const openCreate = () => {
    setEditingPlan(null);
    setPeriodicity("mensual");
    setDuration(30);
    setEditorOpen(true);
  };

  const openEdit = (plan) => {
    setEditingPlan(plan);
    setPeriodicity(plan.periodicidad);
    setDuration(plan.duracion_dias);
    setEditorOpen(true);
  };

  const submitPlan = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    planMutation.mutate({
      editing: editingPlan,
      values: {
        nombre: form.get("nombre"),
        descripcion: form.get("descripcion"),
        precio: form.get("precio"),
        periodicidad: periodicity,
        duracion_dias: duration,
        activo: editingPlan?.activo ?? true,
      },
    });
  };

  return (
    <>
      <Container>
        <header className="plans-header">
          <div className="title-block">
            <span className="title-icon"><FiLayers /></span>
            <div>
              <span className="eyebrow">Catálogo comercial</span>
              <h3>Planes de suscripción</h3>
              <p>
                Define precios y vigencias sin afectar el historial de clientes.
              </p>
            </div>
          </div>
          <div className="plan-summary" aria-label="Resumen de planes">
            <span><strong>{crm.planes.filter((plan) => plan.activo).length}</strong> activos</span>
            <span><strong>{crm.planes.length}</strong> totales</span>
          </div>
        </header>

        <div className="plans-toolbar">
          <label className="plan-search">
            <FiSearch />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar plan, descripción o periodicidad"
              aria-label="Buscar planes"
            />
          </label>
          <button type="button" className="new-plan" onClick={openCreate}>
            <FiPlus /> Nuevo plan
          </button>
        </div>

        {editorOpen ? (
          <form
            className="plan-form"
            key={editingPlan?.id || "new-plan"}
            onSubmit={submitPlan}
          >
            <div className="form-heading">
              <div>
                <span>{editingPlan ? "Editar plan" : "Nuevo plan"}</span>
                <strong>
                  {editingPlan
                    ? `Actualiza ${editingPlan.nombre}`
                    : "Completa la información comercial"}
                </strong>
              </div>
              <button
                type="button"
                className="close-form"
                onClick={() => setEditorOpen(false)}
                aria-label="Cerrar formulario de plan"
              >
                <FiX />
              </button>
            </div>

            <label>
              Nombre
              <input
                name="nombre"
                defaultValue={editingPlan?.nombre || ""}
                placeholder="Ej. Plan Premium"
                required
              />
            </label>
            <label>
              Precio
              <input
                name="precio"
                type="number"
                min="0"
                step="0.01"
                defaultValue={editingPlan?.precio ?? ""}
                placeholder="0.00"
                required
              />
            </label>
            <label>
              Periodicidad
              <select
                value={periodicity}
                onChange={(event) => {
                  const value = event.target.value;
                  setPeriodicity(value);
                  setDuration(CRM_PLAN_DAYS[value]);
                }}
              >
                <option value="diario">Diario</option>
                <option value="semanal">Semanal</option>
                <option value="quincenal">Quincenal</option>
                <option value="mensual">Mensual</option>
                <option value="trimestral">Trimestral</option>
                <option value="anual">Anual</option>
              </select>
            </label>
            <label>
              Duración
              <div className="duration-input">
                <input
                  type="number"
                  min="1"
                  value={duration}
                  onChange={(event) => setDuration(Number(event.target.value))}
                  required
                />
                <span>días</span>
              </div>
            </label>
            <label className="description-field">
              Descripción
              <textarea
                name="descripcion"
                defaultValue={editingPlan?.descripcion || ""}
                placeholder="Resume lo que incluye este plan"
              />
            </label>
            <button
              type="submit"
              className="save-plan"
              disabled={planMutation.isPending}
            >
              {planMutation.isPending
                ? "Guardando…"
                : editingPlan
                  ? "Guardar cambios"
                  : "Crear plan"}
            </button>
          </form>
        ) : null}

        <div className="plans-table">
          <div className="plan-row plan-head">
            <span>Plan</span>
            <span>Precio</span>
            <span>Vigencia</span>
            <span>Uso</span>
            <span>Estado</span>
            <span>Acciones</span>
          </div>

          {plans.map((plan) => (
            <article className="plan-row" key={plan.id}>
              <span className="plan-name">
                <strong>{plan.nombre}</strong>
                <small>{plan.descripcion || "Sin descripción"}</small>
              </span>
              <span className="plan-price">
                <strong>
                  {currency(
                    plan.precio,
                    dataempresa?.currency,
                    dataempresa?.iso
                  )}
                </strong>
                <small>por ciclo</small>
              </span>
              <span>
                <strong>{plan.duracion_dias} días</strong>
                <small>{periodicityLabel(plan.periodicidad)}</small>
              </span>
              <span>
                <strong>{subscriptionUsage[Number(plan.id)] || 0}</strong>
                <small>suscripciones</small>
              </span>
              <span>
                <span className={`plan-status ${plan.activo ? "active" : "inactive"}`}>
                  {plan.activo ? "Disponible" : "Inactivo"}
                </span>
              </span>
              <span className="plan-actions">
                <button type="button" onClick={() => openEdit(plan)}>
                  <FiEdit3 /> Editar
                </button>
                <button
                  type="button"
                  className={plan.activo ? "deactivate" : "activate"}
                  onClick={() =>
                    plan.activo
                      ? setPlanToDisable(plan)
                      : statusMutation.mutate(plan)
                  }
                  disabled={statusMutation.isPending}
                >
                  {plan.activo ? <FiToggleRight /> : <FiToggleLeft />}
                  {plan.activo ? "Desactivar" : "Activar"}
                </button>
              </span>
            </article>
          ))}

          {!plans.length ? (
            <div className="plans-empty">
              <FiLayers />
              <strong>No encontramos planes</strong>
              <span>Cambia la búsqueda o crea un nuevo plan.</span>
            </div>
          ) : null}
        </div>
      </Container>

      <ConfirmDialog
        open={Boolean(planToDisable)}
        title={`¿Desactivar ${planToDisable?.nombre || "este plan"}?`}
        description="Las suscripciones existentes conservarán su plan y su historial. El plan dejará de estar disponible para nuevas asignaciones hasta que lo actives nuevamente."
        confirmLabel="Desactivar plan"
        pending={statusMutation.isPending}
        onCancel={() => setPlanToDisable(null)}
        onConfirm={() => statusMutation.mutate(planToDisable)}
      />
    </>
  );
}

const Container = styled.section`
  min-width: 0;
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.color2};
  border-radius: 18px;
  background: ${({ theme }) => theme.bgcards};
  color: ${({ theme }) => theme.text};
  padding: 20px;

  .plans-header,
  .plans-toolbar,
  .title-block,
  .plan-summary,
  .plan-actions {
    display: flex;
    align-items: center;
  }

  .plans-header {
    justify-content: space-between;
    gap: 18px;
  }

  .title-block {
    min-width: 0;
    gap: 12px;
  }

  .title-icon {
    width: 46px;
    height: 46px;
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    border-radius: 13px;
    background: rgba(243, 210, 12, 0.18);
    color: #8a7600;
    font-size: 20px;
  }

  .eyebrow {
    color: #8a7600;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h3,
  p {
    margin: 0;
  }

  h3 {
    margin-top: 2px;
    font-size: 21px;
  }

  p {
    margin-top: 3px;
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 12px;
  }

  .plan-summary {
    gap: 5px;

    span {
      border-radius: 10px;
      background: ${({ theme }) => theme.bgtotal};
      color: ${({ theme }) => theme.colorSubtitle};
      padding: 8px 10px;
      font-size: 11px;
    }

    strong {
      color: ${({ theme }) => theme.text};
    }
  }

  .plans-toolbar {
    justify-content: space-between;
    gap: 10px;
    margin: 18px 0 14px;
  }

  .plan-search {
    position: relative;
    width: min(520px, 100%);

    svg {
      position: absolute;
      top: 50%;
      left: 12px;
      transform: translateY(-50%);
      color: ${({ theme }) => theme.colorSubtitle};
    }

    input {
      width: 100%;
      min-height: 42px;
      border: 1px solid ${({ theme }) => theme.color2};
      border-radius: 11px;
      background: ${({ theme }) => theme.bgtotal};
      color: ${({ theme }) => theme.text};
      padding: 0 12px 0 36px;
      font: inherit;
    }
  }

  .new-plan,
  .save-plan {
    min-height: 42px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    border: 1px solid ${v.colorPrincipal};
    border-radius: 11px;
    background: ${v.colorPrincipal};
    color: #111827;
    padding: 0 15px;
    font-weight: 900;
    cursor: pointer;
  }

  .plan-form {
    display: grid;
    grid-template-columns: 1.2fr 0.72fr 0.72fr 0.65fr;
    gap: 11px;
    margin-bottom: 14px;
    border: 1px solid rgba(243, 210, 12, 0.5);
    border-radius: 14px;
    background: rgba(243, 210, 12, 0.07);
    padding: 14px;
  }

  .form-heading {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    justify-content: space-between;

    > div {
      display: grid;
      gap: 2px;
    }

    span {
      color: #8a7600;
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
  }

  .close-form {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border: 1px solid ${({ theme }) => theme.color2};
    border-radius: 10px;
    background: ${({ theme }) => theme.bgcards};
    color: ${({ theme }) => theme.text};
    cursor: pointer;
  }

  .plan-form label {
    display: grid;
    gap: 6px;
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 11px;
    font-weight: 800;
  }

  .plan-form input,
  .plan-form select,
  .plan-form textarea {
    width: 100%;
    min-width: 0;
    min-height: 42px;
    border: 1px solid ${({ theme }) => theme.color2};
    border-radius: 10px;
    background: ${({ theme }) => theme.bgcards};
    color: ${({ theme }) => theme.text};
    padding: 10px;
    font: inherit;
  }

  .description-field {
    grid-column: 1 / span 3;
  }

  .plan-form textarea {
    min-height: 72px;
    resize: vertical;
  }

  .duration-input {
    position: relative;

    input {
      padding-right: 42px;
    }

    span {
      position: absolute;
      top: 50%;
      right: 10px;
      transform: translateY(-50%);
      color: ${({ theme }) => theme.colorSubtitle};
      font-size: 11px;
    }
  }

  .save-plan {
    align-self: end;
    min-height: 72px;

    &:disabled {
      cursor: wait;
      opacity: 0.55;
    }
  }

  .plans-table {
    width: 100%;
    max-width: 100%;
    overflow-x: auto;
    border: 1px solid ${({ theme }) => theme.color2};
    border-radius: 14px;
  }

  .plan-row {
    min-width: 900px;
    display: grid;
    grid-template-columns:
      minmax(210px, 1.45fr)
      minmax(115px, 0.72fr)
      minmax(115px, 0.72fr)
      minmax(90px, 0.55fr)
      minmax(105px, 0.65fr)
      minmax(220px, 1.1fr);
    align-items: center;
    gap: 12px;
    border-bottom: 1px solid ${({ theme }) => theme.color2};
    padding: 13px 15px;

    &:last-child {
      border-bottom: 0;
    }

    > span {
      min-width: 0;
    }

    strong,
    small {
      display: block;
    }

    small {
      margin-top: 3px;
      overflow: hidden;
      color: ${({ theme }) => theme.colorSubtitle};
      font-size: 11px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .plan-head {
    min-height: 42px;
    background: ${({ theme }) => theme.bgtotal};
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .plan-price {
    font-variant-numeric: tabular-nums;
  }

  .plan-status {
    display: inline-flex;
    border: 1px solid transparent;
    border-radius: 999px;
    padding: 6px 9px;
    font-size: 10px;
    font-weight: 900;

    &.active {
      border-color: rgba(22, 163, 74, 0.24);
      background: rgba(22, 163, 74, 0.1);
      color: #15803d;
    }

    &.inactive {
      border-color: ${({ theme }) => theme.color2};
      background: ${({ theme }) => theme.bgtotal};
      color: ${({ theme }) => theme.colorSubtitle};
    }
  }

  .plan-actions {
    gap: 6px;

    button {
      min-height: 34px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid ${({ theme }) => theme.color2};
      border-radius: 9px;
      background: ${({ theme }) => theme.bgtotal};
      color: ${({ theme }) => theme.text};
      padding: 0 10px;
      font-size: 11px;
      font-weight: 850;
      cursor: pointer;
    }

    .activate {
      color: #15803d;
    }

    .deactivate {
      color: #b45309;
    }

    button:disabled {
      cursor: wait;
      opacity: 0.5;
    }
  }

  .plans-empty {
    min-height: 180px;
    display: grid;
    place-items: center;
    align-content: center;
    gap: 7px;
    color: ${({ theme }) => theme.colorSubtitle};
    text-align: center;

    svg {
      font-size: 25px;
    }

    strong {
      color: ${({ theme }) => theme.text};
    }
  }

  @media (max-width: 820px) {
    .plans-header,
    .plans-toolbar {
      align-items: stretch;
      flex-direction: column;
    }

    .plan-summary {
      align-self: flex-start;
    }

    .plan-form {
      grid-template-columns: 1fr 1fr;
    }

    .description-field {
      grid-column: 1 / -1;
    }

    .save-plan {
      min-height: 46px;
    }
  }

  @media (max-width: 560px) {
    padding: 15px;

    .plan-form {
      grid-template-columns: 1fr;
    }

    .description-field {
      grid-column: auto;
    }

    .new-plan {
      width: 100%;
    }
  }
`;
