const CATALOG_IMAGE_ENTITIES = new Set(["categorias", "metodospago"]);
const LEGACY_CATALOG_STORAGE_URL =
  /\/storage\/v1\/object\/(?:public\/)?imagenes\/(?:categorias|metodospago)\//i;

function requiredNumericId(value, label) {
  const normalized = String(value ?? "").trim();
  if (!/^\d+$/.test(normalized) || Number(normalized) <= 0) {
    throw new Error(`${label} no es válido para guardar la imagen.`);
  }
  return normalized;
}

export function hasImageFile(file) {
  return Boolean(
    file &&
      typeof file === "object" &&
      Number.isFinite(Number(file.size)) &&
      Number(file.size) > 0
  );
}

export function buildCatalogImagePath({ companyId, entity, recordId }) {
  const normalizedCompanyId = requiredNumericId(companyId, "La empresa");
  const normalizedRecordId = requiredNumericId(recordId, "El registro");

  if (!CATALOG_IMAGE_ENTITIES.has(entity)) {
    throw new Error("El tipo de imagen no es válido.");
  }

  return `empresa/${normalizedCompanyId}/${entity}/${normalizedRecordId}`;
}

export function getSafeImageUrl(value) {
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  if (!normalized || normalized === "-" || normalized === "undefined") {
    return null;
  }
  if (LEGACY_CATALOG_STORAGE_URL.test(normalized)) return null;
  if (/^(?:data:image\/|blob:|https:\/\/)/i.test(normalized)) {
    return normalized;
  }

  return null;
}
