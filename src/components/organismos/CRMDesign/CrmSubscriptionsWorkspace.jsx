import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiCreditCard,
  FiEdit3,
  FiPauseCircle,
  FiPlayCircle,
  FiPrinter,
  FiRefreshCw,
  FiRotateCw,
  FiSearch,
  FiUserCheck,
  FiXCircle,
} from "react-icons/fi";
import styled from "styled-components";
import { toast } from "sonner";
import { v } from "../../../styles/variables";
import FacturaCliente from "../../../reports/FacturaCliente";
import { calculateSubscriptionEnd } from "../../../utils/crmSubscriptions";
import { ConfirmDialog } from "../../ui/feedback/ConfirmDialog";
import { CrmPlansTable } from "./CrmPlansTable";

const pageSizes = [5, 10, 20];

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

function normalizeLookup(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function clientName(client) {
  return [client?.nombres, client?.apellidos].filter(Boolean).join(" ").trim();
}

function ClientPicker({ clients }) {
  const inputId = useId();
  const listboxId = `${inputId}-options`;
  const rootRef = useRef(null);
  const searchInputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const availableClients = useMemo(
    () => (clients || []).filter((client) => client.estado !== "inactivo"),
    [clients]
  );
  const matches = useMemo(() => {
    const value = normalizeLookup(query);
    const list = value
      ? availableClients.filter((client) =>
          normalizeLookup(
            [
              clientName(client),
              client.codigo,
              client.email,
              client.telefono,
              client.identificador_nacional,
            ]
              .filter(Boolean)
              .join(" ")
          ).includes(value)
        )
      : availableClients;
    return list.slice(0, 8);
  }, [availableClients, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, []);

  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return undefined;
    const reset = () => {
      setSelected(null);
      setQuery("");
      setOpen(false);
      searchInputRef.current?.setCustomValidity("");
    };
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, []);

  const selectClient = (client) => {
    setSelected(client);
    setQuery(clientName(client));
    setOpen(false);
    searchInputRef.current?.setCustomValidity("");
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Enter"].includes(event.key)) return;
    if (!open) {
      setOpen(true);
      return;
    }
    if (!matches.length) return;
    event.preventDefault();
    if (event.key === "ArrowDown") {
      setActiveIndex((index) => (index + 1) % matches.length);
    } else if (event.key === "ArrowUp") {
      setActiveIndex((index) => (index - 1 + matches.length) % matches.length);
    } else {
      selectClient(matches[activeIndex] || matches[0]);
    }
  };

  return (
    <div className="client-picker-field">
      <label htmlFor={inputId}>Cliente</label>
      <div className={`client-picker ${open ? "open" : ""}`} ref={rootRef}>
        <input
          type="hidden"
          name="id_cliente_crm"
          value={selected?.id || ""}
          readOnly
        />
        <div className="client-picker-control">
          <FiSearch aria-hidden="true" />
          <input
            ref={searchInputRef}
            id={inputId}
            type="search"
            role="combobox"
            autoComplete="off"
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={open}
            aria-activedescendant={
              open && matches[activeIndex]
                ? `${listboxId}-${matches[activeIndex].id}`
                : undefined
            }
            placeholder="Busca por código, nombre, correo o teléfono"
            value={query}
            required
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(null);
              setOpen(true);
              event.target.setCustomValidity(
                event.target.value
                  ? "Selecciona un cliente de los resultados."
                  : ""
              );
            }}
            onInvalid={(event) => {
              if (event.currentTarget.value && !selected) {
                event.currentTarget.setCustomValidity(
                  "Selecciona un cliente de los resultados."
                );
              }
            }}
            onKeyDown={handleKeyDown}
          />
          {selected ? (
            <button
              type="button"
              className="clear-client"
              onClick={() => {
                setSelected(null);
                setQuery("");
                setOpen(true);
                searchInputRef.current?.setCustomValidity("");
              }}
              aria-label="Quitar cliente seleccionado"
            >
              <FiXCircle />
            </button>
          ) : null}
        </div>

        {open ? (
          <div className="client-options" id={listboxId} role="listbox">
            <div className="client-options-title">
              {query.trim() ? "Coincidencias" : "Clientes recientes"}
              <span>
                {matches.length} de {availableClients.length}
              </span>
            </div>
            {matches.map((client, index) => {
              const contact =
                [client.email, client.telefono].filter(Boolean).join(" · ") ||
                "Sin datos de contacto";
              return (
                <button
                  type="button"
                  role="option"
                  id={`${listboxId}-${client.id}`}
                  aria-selected={selected?.id === client.id}
                  className={index === activeIndex ? "active" : ""}
                  key={client.id}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectClient(client)}
                >
                  <span className="client-avatar" aria-hidden="true">
                    {clientName(client).charAt(0).toUpperCase() || "C"}
                  </span>
                  <span>
                    <strong>{clientName(client) || "Cliente sin nombre"}</strong>
                    <small>{[client.codigo, contact].filter(Boolean).join(" · ")}</small>
                  </span>
                  {selected?.id === client.id ? <FiCheck /> : null}
                </button>
              );
            })}
            {!matches.length ? (
              <p className="no-client-results">
                No encontramos clientes activos con esa búsqueda.
              </p>
            ) : null}
            {availableClients.length > matches.length ? (
              <small className="client-search-hint">
                Escribe más datos para acotar la búsqueda.
              </small>
            ) : null}
          </div>
        ) : null}
      </div>
      {selected ? (
        <small className="selected-client-copy">
          <FiCheck /> Cliente seleccionado
        </small>
      ) : null}
    </div>
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
  const [pageSize, setPageSize] = useState(5);
  const [selectedSubscription, setSelectedSubscription] = useState(null);
  const [newPlanId, setNewPlanId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [editedEndDate, setEditedEndDate] = useState("");
  const [renewalSubscription, setRenewalSubscription] = useState(null);
  const [renewalMethod, setRenewalMethod] = useState("efectivo");
  const [renewalReceived, setRenewalReceived] = useState("");
  const [subscriptionToCancel, setSubscriptionToCancel] = useState(null);
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
        cambiar_plan: {
          title: "Plan actualizado",
          description: "La nueva vigencia ya fue aplicada a la suscripción.",
        },
        pausar: {
          title: "Suscripción pausada",
          description: "El acceso quedó suspendido hasta que decidas reactivarlo.",
        },
        reactivar: {
          title: "Suscripción reactivada",
          description: "El cliente recuperó el acceso a su membresía.",
        },
        cancelar: {
          title: "Suscripción cancelada",
          description: "El historial se conserva y el acceso quedó deshabilitado.",
        },
      };
      const message = messages[variables.accion] || {
        title: "Suscripción actualizada",
        description: "Los cambios ya están disponibles.",
      };
      toast.success(message.title, { description: message.description });
      if (variables.accion === "cambiar_plan") {
        setSelectedSubscription(null);
        setNewPlanId("");
      }
      if (variables.accion === "cancelar") {
        setSubscriptionToCancel(null);
      }
      queryClient.invalidateQueries({ queryKey: ["crm-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["crm-data"] });
    },
    onError: (error) =>
      toast.error("No se pudo actualizar la suscripción", {
        description: error.message,
      }),
  });

  const editMutation = useMutation({
    mutationFn: (payload) => crm.editarSuscripcion(payload),
    onSuccess: () => {
      toast.success("Suscripción actualizada", {
        description:
          "Las fechas quedaron corregidas y el cambio se guardó en el historial.",
      });
      setSelectedSubscription(null);
      setNewPlanId("");
      setEditedEndDate("");
      queryClient.invalidateQueries({ queryKey: ["crm-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["crm-clients-directory"] });
      queryClient.invalidateQueries({ queryKey: ["crm-data"] });
    },
    onError: (error) =>
      toast.error("No se pudo editar la suscripción", {
        description: error.message,
      }),
  });

  const renewalMutation = useMutation({
    mutationFn: (payload) => crm.renovarSuscripcionPos(payload),
    onSuccess: (data) => {
      toast.success("Renovación completada", {
        description: "El pago y la nueva vigencia quedaron registrados. La impresión está preparada.",
      });
      setRenewalSubscription(null);
      setRenewalReceived("");
      queryClient.invalidateQueries({ queryKey: ["crm-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["crm-clients-directory"] });
      queryClient.invalidateQueries({ queryKey: ["crm-data"] });
      queryClient.invalidateQueries({ queryKey: ["crm-monthly-income"] });
      void FacturaCliente("print", { dataempresa, pago: data.pago, cliente: data.cliente, suscripcion: data.suscripcion, plan: data.plan })
        .catch((error) => toast.error(error?.message || "No se pudo imprimir el comprobante"));
    },
    onError: (error) =>
      toast.error("No se pudo completar la renovación", {
        description: error.message,
      }),
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
  const editorPlan = useMemo(
    () => crm.planes.find((plan) => String(plan.id) === String(newPlanId)),
    [crm.planes, newPlanId]
  );

  const openSubscriptionEditor = (item) => {
    setRenewalSubscription(null);
    setSelectedSubscription(item);
    setNewPlanId(String(item.id_plan));
    setEffectiveDate(item.fecha_inicio);
    setEditedEndDate(item.fecha_fin);
  };

  const recalculateEditedEnd = (startDate, plan) => {
    setEditedEndDate(
      calculateSubscriptionEnd(startDate, plan?.duracion_dias || 30)
    );
  };

  return (
    <>
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
          <header>
            <span><FiCreditCard /></span>
            <div>
              <h3>Asignar suscripción</h3>
              <p>Cliente, plan y vigencia en un solo paso.</p>
            </div>
          </header>
          <form onSubmit={submitForm("suscripcion")}>
            <ClientPicker clients={crm.clientes} />
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
                <small className="date-help">
                  Se calcula con la duración del plan y puedes ajustarlo.
                </small>
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
              <div className="editor-heading">
                <span>Editar suscripción</span>
                <strong>{selectedSubscription.cliente_nombre}</strong>
                <small>
                  Corrige el inicio; el vencimiento se recalcula y también puede
                  editarse manualmente.
                </small>
              </div>
              <label>
                Plan
                <select
                  value={newPlanId}
                  onChange={(event) => {
                    const nextPlan = crm.planes.find(
                      (plan) => String(plan.id) === event.target.value
                    );
                    setNewPlanId(event.target.value);
                    recalculateEditedEnd(effectiveDate, nextPlan);
                  }}
                  required
                >
                  {crm.planes
                    .filter(
                      (plan) =>
                        plan.activo || plan.id === selectedSubscription.id_plan
                    )
                    .map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.nombre} · {plan.duracion_dias} días
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Inicio
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={(event) => {
                    setEffectiveDate(event.target.value);
                    recalculateEditedEnd(event.target.value, editorPlan);
                  }}
                  required
                />
              </label>
              <label>
                Vencimiento
                <input
                  type="date"
                  value={editedEndDate}
                  min={effectiveDate}
                  onChange={(event) => setEditedEndDate(event.target.value)}
                  required
                />
              </label>
              <p className="editor-calculation">
                <FiClock />
                {editorPlan?.duracion_dias || 0} días desde el inicio. El
                vencimiento permanece editable.
              </p>
              <div className="editor-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setSelectedSubscription(null)}
                  disabled={editMutation.isPending}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() =>
                    editMutation.mutate({
                      id: selectedSubscription.id,
                      id_plan: newPlanId,
                      fecha_inicio: effectiveDate,
                      fecha_fin: editedEndDate,
                    })
                  }
                  disabled={
                    !newPlanId ||
                    !effectiveDate ||
                    !editedEndDate ||
                    editedEndDate < effectiveDate ||
                    editMutation.isPending
                  }
                >
                  {editMutation.isPending ? "Guardando…" : "Guardar cambios"}
                </button>
              </div>
            </section>
          ) : null}

          {renewalSubscription ? (
            <section className="renewal-checkout">
              <div>
                <span>Renovar y cobrar</span>
                <strong>{renewalSubscription.cliente_nombre}</strong>
                <small>{renewalSubscription.plan_nombre} · la vigencia se extenderá desde {renewalSubscription.fecha_fin}</small>
              </div>
              <b>{currency(renewalSubscription.precio_pactado, dataempresa?.currency, dataempresa?.iso)}</b>
              <select value={renewalMethod} onChange={(event) => setRenewalMethod(event.target.value)}>
                <option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="tarjeta">Tarjeta</option><option value="deposito">Depósito</option><option value="otro">Otro</option>
              </select>
              {renewalMethod === "efectivo" ? <input type="number" min={renewalSubscription.precio_pactado} step="0.01" value={renewalReceived} onChange={(event) => setRenewalReceived(event.target.value)} placeholder="Recibido" /> : null}
              {["transferencia", "deposito"].includes(renewalMethod) ? <input name="renewal-reference" form="renewal-form" placeholder="Referencia" required /> : null}
              <form id="renewal-form" onSubmit={(event) => { event.preventDefault(); const reference = new FormData(event.currentTarget).get("renewal-reference"); renewalMutation.mutate({ id_suscripcion: renewalSubscription.id, metodo_pago: renewalMethod, monto_recibido: renewalMethod === "efectivo" ? renewalReceived : null, referencia_pago: reference, notas: "Renovación cobrada desde suscripciones" }); }}>
                <button disabled={renewalMutation.isPending || (renewalMethod === "efectivo" && Number(renewalReceived || 0) < Number(renewalSubscription.precio_pactado || 0))}><FiPrinter /> {renewalMutation.isPending ? "Cobrando…" : "Cobrar, renovar e imprimir"}</button>
              </form>
              <button type="button" className="close-editor" onClick={() => setRenewalSubscription(null)}><FiXCircle /></button>
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
                    onClick={() => openSubscriptionEditor(item)}
                    disabled={
                      lifecycleMutation.isPending || editMutation.isPending
                    }
                    title="Editar plan y fechas"
                  >
                    <FiEdit3 /> Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => { setRenewalSubscription(item); setRenewalMethod("efectivo"); setRenewalReceived(String(Number(item.precio_pactado || 0))); }}
                    disabled={lifecycleMutation.isPending || renewalMutation.isPending}
                    title="Cobrar, renovar e imprimir"
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
                      onClick={() => setSubscriptionToCancel(item)}
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
      <CrmPlansTable crm={crm} dataempresa={dataempresa} />
    </Container>
    <ConfirmDialog
      open={Boolean(subscriptionToCancel)}
      title={`¿Cancelar la suscripción de ${subscriptionToCancel?.cliente_nombre || "este cliente"}?`}
      description="El cliente perderá el acceso vigente y la suscripción quedará registrada como cancelada. El historial de pagos y renovaciones se conservará."
      confirmLabel="Cancelar suscripción"
      pending={lifecycleMutation.isPending}
      onCancel={() => setSubscriptionToCancel(null)}
      onConfirm={() =>
        lifecycleMutation.mutate({
          id: subscriptionToCancel.id,
          accion: "cancelar",
        })
      }
    />
    </>
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
    grid-template-columns: minmax(320px, 380px) minmax(0, 1fr);
    gap: 14px;
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

    .client-picker-field {
      min-width: 0;
      display: grid;
      gap: 7px;

      > label {
        color: ${({ theme }) => theme.colorSubtitle};
        font-size: 12px;
        font-weight: 700;
      }
    }

    .client-picker {
      position: relative;
      min-width: 0;
    }

    .client-picker-control {
      min-height: 46px;
      display: flex;
      align-items: center;
      gap: 8px;
      border: 1px solid ${({ theme }) => theme.color2};
      border-radius: 10px;
      background: ${({ theme }) => theme.bgtotal};
      padding: 0 10px;
      transition: border-color 140ms ease, box-shadow 140ms ease;

      > svg {
        flex: none;
        color: ${({ theme }) => theme.colorSubtitle};
      }

      input {
        min-height: 44px;
        flex: 1;
        border: 0;
        background: transparent;
        padding: 0;
        outline: 0;
        font-size: 16px;
      }
    }

    .client-picker.open .client-picker-control {
      border-color: ${v.colorPrincipal};
      box-shadow: 0 0 0 3px rgba(243, 210, 12, 0.16);
    }

    .clear-client {
      width: 30px;
      height: 30px;
      display: grid;
      flex: none;
      place-items: center;
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: ${({ theme }) => theme.colorSubtitle};
      cursor: pointer;
      padding: 0;
    }

    .client-options {
      position: absolute;
      z-index: 30;
      top: calc(100% + 7px);
      left: 0;
      width: 100%;
      max-height: min(340px, 52vh);
      overflow-y: auto;
      border: 1px solid ${({ theme }) => theme.color2};
      border-radius: 12px;
      background: ${({ theme }) => theme.bgcards};
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.2);
      padding: 6px;
    }

    .client-options-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 7px 8px;
      color: ${({ theme }) => theme.colorSubtitle};
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0.05em;
      text-transform: uppercase;

      span {
        letter-spacing: 0;
        text-transform: none;
      }
    }

    .client-options > button {
      width: 100%;
      min-height: 54px;
      display: grid;
      grid-template-columns: 34px minmax(0, 1fr) auto;
      align-items: center;
      gap: 9px;
      border: 0;
      border-radius: 9px;
      background: transparent;
      color: ${({ theme }) => theme.text};
      padding: 7px 8px;
      text-align: left;
      cursor: pointer;

      &:hover,
      &.active {
        background: ${({ theme }) => theme.bgtotal};
      }

      > span:not(.client-avatar) {
        min-width: 0;
      }

      strong,
      small {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      strong {
        font-size: 12px;
      }

      small {
        margin-top: 3px;
        color: ${({ theme }) => theme.colorSubtitle};
        font-size: 10px;
      }
    }

    .client-avatar {
      width: 34px;
      height: 34px;
      display: grid;
      place-items: center;
      border-radius: 10px;
      background: rgba(243, 210, 12, 0.2);
      color: #8a7600;
      font-size: 12px;
      font-weight: 900;
    }

    .no-client-results {
      margin: 0;
      padding: 18px 10px;
      color: ${({ theme }) => theme.colorSubtitle};
      font-size: 12px;
      line-height: 1.45;
      text-align: center;
    }

    .client-search-hint {
      display: block;
      padding: 7px 8px 5px;
      color: ${({ theme }) => theme.colorSubtitle};
      font-size: 10px;
      text-align: center;
    }

    .selected-client-copy {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      color: #15803d;
      font-size: 10px;
      font-weight: 800;
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

    .date-help {
      color: ${({ theme }) => theme.colorSubtitle};
      font-size: 10px;
      font-weight: 500;
      line-height: 1.35;
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
    grid-template-columns: repeat(3, minmax(140px, 1fr));
    align-items: end;
    gap: 10px;
    margin: 0 0 14px;
    border: 1px solid rgba(243, 210, 12, 0.55);
    border-radius: 12px;
    background: rgba(243, 210, 12, 0.08);
    padding: 14px;

    .editor-heading {
      grid-column: 1 / -1;
      display: grid;
      gap: 2px;

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

    label {
      display: grid;
      gap: 6px;
      color: ${({ theme }) => theme.colorSubtitle};
      font-size: 11px;
      font-weight: 800;
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

    .editor-calculation {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      gap: 7px;
      margin: 0;
      color: ${({ theme }) => theme.colorSubtitle};
      font-size: 11px;
    }

    .editor-actions {
      grid-column: 1 / -1;
      display: flex;
      justify-content: flex-end;
      gap: 8px;

      button {
        min-width: 130px;
      }

      .secondary {
      border-color: ${({ theme }) => theme.color2};
        background: ${({ theme }) => theme.bgcards};
      color: ${({ theme }) => theme.text};
      }

      button:disabled {
        cursor: not-allowed;
        opacity: 0.55;
      }
    }
  }

  .renewal-checkout {
    display:grid;grid-template-columns:minmax(190px,1fr) auto 130px 130px auto auto;align-items:center;gap:8px;margin:0 0 14px;border:1px solid rgba(22,163,74,.35);border-radius:12px;background:rgba(22,163,74,.07);padding:10px;
    > div{display:grid;gap:2px} > div span{color:#15803d;font-size:10px;font-weight:900;letter-spacing:.05em;text-transform:uppercase} > div small{color:${({ theme }) => theme.colorSubtitle}}
    input,select,button{min-width:0;min-height:38px;border:1px solid ${({ theme }) => theme.color2};border-radius:9px;background:${({ theme }) => theme.bgcards};color:${({ theme }) => theme.text};padding:0 9px}
    form button{border-color:${v.colorPrincipal};background:${v.colorPrincipal};color:#111827;font-weight:900;cursor:pointer}.close-editor{cursor:pointer}
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
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .renewal-checkout { grid-template-columns:1fr 1fr; > div{grid-column:1/-1} }
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

      .editor-heading,
      .editor-calculation,
      .editor-actions {
        grid-column: auto;
      }

      .editor-actions {
        display: grid;
        grid-template-columns: 1fr;

        button {
          width: 100%;
        }
      }
    }
    .renewal-checkout { grid-template-columns:1fr; > div{grid-column:auto} }

    .assignment-card .client-options {
      position: static;
      max-height: 300px;
      margin-top: 7px;
      box-shadow: none;
    }
  }
`;
