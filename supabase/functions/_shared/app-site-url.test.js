import assert from "node:assert/strict";
import test from "node:test";
import { resolveAppSiteUrl } from "./app-site-url.js";

test("normaliza APP_SITE_URL al origen público", () => {
  assert.equal(
    resolveAppSiteUrl("https://agogesistem.alphaby.cloud/ruta?x=1"),
    "https://agogesistem.alphaby.cloud",
  );
});

test("rechaza localhost por defecto", () => {
  assert.throws(
    () => resolveAppSiteUrl("http://localhost:5173"),
    /no puede apuntar a localhost/,
  );
});

test("permite localhost solo al habilitar desarrollo", () => {
  assert.equal(
    resolveAppSiteUrl("http://localhost:5173/login", { allowLocal: true }),
    "http://localhost:5173",
  );
});

test("exige una URL configurada", () => {
  assert.throws(
    () => resolveAppSiteUrl(undefined),
    /Falta configurar APP_SITE_URL/,
  );
});
