import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCatalogImagePath,
  getSafeImageUrl,
  hasImageFile,
} from "./catalogImages.js";

test("buildCatalogImagePath scopes catalog images to the company", () => {
  assert.equal(
    buildCatalogImagePath({
      companyId: 9,
      entity: "metodospago",
      recordId: 14,
    }),
    "empresa/9/metodospago/14"
  );
});

test("buildCatalogImagePath rejects missing ids and unknown entities", () => {
  assert.throws(
    () =>
      buildCatalogImagePath({
        companyId: 9,
        entity: "metodospago",
        recordId: undefined,
      }),
    /registro no es válido/i
  );
  assert.throws(
    () =>
      buildCatalogImagePath({ companyId: 9, entity: "otros", recordId: 1 }),
    /tipo de imagen no es válido/i
  );
});

test("getSafeImageUrl blocks broken legacy storage urls", () => {
  assert.equal(getSafeImageUrl(undefined), null);
  assert.equal(getSafeImageUrl("-"), null);
  assert.equal(
    getSafeImageUrl(
      "https://example.supabase.co/storage/v1/object/imagenes/metodospago/undefined"
    ),
    null
  );
  assert.equal(
    getSafeImageUrl(
      "https://example.supabase.co/storage/v1/object/public/imagenes/categorias/1"
    ),
    null
  );
  assert.equal(
    getSafeImageUrl(
      "https://example.supabase.co/storage/v1/object/public/imagenes/empresa/9/categorias/1"
    ),
    "https://example.supabase.co/storage/v1/object/public/imagenes/empresa/9/categorias/1"
  );
});

test("hasImageFile only accepts non-empty file-like values", () => {
  assert.equal(hasImageFile([]), false);
  assert.equal(hasImageFile({ size: 0 }), false);
  assert.equal(hasImageFile({ size: 32 }), true);
});
