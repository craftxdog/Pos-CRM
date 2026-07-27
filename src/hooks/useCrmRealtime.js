import { useEffect } from "react";
import { supabase } from "../supabase/supabase.config";

const CRM_TABLES = [
  "crm_invitaciones",
  "crm_horarios",
  "clientes_crm",
  "crm_suscripciones",
  "crm_pagos",
  "crm_comprobantes_cobro",
  "crm_asistencias",
];

const CRM_QUERY_KEYS = [
  "crm-data",
  "crm-clients-directory",
  "crm-invitations-directory",
  "crm-subscriptions",
  "crm-payment-history",
  "crm-monthly-income",
  "crm-attendance-clients",
  "crm-schedules-directory",
];

/**
 * Refreshes tenant-scoped CRM queries when a permitted Postgres change arrives.
 * Realtime applies the same RLS policies as the regular Supabase client; no data
 * is emitted to a different company and no Socket.IO server is required.
 */
export function useCrmRealtime(idEmpresa, queryClient) {
  useEffect(() => {
    if (!idEmpresa || !queryClient) return undefined;
    let refreshTimer;
    const refresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        CRM_QUERY_KEYS.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: [key] });
        });
      }, 120);
    };
    const channel = CRM_TABLES.reduce(
      (subscription, table) => subscription.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `id_empresa=eq.${idEmpresa}` },
        refresh
      ),
      supabase.channel(`crm:${idEmpresa}:changes`)
    ).subscribe();

    return () => {
      window.clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, [idEmpresa, queryClient]);
}
