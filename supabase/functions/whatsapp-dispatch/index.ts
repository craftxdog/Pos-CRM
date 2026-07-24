import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type DispatchPayload = {
  message_id?: number;
  mode?: "template" | "text";
  dry_run?: boolean;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

async function hmacHex(value: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing Authorization header" }, 401);
    }

    const body = (await req.json()) as DispatchPayload;
    const messageId = Number(body.message_id);
    if (!Number.isFinite(messageId) || messageId <= 0) {
      return jsonResponse({ error: "message_id is required" }, 400);
    }

    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const anonKey = requiredEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: message, error: messageError } = await userClient
      .from("crm_whatsapp_mensajes")
      .select("*")
      .eq("id", messageId)
      .maybeSingle();

    if (messageError) throw messageError;
    if (!message) return jsonResponse({ error: "Message not found" }, 404);
    if (!["borrador", "pendiente", "error"].includes(message.estado)) {
      return jsonResponse({ error: "Message is not dispatchable" }, 409);
    }

    const { data: config, error: configError } = await userClient
      .from("crm_whatsapp_config")
      .select("*")
      .eq("id_empresa", message.id_empresa)
      .maybeSingle();

    if (configError) throw configError;
    if (!config || config.estado !== "conectado") {
      return jsonResponse({ error: "WhatsApp is not connected for this company" }, 409);
    }

    const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const phoneNumberId = config.phone_number_id || Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    const graphVersion = Deno.env.get("WHATSAPP_GRAPH_API_VERSION");

    if (body.dry_run) {
      return jsonResponse({ ok: true, dry_run: true, provider: config.proveedor, message });
    }

    if (config.proveedor === "manual") {
      return jsonResponse({ error: "Manual delivery must be marked from the CRM" }, 409);
    }

    if (config.proveedor === "openwa_n8n") {
      const webhookUrl = Deno.env.get("N8N_WHATSAPP_WEBHOOK_URL");
      const webhookSecret = Deno.env.get("N8N_WHATSAPP_WEBHOOK_SECRET");
      if (!webhookUrl || !webhookSecret) {
        return jsonResponse(
          { error: "Configure N8N_WHATSAPP_WEBHOOK_URL and N8N_WHATSAPP_WEBHOOK_SECRET" },
          412
        );
      }

      const timestamp = Math.floor(Date.now() / 1000).toString();
      const n8nPayload = JSON.stringify({
        event: "crm.whatsapp.dispatch",
        message_id: message.public_id || message.id,
        legacy_message_id: message.id,
        company_id: message.id_empresa,
        session_id: config.metadata?.openwa_session_id || "default",
        to: `${digitsOnly(message.destino)}@c.us`,
        text: message.cuerpo,
        template: message.plantilla,
        mode: body.mode || (message.plantilla ? "template" : "text"),
      });
      const signature = await hmacHex(`${timestamp}.${n8nPayload}`, webhookSecret);
      const n8nResponse = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-ASC-Timestamp": timestamp,
          "X-ASC-Signature": `sha256=${signature}`,
        },
        body: n8nPayload,
      });
      const responseText = await n8nResponse.text();
      let providerResult: Record<string, unknown> = {};
      try {
        providerResult = responseText ? JSON.parse(responseText) : {};
      } catch {
        providerResult = { response: responseText };
      }

      if (!n8nResponse.ok) {
        await adminClient
          .from("crm_whatsapp_mensajes")
          .update({ estado: "error", error: JSON.stringify(providerResult) })
          .eq("id", messageId);
        return jsonResponse({ error: "n8n/OpenWA rejected the message", providerResult }, 502);
      }

      const providerMessageId =
        providerResult.message_id || providerResult.id || providerResult.data || null;
      await adminClient
        .from("crm_whatsapp_mensajes")
        .update({
          estado: "enviado",
          sent_at: new Date().toISOString(),
          provider_message_id: providerMessageId ? String(providerMessageId) : null,
          error: null,
        })
        .eq("id", messageId);
      return jsonResponse({ ok: true, provider: "openwa_n8n", providerResult });
    }

    if (config.proveedor !== "meta_cloud") {
      return jsonResponse({ error: `Unsupported WhatsApp provider: ${config.proveedor}` }, 422);
    }

    if (!token || !phoneNumberId || !graphVersion) {
      return jsonResponse(
        {
          error:
            "WhatsApp credentials are missing. Configure WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_GRAPH_API_VERSION.",
        },
        412
      );
    }

    const mode = body.mode || (message.plantilla ? "template" : "text");
    const to = digitsOnly(message.destino);
    let payload: Record<string, unknown>;

    if (mode === "template" && message.plantilla) {
      const { data: template } = await userClient
        .from("crm_whatsapp_plantillas")
        .select("*")
        .eq("id_empresa", message.id_empresa)
        .or(`meta_template_name.eq.${message.plantilla},nombre.eq.${message.plantilla}`)
        .maybeSingle();

      const variables = message.variables || {};
      const names = Array.isArray(template?.variables) ? template.variables : [];
      const parameters = names.map((name: string) => ({
        type: "text",
        text: String(variables[name] || ""),
      }));

      payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "template",
        template: {
          name: template?.meta_template_name || message.plantilla,
          language: { code: template?.idioma || config.default_language || "es" },
          ...(parameters.length
            ? { components: [{ type: "body", parameters }] }
            : {}),
        },
      };
    } else {
      payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: {
          preview_url: false,
          body: message.cuerpo,
        },
      };
    }

    const response = await fetch(
      `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );
    const providerResult = await response.json();

    if (!response.ok) {
      const errorText = JSON.stringify(providerResult);
      await adminClient
        .from("crm_whatsapp_mensajes")
        .update({ estado: "error", error: errorText })
        .eq("id", messageId);
      return jsonResponse({ error: "WhatsApp provider rejected the message", providerResult }, 502);
    }

    await adminClient
      .from("crm_whatsapp_mensajes")
      .update({
        estado: "enviado",
        sent_at: new Date().toISOString(),
        provider_message_id: providerResult?.messages?.[0]?.id || null,
        error: null,
      })
      .eq("id", messageId);

    return jsonResponse({ ok: true, providerResult });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
