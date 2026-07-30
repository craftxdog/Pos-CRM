import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "../supabase/supabase.config";

export const useSupabaseSubscription = ({
  channelName,
  options,
  queryKey,
  enabled = true,
}) => {
  const queryClient = useQueryClient();
  const event = options?.event || "*";
  const schema = options?.schema || "public";
  const table = options?.table;
  const filter = options?.filter;
  const queryKeyHash = JSON.stringify(queryKey || []);

  useEffect(() => {
    if (!enabled || !channelName || !table) return undefined;

    const resolvedQueryKey = JSON.parse(queryKeyHash);
    const realtimeOptions = { event, schema, table };
    if (filter) realtimeOptions.filter = filter;

    const subscription = supabase
      .channel(channelName)
      .on("postgres_changes", realtimeOptions, (payload) => {
        const { eventType } = payload;
        if (["INSERT", "UPDATE", "DELETE"].includes(eventType)) {
          queryClient.invalidateQueries({ queryKey: resolvedQueryKey });
        }
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(subscription);
    };
  }, [channelName, enabled, event, filter, queryClient, queryKeyHash, schema, table]);
};
