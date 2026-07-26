import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiCreditCard,
  FiEdit3,
  FiPauseCircle,
  FiPlayCircle,
  FiRefreshCw,
  FiRotateCw,
  FiSearch,
  FiUserCheck,
  FiXCircle,
} from "react-icons/fi";
import styled from "styled-components";
import { toast } from "sonner";
import { v } from "../../../styles/variables";

const pageSizes = [10, 20, 50];

const statusCopy = {
  activa: {
    label: "Activa",
    detail: (item) => `Vence en ${item.dias_restantes} día(s)`,
  },
  por_vencer: {
    label: "Próxima a vencer",
    detail: (item) => `${item.dias_restantes} día(s) restantes`,
  },
  inactiva: {
    label: "Inactiva",
    detail: () => "Sin acceso vigente",
  },
  morosa: {
    label: "Cliente moroso",
    detail: (item) =>
      item.ultimo_pago_vencimiento
        ? `Cobro vencido el ${item.ultimo_pago_vencimiento}`
        : "Tiene un cobro vencido",
  },
};

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

function pageNumbers(page, totalPages) {
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index);
}

function SubscriptionStatus({ item }) {
  const status = statusCopy[item.estado_operativo] || {
    label: item.estado_operativo,
    detail: () => item.estado_registrado,
  };
  return (
    <span className={`membership-status ${item.estado_operativo}`}>
      <strong>{status.label}</strong>
      <small>{status.detail(item)}</small>
    </span>
  );
}

export function CrmSubscriptionsWorkspace({
  crm,
  dataempresa,
  mutation,
  submitForm,
  fillSubscriptionDefaults,
  updateSubscriptionEnd,
}) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("todos");
  const [planId, setPlanId] = useState("todos");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [leftMode, setLeftMode] = useState("asignar");
  const [selectedSubscription, setSelectedSubscription] = useState(null);
  const [newPlanId, setNewPlanId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const queryClient = useQueryClient();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [status, planId, pageSize]);

  const subscriptionsQuery = useQuery({
    queryKey: [
      "crm-subscriptions",
      dataempresa?.id,
      page,
      pageSize,
      debouncedSearch,
      status,
      planId,
    ],
    queryFn: () =>
      crm.mostrarSuscripcionesPage({
        id_empresa: dataempresa.id,
        page,
        pageSize,
        search: debouncedSearch,
        status,
        planId,
      }),
    enabled: !!dataempresa?.id,
    placeholderData: (previous) => previous,
    refetchOnWindowFocus: false,
  });

  const lifecycleMutation = useMutation({
    mutationFn: ({ id, accion, id_plan = null, fecha = null }) =>
      crm.gestionarSuscripcion({
        id,
        accion,
        id_plan,
        fecha,
      }),
    onSuccess: (_, variables) => {
      const messages = {
        cambiar_plan: "Plan actualizado y nueva vigencia aplicada",
        renovar: "Suscripción renovada",
        pausar: "Suscripción pausada",
        reactivar: "Suscripción reactivada",
        cancelar: "Suscripción cancelada",
      };
      toast.success(messages[variables.accion] || "Suscripción actualizada");
      if (variables.accion === "cambiar_plan") {
        setSelectedSubscription(null);
        setNewPlanId("");
      }
      queryClient.invalidateQueries({ queryKey: ["crm-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["crm-data"] });
    },
    onError: (error) => toast.error(error.message),
  });

  const result = subscriptionsQuery.data || {
    data: [],
    pagination: {
      page,
      pageSize,
      total: 0,
      totalPages: 1,
      from: 0,
      to: 0,
      hasPreviousPage: false,
      hasNextPage: false,
    },
  };
  const pages = useMemo(
    () => pageNumbers(result.pagination.page, result.pagination.totalPages),
    [result.pagination.page, result.pagination.totalPages]
  );

  return (
    <Container>
      <section className="subscription-intro">
        <div>
          <span className="eyebrow"><FiUserCheck /> Membresías y recurrencia</span>
          <h2>Suscripciones de clientes</h2>
          <p>
            Asigna un plan, controla vigencia y detecta renovaciones o morosidad desde una sola lista.
            Los clientes creados durante el cobro del POS aparecen automáticamente aquí.
          </p>
        </div>
        <div className="intro-stat">
          <strong>{result.pagination.total}</strong>
          <span>suscripciones con los filtros actuales</span>
        </div>
      </section>

      <section className="subscription-grid">
        <aside className="assignment-card">
          <div className="workspace-switcher" role="tablist">
            <button
              type="button"
              className={leftMode === "asignar" ? "active" : ""}
              onClick={() => setLeftMode("asignar")}
            >
              Asignar
            </button>
            <button
              type="button"
              className={leftMode === "plan" ? "active" : ""}
              onClick={() => setLeftMode("plan")}
            >
              Crear plan
            </button>
          </div>

          {leftMode === "asignar" ? (
            <>
            <header>
              <span><FiCreditCard /></span>
              <div>
                <h3>Asignar suscripción</h3>
                <p>Cliente + plan + vigencia.</p>
              </div>
            </header>
            <form onSubmit={submitForm("suscripcion")}>
            <label>
              Cliente
              <select name="id_cliente_crm" required defaultValue="">
                <option value="">Selecciona un cliente</option>
                {crm.clientes
                  .filter((client) => client.estado !== "inactivo")
                  .map((client) => (
                    <option key={client.id} value={client.id}>
                      {[client.nombres, client.apellidos].filter(Boolean).join(" ")}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Tipo de suscripción
              <select
                name="id_plan"
                required
                defaultValue=""
                onChange={fillSubscriptionDefaults}
              >
                <option value="">Selecciona un plan</option>
                {crm.planes
                  .filter((plan) => plan.activo)
                  .map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.nombre} · {plan.duracion_dias} días
                    </option>
                  ))}
              </select>
            </label>
            <div className="form-row">
              <label>
                Inicio
                <input
                  name="fecha_inicio"
                  type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  onChange={updateSubscriptionEnd}
                  required
                />
              </label>
              <label>
                Vencimiento
                <input name="fecha_fin" type="date" required />
              </label>
            </div>
            <label>
              Precio pactado
              <input
                name="precio_pactado"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                required
              />
            </label>
            <label className="checkline">
              <input name="auto_renovar" type="checkbox" />
              Renovación automática
            </label>
            <button
              disabled={
                mutation.isPending || !crm.clientes.length || !crm.planes.length
              }
            >
              {mutation.isPending ? "Asignando..." : "Asignar suscripción"}
            </button>
            </form>
            </>
          ) : (
            <>
              <header>
                <span><FiEdit3 /></span>
                <div>
                  <h3>Crear tipo de plan</h3>
                  <p>Precio, duración y descripción.</p>
                </div>
              </header>
              <form onSubmit={submitForm("plan")}>
                <label>
                  Nombre del plan
                  <input name="nombre" placeholder="Ej. Plan Premium" required />
                </label>
                <label>
                  Precio
                  <input
                    name="precio"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    required
                  />
                </label>
                <label>
                  Periodicidad
                  <select
                    name="periodicidad"
                    defaultValue="mensual"
                    onChange={(event) => {
                      const days = {
                        diario: 1,
                        semanal: 7,
                        quincenal: 15,
                        mensual: 30,
                        trimestral: 90,
                        anual: 365,
                      };
                      event.currentTarget.form.elements.namedItem(
                        "duracion_dias"
                      ).value = days[event.target.value];
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
                  Duración en días
                  <input
                    name="duracion_dias"
                    type="number"
                    min="1"
                    defaultValue="30"
                    required
                  />
                </label>
                <label>
                  Descripción
                  <textarea
                    name="descripcion"
                    placeholder="Qué incluye este plan"
                    required
                  />
                </label>
                <button disabled={mutation.isPending}>
                  {mutation.isPending ? "Creando..." : "Crear plan"}
                </button>
              </form>
              <div className="plans-mini-list">
                {crm.planes.slice(0, 5).map((plan) => (
                  <span key={plan.id}>
                    <strong>{plan.nombre}</strong>
                    <small>
                      {currency(
                        plan.precio,
                        dataempresa?.currency,
                        dataempresa?.iso
                      )}{" "}
                      · {plan.duracion_dias} días
                    </small>
                  </span>
                ))}
              </div>
            </>
          )}
        </aside>

        <section className="directory-card">
          <header className="directory-header">
            <div>
              <h3>Directorio de suscripciones</h3>
              <p>Busca por cliente, correo, teléfono, plan o descripción.</p>
            </div>
            <button
              type="button"
              className="refresh"
              onClick={() => subscriptionsQuery.refetch()}
              disabled={subscriptionsQuery.isFetching}
            >
              <FiRefreshCw className={subscriptionsQuery.isFetching ? "spin" : ""} />
              Actualizar
            </button>
          </header>

          <div className="filters">
            <label className="search">
              <FiSearch />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar cliente o plan..."
              />
            </label>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="todos">Todos los estados</option>
              <option value="activa">Activas</option>
              <option value="por_vencer">Próximas a vencer</option>
              <option value="inactiva">Inactivas</option>
              <option value="morosa">Clientes morosos</option>
            </select>
            <select value={planId} onChange={(event) => setPlanId(event.target.value)}>
              <option value="todos">Todos los planes</option>
              {crm.planes.map((plan) => (
                <option key={plan.id} value={plan.id}>{plan.nombre}</option>
              ))}
            </select>
            <select
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
              aria-label="Registros por página"
            >
              {pageSizes.map((size) => (
                <option key={size} value={size}>{size} por página</option>
              ))}
            </select>
          </div>

          {selectedSubscription ? (
            <section className="plan-editor">
              <div>
                <span>Cambiar plan</span>
                <strong>{selectedSubscription.cliente_nombre}</strong>
                <small>Plan actual: {selectedSubscription.plan_nombre}</small>
              </div>
              <select
                value={newPlanId}
                onChange={(event) => setNewPlanId(event.target.value)}
              >
                <option value="">Selecciona el nuevo plan</option>
                {crm.planes
                  .filter(
                    (plan) =>
                      plan.activo && plan.id !== selectedSubscription.id_plan
                  )
                  .map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.nombre} · {plan.duracion_dias} días
                    </option>
                  ))}
              </select>
              <input
                type="date"
                value={effectiveDate}
                onChange={(event) => setEffectiveDate(event.target.value)}
                aria-label="Fecha efectiva del cambio"
              />
              <button
                type="button"
                onClick={() =>
                  lifecycleMutation.mutate({
                    id: selectedSubscription.id,
                    accion: "cambiar_plan",
                    id_plan: newPlanId,
                    fecha: effectiveDate,
                  })
                }
                disabled={!newPlanId || lifecycleMutation.isPending}
              >
                Aplicar cambio
              </button>
              <button
                type="button"
                className="close-editor"
                onClick={() => setSelectedSubscription(null)}
                aria-label="Cerrar cambio de plan"
              >
                <FiXCircle />
              </button>
            </section>
          ) : null}

          {subscriptionsQuery.error ? (
            <p className="error">{subscriptionsQuery.error.message}</p>
          ) : null}

          <div className={`subscription-table ${subscriptionsQuery.isFetching ? "loading" : ""}`}>
            <div className="table-row table-head">
              <span>Cliente</span>
              <span>Plan</span>
              <span>Vigencia</span>
              <span>Precio</span>
              <span>Estado</span>
              <span>Acción</span>
            </div>
            {result.data.map((item) => (
              <article className="table-row" key={item.id}>
                <span className="client-cell">
                  <strong>{item.cliente_nombre}</strong>
                  <small>{item.cliente_email || item.cliente_telefono || "Sin contacto"}</small>
                </span>
                <span className="plan-cell">
                  <strong>{item.plan_nombre}</strong>
                  <small>{item.plan_duracion_dias} días · {item.plan_periodicidad}</small>
                </span>
                <span className="date-cell">
                  <strong>{item.fecha_fin}</strong>
                  <small>Desde {item.fecha_inicio}</small>
                </span>
                <span className="price-cell">
                  {currency(
                    item.precio_pactado,
                    dataempresa?.currency,
                    dataempresa?.iso
                  )}
                </span>
                <SubscriptionStatus item={item} />
                <span className="actions-cell">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSubscription(item);
                      setNewPlanId("");
                    }}
                    disabled={lifecycleMutation.isPending}
                    title="Cambiar plan"
                  >
                    <FiEdit3 /> Plan
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      lifecycleMutation.mutate({
                        id: item.id,
                        accion: "renovar",
                      })
                    }
                    disabled={lifecycleMutation.isPending}
                    title="Renovar suscripción"
                  >
                    <FiRotateCw /> Renovar
                  </button>
                  {item.estado_registrado === "pausada" ||
                  item.estado_registrado === "cancelada" ? (
                    <button
                      type="button"
                      onClick={() =>
                        lifecycleMutation.mutate({
                          id: item.id,
                          accion: "reactivar",
                        })
                      }
                      disabled={lifecycleMutation.isPending}
                      title="Reactivar suscripción"
                    >
                      <FiPlayCircle /> Reactivar
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        lifecycleMutation.mutate({
                          id: item.id,
                          accion: "pausar",
                        })
                      }
                      disabled={lifecycleMutation.isPending}
                      title="Pausar suscripción"
                    >
                      <FiPauseCircle /> Pausar
                    </button>
                  )}
                  {item.estado_registrado !== "cancelada" ? (
                    <button
                      type="button"
                      className="danger"
                      onClick={() => {
                        if (
                          window.confirm(
                            `¿Cancelar la suscripción de ${item.cliente_nombre}?`
                          )
                        ) {
                          lifecycleMutation.mutate({
                            id: item.id,
                            accion: "cancelar",
                          });
                        }
                      }}
                      disabled={lifecycleMutation.isPending}
                      title="Cancelar suscripción"
                    >
                      <FiXCircle /> Cancelar
                    </button>
                  ) : null}
                </span>
              </article>
            ))}
            {!subscriptionsQuery.isLoading && !result.data.length ? (
              <div className="empty">
                <FiClock />
                <strong>No hay suscripciones con estos filtros</strong>
                <span>Ajusta la búsqueda o asigna la primera suscripción.</span>
              </div>
            ) : null}
          </div>

          <footer className="pagination">
            <p>
              Mostrando <strong>{result.pagination.from}</strong>–<strong>{result.pagination.to}</strong>
              {" "}de <strong>{result.pagination.total}</strong>
            </p>
            <nav aria-label="Paginación de suscripciones">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={!result.pagination.hasPreviousPage}
                aria-label="Página anterior"
              >
                <FiChevronLeft />
              </button>
              {pages.map((number) => (
                <button
                  type="button"
                  key={number}
                  className={number === result.pagination.page ? "active" : ""}
                  onClick={() => setPage(number)}
                  aria-current={number === result.pagination.page ? "page" : undefined}
                >
                  {number}
                </button>
              ))}
              <button
                type="button"
                onClick={() =>
                  setPage((current) =>
                    Math.min(result.pagination.totalPages, current + 1)
                  )
                }
                disabled={!result.pagination.hasNextPage}
                aria-label="Página siguiente"
              >
                <FiChevronRight />
              </button>
            </nav>
          </footer>
        </section>
      </section>
    </Container>
  );
}

const Container = styled.section`
  width: min(1380px, 100%);
  margin: 0 auto;
  display: grid;
  gap: 16px;

  .subscription-intro,
  .assignment-card,
  .directory-card {
    border: 1px solid ${({ theme }) => theme.color2};
    background: ${({ theme }) => theme.bgcards};
    color: ${({ theme }) => theme.text};
  }

  .subscription-intro {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 24px;
    border-radius: 18px;
    padding: 22px;
    background:
      linear-gradient(120deg, rgba(243, 210, 12, 0.12), transparent 46%),
      ${({ theme }) => theme.bgcards};

    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      color: #8a7600;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    h2 {
      margin: 8px 0 6px;
      font-size: clamp(22px, 3vw, 32px);
    }

    p {
      max-width: 720px;
      margin: 0;
      color: ${({ theme }) => theme.colorSubtitle};
      line-height: 1.55;
    }
  }

  .intro-stat {
    min-width: 190px;
    display: grid;
    gap: 3px;
    border-radius: 14px;
    background: ${({ theme }) => theme.bgtotal};
    padding: 14px 16px;

    strong {
      font-size: 28px;
    }

    span {
      color: ${({ theme }) => theme.colorSubtitle};
      font-size: 12px;
    }
  }

  .subscription-grid {
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(260px, 330px) minmax(0, 1fr);
    gap: 16px;
    align-items: start;
  }

  .assignment-card,
  .directory-card {
    min-width: 0;
    border-radius: 18px;
    padding: 18px;
  }

  .assignment-card {
    position: sticky;
    top: 92px;

    .workspace-switcher {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
      margin-bottom: 16px;
      border-radius: 11px;
      background: ${({ theme }) => theme.bgtotal};
      padding: 4px;

      button {
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: ${({ theme }) => theme.colorSubtitle};
        padding: 9px 6px;
        font-weight: 900;
        cursor: pointer;

        &.active {
          background: ${({ theme }) => theme.bgcards};
          color: ${({ theme }) => theme.text};
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
        }
      }
    }

    > header {
      display: flex;
      gap: 11px;
      align-items: center;
      margin-bottom: 16px;

      > span {
        width: 42px;
        height: 42px;
        display: grid;
        place-items: center;
        border-radius: 12px;
        background: ${v.colorPrincipal};
        color: #111827;
      }

      h3,
      p {
        margin: 0;
      }

      p {
        margin-top: 3px;
        color: ${({ theme }) => theme.colorSubtitle};
        font-size: 12px;
      }
    }

    form,
    label {
      display: grid;
      gap: 7px;
    }

    form {
      gap: 12px;
    }

    label {
      color: ${({ theme }) => theme.colorSubtitle};
      font-size: 12px;
      font-weight: 700;
    }

    input,
    select,
    textarea {
      width: 100%;
      min-width: 0;
      border: 1px solid ${({ theme }) => theme.color2};
      border-radius: 10px;
      background: ${({ theme }) => theme.bgtotal};
      color: ${({ theme }) => theme.text};
      padding: 11px;
      font: inherit;
    }

    input,
    select {
      min-height: 42px;
    }

    textarea {
      min-height: 78px;
      resize: vertical;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 9px;
    }

    .checkline {
      display: flex;
      align-items: center;
      gap: 8px;

      input {
        width: 16px;
        min-height: 16px;
      }
    }

    form > button {
      min-height: 46px;
      border: 0;
      border-radius: 11px;
      background: ${v.colorPrincipal};
      color: #111827;
      font-weight: 900;
      cursor: pointer;

      &:disabled {
        cursor: wait;
        opacity: 0.55;
      }
    }

    .plans-mini-list {
      display: grid;
      gap: 6px;
      margin-top: 14px;

      > span {
        display: grid;
        gap: 2px;
        border-radius: 10px;
        background: ${({ theme }) => theme.bgtotal};
        padding: 9px 10px;
      }

      small {
        color: ${({ theme }) => theme.colorSubtitle};
        font-size: 11px;
      }
    }
  }

  .directory-header {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 16px;

    h3,
    p {
      margin: 0;
    }

    p {
      margin-top: 4px;
      color: ${({ theme }) => theme.colorSubtitle};
      font-size: 12px;
    }
  }

  .refresh,
  .actions-cell button,
  .pagination button {
    border: 1px solid ${({ theme }) => theme.color2};
    background: ${({ theme }) => theme.bgtotal};
    color: ${({ theme }) => theme.text};
    cursor: pointer;
  }

  .refresh {
    min-height: 36px;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    border-radius: 9px;
    padding: 0 11px;

    &:disabled {
      opacity: 0.5;
    }
  }

  .spin {
    animation: crm-spin 0.8s linear infinite;
  }

  @keyframes crm-spin {
    to { transform: rotate(360deg); }
  }

  .filters {
    display: grid;
    grid-template-columns: minmax(220px, 1fr) repeat(3, minmax(145px, auto));
    gap: 9px;
    margin: 18px 0 14px;

    input,
    select {
      min-width: 0;
      min-height: 40px;
      border: 1px solid ${({ theme }) => theme.color2};
      border-radius: 10px;
      background: ${({ theme }) => theme.bgtotal};
      color: ${({ theme }) => theme.text};
      padding: 0 10px;
    }

    .search {
      position: relative;

      svg {
        position: absolute;
        top: 50%;
        left: 11px;
        transform: translateY(-50%);
        color: ${({ theme }) => theme.colorSubtitle};
      }

      input {
        width: 100%;
        padding-left: 34px;
      }
    }
  }

  .subscription-table {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    overflow-x: auto;
    border: 1px solid ${({ theme }) => theme.color2};
    border-radius: 14px;
    transition: opacity 160ms ease;

    &.loading {
      opacity: 0.6;
    }
  }

  .table-row {
    min-width: 980px;
    display: grid;
    grid-template-columns:
      minmax(135px, 1.2fr)
      minmax(105px, 0.9fr)
      minmax(105px, 0.82fr)
      minmax(82px, 0.62fr)
      minmax(125px, 0.95fr)
      minmax(255px, 1.8fr);
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-bottom: 1px solid ${({ theme }) => theme.color2};

    &:last-child {
      border-bottom: 0;
    }

    > span {
      min-width: 0;
    }

    strong,
    small {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    small {
      margin-top: 3px;
      color: ${({ theme }) => theme.colorSubtitle};
      font-size: 11px;
    }
  }

  .table-head {
    min-height: 42px;
    background: ${({ theme }) => theme.bgtotal};
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .price-cell,
  .date-cell {
    font-variant-numeric: tabular-nums;
  }

  .membership-status {
    width: fit-content;
    max-width: 100%;
    display: grid;
    gap: 1px;
    border: 1px solid transparent;
    border-radius: 10px;
    padding: 6px 8px;

    strong {
      font-size: 11px;
    }

    small {
      margin: 0;
      color: inherit;
      opacity: 0.78;
    }

    &.activa {
      border-color: rgba(22, 163, 74, 0.24);
      background: rgba(22, 163, 74, 0.1);
      color: #15803d;
    }

    &.por_vencer {
      border-color: rgba(217, 119, 6, 0.25);
      background: rgba(217, 119, 6, 0.11);
      color: #b45309;
    }

    &.inactiva {
      border-color: ${({ theme }) => theme.color2};
      background: ${({ theme }) => theme.bgtotal};
      color: ${({ theme }) => theme.colorSubtitle};
    }

    &.morosa {
      border-color: rgba(220, 38, 38, 0.24);
      background: rgba(220, 38, 38, 0.1);
      color: #dc2626;
    }
  }

  .actions-cell button {
    min-height: 34px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: 8px;
    padding: 0 9px;
    font-size: 11px;
    font-weight: 800;

    &:hover {
      border-color: ${v.colorPrincipal};
    }
  }

  .actions-cell {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;

    button.danger {
      color: #dc2626;
    }
  }

  .plan-editor {
    display: grid;
    grid-template-columns: minmax(150px, 1fr) minmax(170px, 1fr) auto auto auto;
    align-items: center;
    gap: 8px;
    margin: 0 0 14px;
    border: 1px solid rgba(243, 210, 12, 0.55);
    border-radius: 12px;
    background: rgba(243, 210, 12, 0.08);
    padding: 10px;

    > div {
      display: grid;
      gap: 1px;

      span {
        color: #8a7600;
        font-size: 10px;
        font-weight: 900;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }

      small {
        color: ${({ theme }) => theme.colorSubtitle};
      }
    }

    select,
    input,
    button {
      min-width: 0;
      min-height: 38px;
      border: 1px solid ${({ theme }) => theme.color2};
      border-radius: 9px;
      background: ${({ theme }) => theme.bgcards};
      color: ${({ theme }) => theme.text};
      padding: 0 9px;
    }

    button {
      border-color: ${v.colorPrincipal};
      background: ${v.colorPrincipal};
      color: #111827;
      font-weight: 900;
      cursor: pointer;
    }

    .close-editor {
      width: 38px;
      display: grid;
      place-items: center;
      border-color: ${({ theme }) => theme.color2};
      background: transparent;
      color: ${({ theme }) => theme.text};
      padding: 0;
    }
  }

  .empty {
    min-height: 210px;
    display: grid;
    place-items: center;
    align-content: center;
    gap: 7px;
    color: ${({ theme }) => theme.colorSubtitle};
    text-align: center;

    svg {
      font-size: 24px;
    }

    strong {
      color: ${({ theme }) => theme.text};
    }
  }

  .error {
    border: 1px solid rgba(220, 38, 38, 0.22);
    border-radius: 10px;
    background: rgba(220, 38, 38, 0.08);
    color: #dc2626;
    padding: 10px 12px;
  }

  .pagination {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-top: 14px;

    p {
      margin: 0;
      color: ${({ theme }) => theme.colorSubtitle};
      font-size: 12px;
    }

    nav {
      display: flex;
      gap: 5px;
    }

    button {
      min-width: 34px;
      min-height: 34px;
      display: grid;
      place-items: center;
      border-radius: 8px;

      &.active {
        border-color: ${v.colorPrincipal};
        background: ${v.colorPrincipal};
        color: #111827;
        font-weight: 900;
      }

      &:disabled {
        cursor: not-allowed;
        opacity: 0.35;
      }
    }
  }

  @media (max-width: 1120px) {
    .subscription-grid {
      grid-template-columns: 1fr;
    }

    .assignment-card {
      position: static;
    }

    .assignment-card form {
      grid-template-columns: repeat(2, minmax(0, 1fr));

      > button,
      .checkline {
        grid-column: 1 / -1;
      }
    }
  }

  @media (max-width: 820px) {
    .subscription-intro,
    .directory-header,
    .pagination {
      align-items: stretch;
      flex-direction: column;
    }

    .intro-stat {
      min-width: 0;
    }

    .filters {
      grid-template-columns: 1fr 1fr;
    }

    .plan-editor {
      grid-template-columns: 1fr 1fr;

      > div {
        grid-column: 1 / -1;
      }
    }
  }

  @media (max-width: 560px) {
    .assignment-card form,
    .filters,
    .form-row {
      grid-template-columns: 1fr;
    }

    .assignment-card form > button,
    .assignment-card .checkline {
      grid-column: auto;
    }

    .pagination nav {
      overflow-x: auto;
    }

    .plan-editor {
      grid-template-columns: 1fr;

      > div {
        grid-column: auto;
      }
    }
  }
`;
