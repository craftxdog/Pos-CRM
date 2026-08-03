import { buildCatalogImagePath, hasImageFile } from "../utils/catalogImages";
import { supabase } from "./supabase.config";

const BUCKET = "imagenes";

export async function uploadCatalogImage({
  companyId,
  entity,
  recordId,
  file,
}) {
  if (!hasImageFile(file)) return null;

  const path = buildCatalogImagePath({ companyId, entity, recordId });
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type || undefined,
    upsert: true,
  });

  if (error) {
    throw new Error(`No se pudo guardar la imagen: ${error.message}`);
  }

  const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path)?.data
    ?.publicUrl;
  if (!publicUrl) {
    throw new Error("Supabase no devolvió la URL pública de la imagen.");
  }

  return { path, publicUrl };
}

export async function removeCatalogImage({ companyId, entity, recordId }) {
  const path = buildCatalogImagePath({ companyId, entity, recordId });
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) {
    throw new Error(`No se pudo eliminar la imagen: ${error.message}`);
  }
}
