const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function resolveAppSiteUrl(
  value,
  { allowLocal = false } = {},
) {
  const configuredValue = value?.trim();
  if (!configuredValue) {
    throw new Error(
      "Falta configurar APP_SITE_URL con el dominio público de la aplicación",
    );
  }

  let siteUrl;
  try {
    siteUrl = new URL(configuredValue);
  } catch {
    throw new Error("APP_SITE_URL no contiene una URL válida");
  }

  if (!["http:", "https:"].includes(siteUrl.protocol)) {
    throw new Error("APP_SITE_URL debe usar http o https");
  }
  if (siteUrl.username || siteUrl.password) {
    throw new Error("APP_SITE_URL no debe incluir credenciales");
  }

  const isLocal =
    LOCAL_HOSTNAMES.has(siteUrl.hostname) ||
    siteUrl.hostname.endsWith(".localhost");
  if (isLocal && !allowLocal) {
    throw new Error(
      "APP_SITE_URL no puede apuntar a localhost fuera del entorno de desarrollo",
    );
  }

  return siteUrl.origin;
}
