import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiCheck,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiCreditCard,
  FiDollarSign,
  FiFileText,
  FiMail,
  FiMessageCircle,
  FiPrinter,
  FiRefreshCw,
  FiSearch,
  FiUser,
  FiX,
} from "react-icons/fi";
import styled from "styled-components";
import { toast } from "sonner";
import FacturaCliente from "../../../reports/FacturaCliente";
import ReporteCobrosCrm from "../../../reports/ReporteCobrosCrm";
import { v } from "../../../styles/variables";
import {
  adjustInstallmentToReceived,
  calculateSubscriptionAccount,
  resolveClientChargeTarget,
} from "../../../utils/crmPayments";
import { buildWhatsappReceiptUrl } from "../../../utils/crmWhatsapp";

const methods = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "deposito", label: "Depósito" },
  { value: "otro", label: "Otro" },
];

const todayMonth = () => new Date().toISOString().slice(0, 7);
const shiftMonth = (value, offset) => {
  const [year, month] = String(value || todayMonth()).split("-").map(Number);
  const date = new Date(year, (month || 1) - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};
const monthLabel = (value, locale = "es-NI") => {
  const [year, month] = String(value || todayMonth()).split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(year, (month || 1) - 1, 1));
};
const nameOf = (item) =>
  [item?.nombres, item?.apellidos].filter(Boolean).join(" ") || "Cliente";
const normalize = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const dateOf = (value) =>
  value
    ? new Intl.DateTimeFormat("es-NI", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";

function money(value, code, locale) {
  try {
    return new Intl.NumberFormat(locale || "es-NI", {
      style: "currency",
      currency: code || "USD",
    }).format(Number(value || 0));
  } catch {
    return `${code || "USD"} ${Number(value || 0).toFixed(2)}`;
  }
}

function SearchPicker({
  items,
  value,
  onChange,
  itemLabel,
  itemDetail,
  searchText,
  placeholder,
  emptyText = "No hay coincidencias.",
}) {
  const id = useId();
  const rootRef = useRef(null);
  const preserveQueryOnClearRef = useRef(false);
  const itemLabelRef = useRef(itemLabel);
  itemLabelRef.current = itemLabel;
  const selected = items.find((item) => String(item.id) === String(value));
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (selected) {
      setQuery(itemLabelRef.current(selected));
    } else if (!value && !preserveQueryOnClearRef.current) {
      setQuery("");
    }
    preserveQueryOnClearRef.current = false;
  }, [value, selected]);

  useEffect(() => {
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const matches = useMemo(() => {
    const term = normalize(selected && query === itemLabel(selected) ? "" : query);
    return (term
      ? items.filter((item) => normalize(searchText(item)).includes(term))
      : items
    ).slice(0, 6);
  }, [items, query, searchText, selected, itemLabel]);

  const choose = (item) => {
    onChange(String(item.id), item);
    setQuery(itemLabel(item));
    setOpen(false);
  };

  return (
    <div className="search-picker" ref={rootRef}>
      <div className="picker-control">
        <FiSearch />
        <input
          id={id}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-options`}
          autoComplete="off"
          value={query}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            if (value) {
              preserveQueryOnClearRef.current = true;
              onChange("", null);
            }
            setOpen(true);
          }}
        />
        {value ? (
          <button
            type="button"
            className="picker-clear"
            aria-label="Limpiar selección"
            onClick={() => {
              onChange("", null);
              setQuery("");
              setOpen(true);
            }}
          >
            <FiX />
          </button>
        ) : (
          <FiChevronDown />
        )}
      </div>
      {open ? (
        <div className="picker-options" id={`${id}-options`} role="listbox">
          <div className="picker-summary">
            <span>{query ? "Resultados encontrados" : "Selección rápida"}</span>
            <small>{matches.length} de {items.length}</small>
          </div>
          {matches.map((item) => (
            <button
              className="picker-option"
              type="button"
              role="option"
              aria-selected={String(item.id) === String(value)}
              key={item.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(item)}
            >
              <span className="picker-avatar" aria-hidden="true"><FiUser /></span>
              <span className="picker-copy">
                <b>{itemLabel(item)}</b>
                <small>{itemDetail(item)}</small>
              </span>
              <span className="picker-state">
                {item.codigo ? <em>{item.codigo}</em> : null}
                {String(item.id) === String(value) ? <FiCheck /> : null}
              </span>
            </button>
          ))}
          {!matches.length ? <p>{emptyText}</p> : null}
          {items.length > matches.length ? (
            <small className="picker-hint">
              Escribe para filtrar por nombre, correo, teléfono o plan.
            </small>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PaymentFields({
  method,
  total,
  received,
  setReceived,
  onReceivedBlur,
  currency,
  locale,
}) {
  const cash = method === "efectivo";
  const change = Math.max(0, Number(received || 0) - Number(total || 0));
  return (
    <>
      {cash ? (
        <label>
          Recibido en caja
          <input
            name="monto_recibido"
            type="number"
            min={total || 0}
            step="0.01"
            value={received}
            onChange={(event) => setReceived(event.target.value)}
            onBlur={(event) => onReceivedBlur?.(event.target.value)}
            required
          />
        </label>
      ) : null}
      {["transferencia", "deposito"].includes(method) ? (
        <label>
          Referencia bancaria
          <input
            name="referencia_pago"
            placeholder="N.º de operación"
            required
          />
        </label>
      ) : null}
      {cash ? (
        <div className="change">
          <span>Vuelto a entregar</span>
          <strong>{money(change, currency, locale)}</strong>
        </div>
      ) : null}
    </>
  );
}

function receiptPayload(item) {
  return {
    pago: {
      id: item.id_origen,
      referencia: item.referencia,
      monto: item.monto,
      moneda: item.moneda,
      metodo_pago: item.metodo_pago,
      monto_recibido: item.monto_recibido,
      cambio: item.cambio,
      fecha_pago: item.fecha_pago,
      fecha_vencimiento: item.fecha_vencimiento,
      referencia_pago: item.referencia_pago,
      notas: item.notas,
      estado: item.estado,
      total_plan: item.total_plan,
      abonado_acumulado: item.abonado_acumulado,
      saldo_pendiente: item.saldo_pendiente,
      aplica_a_saldo_plan: item.aplica_a_saldo_plan,
    },
    cliente: {
      nombres: item.cliente_nombres,
      apellidos: item.cliente_apellidos,
      email: item.cliente_email,
      telefono: item.cliente_telefono,
    },
    suscripcion: {
      fecha_inicio: item.periodo_inicio || item.suscripcion_inicio,
      fecha_fin: item.periodo_fin || item.suscripcion_fin,
    },
    plan: {
      nombre: item.plan_nombre,
      descripcion: item.plan_descripcion,
    },
  };
}

export function CrmPaymentsWorkspace({
  crm,
  dataempresa,
  initialClient = null,
  onClientHandled,
}) {
  const queryClient = useQueryClient();
  const [subscriptionId, setSubscriptionId] = useState("");
  const [installmentAmount, setInstallmentAmount] = useState("");
  const [invoiceMethod, setInvoiceMethod] = useState("efectivo");
  const [invoiceReceived, setInvoiceReceived] = useState("");
  const [directClientId, setDirectClientId] = useState("");
  const [directSubscriptionId, setDirectSubscriptionId] = useState("");
  const [directMethod, setDirectMethod] = useState("efectivo");
  const [debtReference, setDebtReference] = useState("");
  const [directAmount, setDirectAmount] = useState("");
  const [directReceived, setDirectReceived] = useState("");
  const [month, setMonth] = useState(todayMonth());
  const [monthlyMethod, setMonthlyMethod] = useState("todos");
  const [historySearch, setHistorySearch] = useState("");
  const [historyMethod, setHistoryMethod] = useState("todos");
  const [historyPage, setHistoryPage] = useState(1);
  const installmentInputRef = useRef(null);
  const invoicePanelRef = useRef(null);
  const [invoiceFocused, setInvoiceFocused] = useState(false);

  useEffect(
    () => setHistoryPage(1),
    [historySearch, historyMethod, month]
  );

  const availableSubscriptions = useMemo(
    () => crm.suscripciones.filter((item) => item.estado !== "cancelada"),
    [crm.suscripciones]
  );
  const invoiceSubscription = availableSubscriptions.find(
    (item) => String(item.id) === String(subscriptionId)
  );
  const invoiceAccount = useMemo(
    () => calculateSubscriptionAccount(invoiceSubscription, crm.pagos),
    [invoiceSubscription, crm.pagos]
  );
  const directSubscriptions = crm.suscripciones.filter(
    (item) =>
      !directClientId ||
      String(item.id_cliente_crm) === String(directClientId)
  );
  const liveInitialClient = initialClient?.id
    ? crm.clientes.find(
        (item) => String(item.id) === String(initialClient.id)
      ) || initialClient
    : null;
  const focusClient =
    liveInitialClient ||
    crm.clientes.find(
      (item) => String(item.id) === String(directClientId)
    );
  const debt = Number(focusClient?.saldo_vencido || 0);
  const planBalance = Number(focusClient?.saldo_plan || 0);
  const installment = Number(installmentAmount || 0);
  const installmentTooHigh =
    installment > 0 && installment > invoiceAccount.balance;
  const insufficientCash =
    invoiceMethod === "efectivo" &&
    installment > 0 &&
    Number(invoiceReceived || 0) < installment;
  const clientsById = useMemo(
    () =>
      new Map(
        crm.clientes.map((client) => [String(client.id), client])
      ),
    [crm.clientes]
  );

  useEffect(() => {
    if (!initialClient?.id) return;

    const client =
      crm.clientes.find(
        (item) => String(item.id) === String(initialClient.id)
      ) || initialClient;
    const target = resolveClientChargeTarget({
      client,
      subscriptions: availableSubscriptions,
      payments: crm.pagos,
    });

    setDirectClientId(target.clientId);

    if (target.mode === "subscription") {
      setSubscriptionId(target.subscriptionId);
      setInstallmentAmount(String(target.amount));
      setInvoiceReceived(String(target.amount));
      setDirectSubscriptionId(target.subscriptionId);
      setDirectAmount("");
      setDirectReceived("");
      setInvoiceFocused(true);
      window.setTimeout(() => {
        invoicePanelRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        installmentInputRef.current?.focus({ preventScroll: true });
        installmentInputRef.current?.select();
      }, 120);
      window.setTimeout(() => setInvoiceFocused(false), 1800);
      return;
    }

    setSubscriptionId("");
    setInstallmentAmount("");
    setInvoiceReceived("");
    setDirectSubscriptionId(target.subscriptionId);
    setDirectAmount(target.amount > 0 ? String(target.amount) : "");
    setDirectReceived(target.amount > 0 ? String(target.amount) : "");
  }, [
    availableSubscriptions,
    crm.clientes,
    crm.pagos,
    initialClient,
  ]);

  const reportQuery = useQuery({
    queryKey: ["crm-monthly-income", dataempresa?.id, month],
    queryFn: () => crm.mostrarReporteIngresosMensual({ mes: `${month}-01` }),
    enabled: Boolean(dataempresa?.id && month),
    refetchOnWindowFocus: false,
  });
  const historyQuery = useQuery({
    queryKey: [
      "crm-payment-history",
      dataempresa?.id,
      historyPage,
      historySearch,
      historyMethod,
      month,
    ],
    queryFn: () =>
      crm.mostrarHistorialCobrosPage({
        id_empresa: dataempresa.id,
        page: historyPage,
        pageSize: 10,
        search: historySearch,
        method: historyMethod,
        month,
      }),
    enabled: Boolean(dataempresa?.id),
    placeholderData: (previous) => previous,
    refetchOnWindowFocus: false,
  });

  const monthlyRows = reportQuery.data || [];
  const filteredMonthlyRows = useMemo(
    () => monthlyMethod === "todos"
      ? monthlyRows
      : monthlyRows.filter((item) => normalize(item.metodo_pago) === normalize(monthlyMethod)),
    [monthlyMethod, monthlyRows]
  );
  const history = historyQuery.data || {
    data: [],
    pagination: {
      page: 1,
      totalPages: 1,
      total: 0,
      from: 0,
      to: 0,
      hasPreviousPage: false,
      hasNextPage: false,
    },
  };
  const historyRows = history.data.map((item) => {
    const currentClient = clientsById.get(String(item.id_cliente_crm));
    return {
      ...item,
      currentEmail: currentClient?.email || item.cliente_email || "",
      currentPhone: currentClient?.telefono || item.cliente_telefono || "",
    };
  });
  const monthlyTotal = filteredMonthlyRows.reduce(
    (sum, item) => sum + Number(item.total_ingresos || 0),
    0
  );
  const monthlyPayments = filteredMonthlyRows.reduce(
    (sum, item) => sum + Number(item.cantidad_pagos || 0),
    0
  );

  const invalidate = () =>
    [
      "crm-data",
      "crm-clients-directory",
      "crm-subscriptions",
      "crm-monthly-income",
      "crm-payment-history",
    ].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));

  const finish = async (result, message) => {
    toast.success(message);
    invalidate();
    if (result?.pago) {
      await FacturaCliente("print", {
        dataempresa,
        pago: {
          ...result.pago,
          total_plan: result.total_plan,
          abonado_acumulado: result.abonado_acumulado,
          saldo_pendiente: result.saldo_pendiente,
          aplica_a_saldo_plan: result.total_plan != null,
        },
        cliente: result.cliente,
        suscripcion: result.suscripcion,
        plan: result.plan,
      });
    }
    if (
      Number(result?.saldo_pendiente || 0) > 0 &&
      result?.cliente?.email &&
      result?.comprobante_id
    ) {
      try {
        const sent = await crm.enviarComprobanteCobro({
          id_empresa: dataempresa.id,
          comprobante_id: result.comprobante_id,
        });
        toast.success(`Saldo pendiente enviado a ${sent.recipient}`);
      } catch (error) {
        toast.error(
          `El abono se guardó, pero el correo no pudo enviarse: ${error.message}`
        );
      }
    }
  };

  const invoiceMutation = useMutation({
    mutationFn: (payload) => crm.abonarSuscripcionPos(payload),
    onSuccess: (data) => {
      void finish(
        data,
        data.saldo_pendiente > 0
          ? "Abono registrado; el saldo quedó actualizado"
          : "Plan pagado por completo"
      );
      setSubscriptionId("");
      setInstallmentAmount("");
      setInvoiceReceived("");
      onClientHandled?.();
    },
    onError: (error) => toast.error(error.message),
  });
  const directMutation = useMutation({
    mutationFn: (payload) => crm.registrarPagoPos(payload),
    onSuccess: (data) => {
      void finish(data, "Pago directo registrado e impresión preparada");
      setDirectAmount("");
      setDirectReceived("");
      setDirectSubscriptionId("");
      onClientHandled?.();
    },
    onError: (error) => toast.error(error.message),
  });
  const debtMutation = useMutation({
    mutationFn: (payload) => crm.cobrarMoraPos(payload),
    onSuccess: (data) => {
      void finish(
        data,
        `${data.facturas_liquidadas} documento(s) vencido(s) saldados`
      );
      onClientHandled?.();
    },
    onError: (error) => toast.error(error.message),
  });
  const printReport = useMutation({
    mutationFn: () =>
      crm.mostrarHistorialCobrosPage({
        id_empresa: dataempresa.id,
        page: 1,
        pageSize: 50,
        month,
      }),
    onSuccess: ({ data }) => {
      void ReporteCobrosCrm("print", {
        dataempresa,
        month,
        rows: data,
        monthlyRows,
      });
    },
    onError: (error) => toast.error(error.message),
  });
  const emailReceipt = useMutation({
    mutationFn: (item) =>
      crm.enviarComprobanteCobro({
        id_empresa: dataempresa.id,
        comprobante_id: item.id,
      }),
    onSuccess: (data) =>
      toast.success(`Comprobante enviado a ${data.recipient}`),
    onError: (error) => toast.error(error.message),
  });

  const reprint = (item) => {
    void FacturaCliente("print", {
      dataempresa,
      ...receiptPayload(item),
    });
  };

  const selectInvoice = (nextId, item) => {
    setSubscriptionId(nextId);
    const account = calculateSubscriptionAccount(item, crm.pagos);
    const nextAmount = item ? String(account.balance) : "";
    setInstallmentAmount(nextAmount);
    setInvoiceReceived(nextAmount);
  };

  return (
    <Container>
      <header className="hero">
        <div>
          <span className="eyebrow">
            <FiCreditCard /> Caja CRM
          </span>
          <h2>Cobros y abonos del plan, sin perder el saldo</h2>
          <p>
            Cada pago queda aplicado al período vigente. Puedes recibir varios
            abonos y el sistema conserva el total, lo acumulado y lo pendiente.
          </p>
        </div>
      </header>

      <section className="metric-grid">
        <article>
          <span>Ingresos del mes</span>
          <strong>
            {money(monthlyTotal, dataempresa?.currency, dataempresa?.iso)}
          </strong>
          <small>{month}</small>
        </article>
        <article>
          <span>Cobros registrados</span>
          <strong>{monthlyPayments}</strong>
          <small>Pagos efectivamente cobrados</small>
        </article>
        <article>
          <span>Vuelto entregado</span>
          <strong>
            {money(
              monthlyRows.reduce(
                (sum, item) => sum + Number(item.total_vuelto || 0),
                0
              ),
              dataempresa?.currency,
              dataempresa?.iso
            )}
          </strong>
          <small>Control de efectivo</small>
        </article>
      </section>

      {focusClient?.id ? (
        <section
          className={`customer-checkout ${debt > 0 ? "has-debt" : ""}`}
        >
          <div>
            <span>
              {debt > 0 ? <FiAlertTriangle /> : <FiCreditCard />}
            </span>
            <div>
              <b>{nameOf(focusClient)}</b>
              <small>
                {focusClient.plan_nombre ||
                  focusClient.crm_planes?.nombre ||
                  "Cliente seleccionado"}{" "}
                · {focusClient.email || "sin correo"}
              </small>
            </div>
          </div>
          <div className="checkout-total">
            <small>
              {planBalance > 0
                ? "Saldo del plan preparado para abonar"
                : debt > 0
                  ? "Saldo vencido por cobrar"
                  : "Listo para cobrar"}
            </small>
            <strong>
              {planBalance > 0
                ? money(planBalance, dataempresa?.currency, dataempresa?.iso)
                : debt > 0
                  ? money(debt, dataempresa?.currency, dataempresa?.iso)
                : "Sin mora pendiente"}
            </strong>
          </div>
          {debt > 0 ? (
            <>
              <select
                aria-label="Método para saldar mora"
                value={directMethod}
                onChange={(event) => setDirectMethod(event.target.value)}
              >
                {methods.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
              {["transferencia", "deposito"].includes(directMethod) ? (
                <input
                  aria-label="Referencia de mora"
                  value={debtReference}
                  onChange={(event) => setDebtReference(event.target.value)}
                  placeholder="Referencia"
                />
              ) : null}
              <button
                type="button"
                onClick={() =>
                  debtMutation.mutate({
                    id_cliente_crm: focusClient.id,
                    metodo_pago: directMethod,
                    monto_recibido:
                      directMethod === "efectivo"
                        ? directReceived || debt
                        : null,
                    referencia_pago: debtReference,
                    notas: "Pago de mora desde directorio",
                  })
                }
                disabled={
                  debtMutation.isPending ||
                  (directMethod === "efectivo" &&
                    Number(directReceived || debt) < debt) ||
                  (["transferencia", "deposito"].includes(directMethod) &&
                    !debtReference.trim())
                }
              >
                <FiPrinter />{" "}
                {debtMutation.isPending
                  ? "Cobrando…"
                  : "Saldar mora e imprimir"}
              </button>
            </>
          ) : null}
        </section>
      ) : null}

      <section className="workspace">
        <article
          className={`panel invoice ${invoiceFocused ? "payment-focus" : ""}`}
          ref={invoicePanelRef}
        >
          <header>
            <span>
              <FiFileText />
            </span>
            <div>
              <h3>Abonar una suscripción</h3>
              <p>Busca al cliente o su plan y registra el monto que entrega.</p>
            </div>
          </header>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const values = new FormData(event.currentTarget);
              invoiceMutation.mutate({
                id_suscripcion: subscriptionId,
                monto_abono: installmentAmount,
                metodo_pago: invoiceMethod,
                monto_recibido:
                  invoiceMethod === "efectivo" ? invoiceReceived : null,
                referencia_pago: values.get("referencia_pago"),
                notas: values.get("notas"),
              });
            }}
          >
            <label className="wide">
              Cliente y suscripción
              <SearchPicker
                items={availableSubscriptions}
                value={subscriptionId}
                onChange={selectInvoice}
                itemLabel={(item) =>
                  `${nameOf(item.clientes_crm)} · ${item.crm_planes?.nombre || "Plan"}`
                }
                itemDetail={(item) => {
                  const account = calculateSubscriptionAccount(item, crm.pagos);
                  return `Saldo ${money(account.balance, dataempresa?.currency, dataempresa?.iso)} · vence ${item.fecha_fin}`;
                }}
                searchText={(item) =>
                  [
                    nameOf(item.clientes_crm),
                    item.clientes_crm?.codigo,
                    item.clientes_crm?.email,
                    item.clientes_crm?.telefono,
                    item.crm_planes?.nombre,
                  ].join(" ")
                }
                placeholder="Buscar cliente, correo, teléfono o plan"
                emptyText="No encontramos una suscripción con esa búsqueda."
              />
            </label>

            <div className="account-summary wide">
              <span>
                <small>Valor del plan</small>
                <b>
                  {money(
                    invoiceAccount.total,
                    dataempresa?.currency,
                    dataempresa?.iso
                  )}
                </b>
              </span>
              <span>
                <small>Ya abonado</small>
                <b>
                  {money(
                    invoiceAccount.paid,
                    dataempresa?.currency,
                    dataempresa?.iso
                  )}
                </b>
              </span>
              <span className="balance">
                <small>Saldo pendiente</small>
                <b>
                  {money(
                    invoiceAccount.balance,
                    dataempresa?.currency,
                    dataempresa?.iso
                  )}
                </b>
              </span>
            </div>

            <label>
              Abono de hoy
              <input
                ref={installmentInputRef}
                type="number"
                min="0.01"
                max={invoiceAccount.balance || undefined}
                step="0.01"
                value={installmentAmount}
                onChange={(event) => {
                  setInstallmentAmount(event.target.value);
                  if (invoiceMethod === "efectivo") {
                    setInvoiceReceived(event.target.value);
                  }
                }}
                required
              />
            </label>
            <label>
              Método
              <select
                value={invoiceMethod}
                onChange={(event) => setInvoiceMethod(event.target.value)}
              >
                {methods.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </label>
            <PaymentFields
              method={invoiceMethod}
              total={installment}
              received={invoiceReceived}
              setReceived={setInvoiceReceived}
              onReceivedBlur={(value) => {
                const adjusted = adjustInstallmentToReceived(
                  installment,
                  value
                );
                if (adjusted !== installment) {
                  setInstallmentAmount(String(adjusted));
                }
              }}
              currency={dataempresa?.currency}
              locale={dataempresa?.iso}
            />
            {installmentTooHigh ? (
              <p className="form-alert wide" role="alert">
                <FiAlertCircle />
                El máximo que puedes abonar es{" "}
                {money(
                  invoiceAccount.balance,
                  dataempresa?.currency,
                  dataempresa?.iso
                )}
                .
              </p>
            ) : insufficientCash ? (
              <p className="form-alert wide" role="alert">
                <FiAlertCircle />
                El efectivo recibido debe cubrir el abono. Si entrega menos,
                ese valor se convierte automáticamente en el abono de hoy.
              </p>
            ) : subscriptionId && invoiceAccount.balance > 0 ? (
              <p className="form-help wide">
                El saldo está precargado. Puedes escribir un abono menor y el
                restante continuará pendiente.
              </p>
            ) : null}
            <label className="wide">
              Notas
              <input name="notas" placeholder="Observación opcional" />
            </label>
            <button
              className="wide"
              disabled={
                invoiceMutation.isPending ||
                !subscriptionId ||
                installment <= 0 ||
                installment > invoiceAccount.balance ||
                invoiceAccount.balance <= 0 ||
                (invoiceMethod === "efectivo" &&
                  Number(invoiceReceived || 0) < installment)
              }
            >
              <FiPrinter />{" "}
              {invoiceMutation.isPending
                ? "Registrando…"
                : invoiceAccount.balance > 0
                  ? "Registrar abono e imprimir"
                  : "Período pagado"}
            </button>
          </form>
        </article>

        <article className="panel direct">
          <header>
            <span>
              <FiDollarSign />
            </span>
            <div>
              <h3>Cobro directo</h3>
              <p>Servicios o ajustes fuera del saldo de una suscripción.</p>
            </div>
          </header>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const values = new FormData(event.currentTarget);
              directMutation.mutate({
                id_cliente_crm: directClientId,
                id_suscripcion: directSubscriptionId || null,
                monto: directAmount,
                metodo_pago: directMethod,
                monto_recibido:
                  directMethod === "efectivo" ? directReceived : null,
                referencia_pago: values.get("referencia_pago"),
                fecha_vencimiento: values.get("fecha_vencimiento"),
                notas: values.get("notas"),
              });
            }}
          >
            <label className="wide">
              Cliente
              <SearchPicker
                items={crm.clientes}
                value={directClientId}
                onChange={(nextId) => {
                  setDirectClientId(nextId);
                  setDirectSubscriptionId("");
                }}
                itemLabel={nameOf}
                itemDetail={(item) =>
                  [item.email, item.telefono].filter(Boolean).join(" · ") ||
                  "Sin contacto"
                }
                searchText={(item) =>
                  [nameOf(item), item.codigo, item.email, item.telefono].join(" ")
                }
                placeholder="Buscar por código, nombre, correo o teléfono"
              />
            </label>
            <label>
              Suscripción (referencia)
              <select
                value={directSubscriptionId}
                onChange={(event) =>
                  setDirectSubscriptionId(event.target.value)
                }
              >
                <option value="">Sin suscripción</option>
                {directSubscriptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.crm_planes?.nombre || `Suscripción #${item.id}`}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Monto a cobrar
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={directAmount}
                onChange={(event) => {
                  setDirectAmount(event.target.value);
                  if (directMethod === "efectivo" && !directReceived) {
                    setDirectReceived(event.target.value);
                  }
                }}
                required
              />
            </label>
            <label>
              Método
              <select
                value={directMethod}
                onChange={(event) => setDirectMethod(event.target.value)}
              >
                {methods.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </label>
            <PaymentFields
              method={directMethod}
              total={Number(directAmount || 0)}
              received={directReceived}
              setReceived={setDirectReceived}
              currency={dataempresa?.currency}
              locale={dataempresa?.iso}
            />
            <label>
              Vencimiento
              <input name="fecha_vencimiento" type="date" />
            </label>
            <label className="wide">
              Notas
              <input name="notas" placeholder="Detalle u observación" />
            </label>
            <button
              className="wide"
              disabled={
                directMutation.isPending ||
                !directClientId ||
                Number(directAmount || 0) <= 0 ||
                (directMethod === "efectivo" &&
                  Number(directReceived || 0) < Number(directAmount || 0))
              }
            >
              {directMutation.isPending
                ? "Registrando…"
                : "Registrar e imprimir"}
            </button>
          </form>
        </article>
      </section>

      <section className="report panel">
        <header>
          <div>
            <h3>Entradas mensuales</h3>
            <p>Resumen contable de los pagos cobrados.</p>
          </div>
          <div className="report-actions">
            <div className="month-filter" role="group" aria-label="Seleccionar mes del reporte">
              <button type="button" className="month-nav" onClick={() => setMonth((value) => shiftMonth(value, -1))} aria-label="Mes anterior"><FiChevronLeft /></button>
              <label>Periodo<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>
              <button type="button" className="month-nav" onClick={() => setMonth((value) => shiftMonth(value, 1))} aria-label="Mes siguiente"><FiChevronRight /></button>
              <span className="month-label">{monthLabel(month, dataempresa?.iso)}</span>
            </div>
            <label>
              Método
              <select value={monthlyMethod} onChange={(event) => setMonthlyMethod(event.target.value)}>
                <option value="todos">Todos</option>
                {methods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
              </select>
            </label>
            <button
              type="button"
              className="secondary"
              onClick={() => printReport.mutate()}
              disabled={printReport.isPending}
            >
              <FiPrinter />{" "}
              {printReport.isPending ? "Preparando…" : "Imprimir informe"}
            </button>
          </div>
        </header>
        {reportQuery.isLoading ? (
          <p className="empty">Cargando reporte…</p>
        ) : (
          <div className="report-table">
            <div className="report-row head">
              <span>Método</span>
              <span>Cobros</span>
              <span>Ingresos</span>
              <span>Recibido</span>
              <span>Vuelto</span>
            </div>
            {filteredMonthlyRows.map((item) => (
              <div className="report-row" key={item.metodo_pago}>
                <span>{item.metodo_pago}</span>
                <span>{item.cantidad_pagos}</span>
                <b>
                  {money(
                    item.total_ingresos,
                    dataempresa?.currency,
                    dataempresa?.iso
                  )}
                </b>
                <span>
                  {money(
                    item.total_recibido,
                    dataempresa?.currency,
                    dataempresa?.iso
                  )}
                </span>
                <span>
                  {money(
                    item.total_vuelto,
                    dataempresa?.currency,
                    dataempresa?.iso
                  )}
                </span>
              </div>
            ))}
            {!filteredMonthlyRows.length ? (
              <p className="empty">
                <FiAlertCircle /> No hay entradas para este mes y método.
              </p>
            ) : null}
          </div>
        )}
      </section>

      <section className="history panel">
        <header>
          <div>
            <h3>Historial de cobros y comprobantes</h3>
            <p>
              Busca cualquier pago, reimprime el comprobante o compártelo por
              correo y WhatsApp.
            </p>
          </div>
          <button
            type="button"
            className="secondary"
            onClick={() => historyQuery.refetch()}
            disabled={historyQuery.isFetching}
          >
            <FiRefreshCw /> Actualizar
          </button>
        </header>
        <div className="history-filters">
          <label className="search">
            <FiSearch />
            <input
              value={historySearch}
              onChange={(event) => setHistorySearch(event.target.value)}
              placeholder="Cliente, referencia o plan"
            />
          </label>
          <label>
            <select
              value={historyMethod}
              onChange={(event) => setHistoryMethod(event.target.value)}
            >
              <option value="todos">Todos los métodos</option>
              {methods.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {historyQuery.isLoading ? (
          <p className="empty">Cargando comprobantes…</p>
        ) : (
          <>
            <div className="history-table">
              <div className="history-row head">
                <span>Documento</span>
                <span>Cliente</span>
                <span>Detalle y saldo</span>
                <span>Fecha y método</span>
                <span>Abono</span>
                <span>Acciones</span>
              </div>
              {historyRows.map((item) => (
                <div className="history-row" key={item.id}>
                  <div>
                    <b>{item.referencia}</b>
                    <small>
                      {item.origen === "recibo_mora"
                        ? "Mora saldada"
                        : item.aplica_a_saldo_plan
                          ? "Abono de suscripción"
                          : "Cobro directo"}
                    </small>
                  </div>
                  <div>
                    <b>
                      {[item.cliente_nombres, item.cliente_apellidos]
                        .filter(Boolean)
                        .join(" ") || "Cliente"}
                    </b>
                    <small>
                      {item.currentEmail ||
                        item.currentPhone ||
                        "Sin contacto"}
                    </small>
                  </div>
                  <div>
                    <b>{item.plan_nombre || "Cobro general"}</b>
                    <small>
                      {item.aplica_a_saldo_plan
                        ? `Acumulado ${money(item.abonado_acumulado, item.moneda, dataempresa?.iso)} · Falta ${money(item.saldo_pendiente, item.moneda, dataempresa?.iso)}`
                        : item.notas || "Sin observaciones"}
                    </small>
                  </div>
                  <div>
                    <b>{dateOf(item.fecha_pago)}</b>
                    <small>
                      {item.metodo_pago || "—"}
                      {item.referencia_pago
                        ? ` · ${item.referencia_pago}`
                        : ""}
                    </small>
                  </div>
                  <strong>
                    {money(
                      item.monto,
                      item.moneda || dataempresa?.currency,
                      dataempresa?.iso
                    )}
                  </strong>
                  <div className="receipt-actions">
                    <button
                      type="button"
                      className="print"
                      onClick={() => reprint(item)}
                    >
                      <FiPrinter /> Reimprimir
                    </button>
                    <button
                      type="button"
                      className="print"
                      onClick={() => emailReceipt.mutate(item)}
                      disabled={!item.currentEmail || emailReceipt.isPending}
                      title={
                        item.currentEmail
                          ? `Enviar a ${item.currentEmail}`
                          : "Agrega un correo al cliente para habilitar el envío"
                      }
                    >
                      {emailReceipt.isPending ? (
                        "Enviando…"
                      ) : (
                        <>
                          <FiMail /> Correo
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      className="print whatsapp"
                      disabled={!item.currentPhone}
                      title={
                        item.currentPhone
                          ? `Compartir con ${item.currentPhone}`
                          : "Agrega un teléfono al cliente para habilitar WhatsApp"
                      }
                      onClick={() => {
                        const url = buildWhatsappReceiptUrl({
                          receipt: item,
                          company: dataempresa,
                          defaultCountryCode:
                            crm.whatsappConfig?.default_country_code || "505",
                        });
                        if (url) {
                          window.open(url, "_blank", "noopener,noreferrer");
                        }
                      }}
                    >
                      <FiMessageCircle /> WhatsApp
                    </button>
                  </div>
                </div>
              ))}
              {!history.data.length ? (
                <p className="empty">
                  <FiAlertCircle /> No hay cobros para estos filtros.
                </p>
              ) : null}
            </div>
            <footer className="pagination">
              <span>
                Mostrando {history.pagination.from}–{history.pagination.to} de{" "}
                {history.pagination.total} comprobantes
              </span>
              <div>
                <button
                  type="button"
                  className="page"
                  aria-label="Página anterior"
                  disabled={!history.pagination.hasPreviousPage}
                  onClick={() => setHistoryPage((page) => page - 1)}
                >
                  <FiChevronLeft />
                </button>
                <b>
                  {history.pagination.page} / {history.pagination.totalPages}
                </b>
                <button
                  type="button"
                  className="page"
                  aria-label="Página siguiente"
                  disabled={!history.pagination.hasNextPage}
                  onClick={() => setHistoryPage((page) => page + 1)}
                >
                  <FiChevronRight />
                </button>
              </div>
            </footer>
          </>
        )}
      </section>
    </Container>
  );
}

const Container = styled.section`
  width: min(1380px, 100%);
  margin: 0 auto;
  display: grid;
  gap: 16px;
  color: ${({ theme }) => theme.text};
  .hero,
  .panel,
  .metric-grid article,
  .customer-checkout {
    border: 1px solid ${({ theme }) => theme.color2};
    background: ${({ theme }) => theme.bgcards};
    border-radius: 18px;
  }
  .hero {
    padding: 23px;
    background:
      linear-gradient(120deg, rgba(243, 210, 12, 0.15), transparent 48%),
      ${({ theme }) => theme.bgcards};
  }
  .eyebrow {
    display: inline-flex;
    gap: 7px;
    align-items: center;
    color: #b45309;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  h2,
  h3,
  p {
    margin: 0;
  }
  .hero h2 {
    margin: 7px 0;
    font-size: clamp(23px, 3vw, 32px);
  }
  .hero p,
  .panel header p {
    color: ${({ theme }) => theme.colorSubtitle};
    line-height: 1.45;
  }
  .metric-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }
  .metric-grid article {
    padding: 16px;
    display: grid;
    gap: 5px;
  }
  .metric-grid span,
  .metric-grid small {
    color: ${({ theme }) => theme.colorSubtitle};
  }
  .metric-grid strong {
    font-size: 23px;
  }
  .panel > header > span {
    display: grid;
    place-items: center;
    flex: none;
    width: 39px;
    height: 39px;
    border-radius: 11px;
    background: #fef3c7;
    color: #b45309;
  }
  .customer-checkout {
    padding: 15px 18px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .customer-checkout > div:first-child {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    flex: 1;
  }
  .customer-checkout > div:first-child > span {
    display: grid;
    place-items: center;
    width: 37px;
    height: 37px;
    border-radius: 11px;
    background: #e0f2fe;
    color: #0369a1;
  }
  .customer-checkout b,
  .customer-checkout small,
  .history-row b,
  .history-row small {
    display: block;
  }
  .customer-checkout small,
  .history-row small {
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 12px;
    margin-top: 3px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .customer-checkout.has-debt {
    border-color: #fecaca;
  }
  .checkout-total {
    text-align: right;
    white-space: nowrap;
  }
  .checkout-total strong {
    display: block;
    font-size: 18px;
    color: #15803d;
  }
  .has-debt .checkout-total strong {
    color: #dc2626;
  }
  .customer-checkout input,
  .customer-checkout select {
    width: 145px;
    padding: 8px;
  }
  .workspace {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
    align-items: stretch;
  }
  .panel {
    min-width: 0;
    padding: 18px;
  }
  .workspace > .panel {
    height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
  }
  .workspace > .panel form {
    flex: 1;
    align-content: start;
  }
  .workspace > .panel form > button:last-child {
    align-self: end;
  }
  .payment-focus {
    border-color: #f3d20c;
    box-shadow:
      0 0 0 4px rgba(243, 210, 12, 0.2),
      0 16px 36px rgba(15, 23, 42, 0.12);
    transition:
      border-color 180ms ease,
      box-shadow 180ms ease;
  }
  .panel > header,
  .report header {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: start;
    margin-bottom: 15px;
  }
  .panel > header > div {
    flex: 1;
    min-width: 0;
  }
  form {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  label {
    display: grid;
    gap: 6px;
    min-width: 0;
    font-size: 12px;
    font-weight: 800;
  }
  input,
  select {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    border: 1px solid ${({ theme }) => theme.color2};
    border-radius: 10px;
    background: ${({ theme }) => theme.bgtotal};
    color: ${({ theme }) => theme.text};
    padding: 11px;
  }
  .wide {
    grid-column: span 2;
  }
  .change {
    border-radius: 11px;
    background: ${({ theme }) => theme.bgtotal};
    padding: 11px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .change span {
    font-size: 12px;
    color: ${({ theme }) => theme.colorSubtitle};
  }
  .change strong {
    color: #15803d;
  }
  .account-summary {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
  .account-summary > span {
    min-width: 0;
    padding: 11px;
    border-radius: 11px;
    background: ${({ theme }) => theme.bgtotal};
  }
  .account-summary small,
  .account-summary b {
    display: block;
  }
  .account-summary small {
    color: ${({ theme }) => theme.colorSubtitle};
    margin-bottom: 4px;
  }
  .account-summary b {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .account-summary .balance b {
    color: #b45309;
  }
  button {
    border: 0;
    border-radius: 10px;
    background: ${v.colorPrincipal};
    color: #111827;
    padding: 12px;
    font-weight: 900;
    cursor: pointer;
    display: inline-flex;
    justify-content: center;
    align-items: center;
    gap: 7px;
  }
  button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .search-picker {
    position: relative;
    font-weight: 400;
  }
  .picker-control {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 45px;
    padding: 0 11px;
    border: 1px solid ${({ theme }) => theme.color2};
    border-radius: 12px;
    background: ${({ theme }) => theme.bgtotal};
    transition:
      border-color 150ms ease,
      box-shadow 150ms ease;
  }
  .picker-control:focus-within {
    border-color: #d6b900;
    box-shadow: 0 0 0 3px rgba(243, 210, 12, 0.18);
  }
  .picker-control input {
    border: 0;
    padding-inline: 0;
    outline: 0;
    background: transparent;
  }
  .picker-clear {
    width: 28px;
    height: 28px;
    padding: 0;
    border-radius: 8px;
    background: rgba(243, 210, 12, 0.16);
    color: ${({ theme }) => theme.text};
  }
  .picker-options {
    position: absolute;
    z-index: 20;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    max-height: min(330px, 48vh);
    overflow-y: auto;
    padding: 8px;
    border: 1px solid ${({ theme }) => theme.color2};
    border-radius: 14px;
    background: ${({ theme }) => theme.bgcards};
    box-shadow:
      0 20px 44px rgba(15, 23, 42, 0.2),
      0 2px 8px rgba(15, 23, 42, 0.08);
  }
  .picker-summary {
    position: sticky;
    top: -8px;
    z-index: 2;
    display: flex;
    justify-content: space-between;
    padding: 11px 8px 8px;
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 11px;
    font-weight: 800;
    background: ${({ theme }) => theme.bgcards};
  }
  .picker-options > .picker-option {
    width: 100%;
    min-width: 0 !important;
    min-height: 62px !important;
    display: grid !important;
    grid-template-columns: 38px minmax(0, 1fr) auto;
    justify-content: stretch !important;
    align-items: center !important;
    gap: 10px;
    text-align: left !important;
    margin: 3px 0;
    padding: 9px 11px !important;
    border: 1px solid transparent !important;
    border-radius: 10px !important;
    background: ${({ theme }) => theme.bgcards} !important;
    color: ${({ theme }) => theme.text} !important;
    box-shadow: none !important;
  }
  .picker-options > .picker-option:hover,
  .picker-options > .picker-option[aria-selected="true"] {
    border-color: rgba(14, 165, 233, 0.5) !important;
    background: rgba(243, 210, 12, 0.12) !important;
  }
  .picker-options > .picker-option:focus-visible {
    outline: 3px solid rgba(14, 165, 233, 0.24);
    outline-offset: 1px;
  }
  .picker-avatar {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border-radius: 10px;
    background: rgba(14, 165, 233, 0.12);
    color: #0284c7;
  }
  .picker-copy { min-width: 0; }
  .picker-copy b,
  .picker-copy small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .picker-state {
    display: grid;
    justify-items: end;
    gap: 4px;
    color: #0284c7;
  }
  .picker-state em {
    padding: 3px 7px;
    border-radius: 999px;
    background: rgba(14, 165, 233, 0.1);
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 9px;
    font-style: normal;
    font-weight: 850;
  }
  .picker-options b,
  .picker-options small {
    display: block;
  }
  .picker-options small,
  .picker-options p {
    margin-top: 3px;
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 11px;
  }
  .picker-options p,
  .picker-hint {
    padding: 12px 9px;
  }
  .form-help,
  .form-alert {
    margin: -1px 0 0;
    padding: 9px 11px;
    border-radius: 10px;
    font-size: 11px;
    line-height: 1.4;
  }
  .form-help {
    color: ${({ theme }) => theme.colorSubtitle};
    background: ${({ theme }) => theme.bgtotal};
  }
  .form-alert {
    display: flex;
    align-items: center;
    gap: 7px;
    color: #b45309;
    background: #fff7ed;
    border: 1px solid #fed7aa;
  }
  .secondary,
  .print,
  .page {
    background: ${({ theme }) => theme.bgtotal};
    color: ${({ theme }) => theme.text};
    border: 1px solid ${({ theme }) => theme.color2};
    padding: 9px 11px;
  }
  .report-actions {
    display: flex;
    gap: 8px;
    align-items: end;
    flex-wrap: wrap;
  }
  .month-filter { display:flex; align-items:end; gap:6px; }
  .month-filter label { display:grid!important; gap:4px!important; font-size:11px; font-weight:800; color:${({ theme }) => theme.colorSubtitle}; }
  .month-filter .month-label { align-self:center; min-width:105px; color:${({ theme }) => theme.colorSubtitle}; font-size:11px; text-transform:capitalize; }
  .month-nav { width:32px; height:32px; padding:0!important; border:1px solid ${({ theme }) => theme.color2}; border-radius:8px; background:${({ theme }) => theme.bgtotal}; color:${({ theme }) => theme.text}; }
  .report header label {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .report header input {
    padding: 7px;
  }
  .report header select {
    min-width: 130px;
    padding: 7px 9px;
    border: 1px solid ${({ theme }) => theme.color2};
    border-radius: 8px;
    background: ${({ theme }) => theme.bgtotal};
    color: ${({ theme }) => theme.text};
  }
  .report-table,
  .history-table {
    overflow-x: auto;
    border: 1px solid ${({ theme }) => theme.color2};
    border-radius: 12px;
  }
  .report-row {
    min-width: 720px;
    display: grid;
    grid-template-columns: 1.2fr 0.7fr 1fr 1fr 1fr;
    gap: 10px;
    padding: 12px 14px;
    border-bottom: 1px solid ${({ theme }) => theme.color2};
    font-size: 13px;
  }
  .report-row:last-child,
  .history-row:last-child {
    border: 0;
  }
  .report-row.head,
  .history-row.head {
    background: ${({ theme }) => theme.bgtotal};
    font-size: 11px;
    font-weight: 900;
    text-transform: uppercase;
  }
  .history-filters {
    display: grid;
    grid-template-columns: 1fr 220px;
    gap: 10px;
    margin-bottom: 12px;
  }
  .history-filters label {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 10px;
    border: 1px solid ${({ theme }) => theme.color2};
    border-radius: 10px;
    background: ${({ theme }) => theme.bgtotal};
  }
  .history-filters input,
  .history-filters select {
    border: 0;
    background: transparent;
    padding: 11px 0;
  }
  .history-row {
    min-width: 1120px;
    display: grid;
    grid-template-columns: 1.05fr 1.1fr 1.4fr 1.2fr 0.7fr 190px;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-bottom: 1px solid ${({ theme }) => theme.color2};
    font-size: 13px;
  }
  .receipt-actions {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .print {
    font-size: 12px;
  }
  .pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    padding-top: 12px;
    color: ${({ theme }) => theme.colorSubtitle};
    font-size: 12px;
  }
  .pagination > div {
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .page {
    padding: 7px;
  }
  .empty {
    padding: 22px;
    text-align: center;
    color: ${({ theme }) => theme.colorSubtitle};
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 7px;
  }
  @media (max-width: 900px) {
    .metric-grid,
    .workspace {
      grid-template-columns: 1fr;
    }
    .customer-checkout {
      align-items: start;
      flex-wrap: wrap;
    }
    .checkout-total {
      text-align: left;
    }
  }
  @media (max-width: 560px) {
    form,
    .account-summary {
      grid-template-columns: 1fr;
    }
    form > *,
    .account-summary {
      grid-column: span 1 !important;
    }
    .metric-grid {
      grid-template-columns: 1fr;
    }
    .report header,
    .panel > header {
      flex-direction: column;
    }
    .report-actions,
    .history-filters {
      width: 100%;
      grid-template-columns: 1fr;
    }
    .history-filters {
      display: grid;
    }
    .pagination {
      align-items: flex-start;
      flex-direction: column;
    }
  }
`;
