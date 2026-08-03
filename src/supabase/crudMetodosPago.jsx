import { hasImageFile } from "../utils/catalogImages";
import { uploadCatalogImage, removeCatalogImage } from "./catalogImageStorage";
import { supabase } from "./supabase.config";

const tabla = "metodos_pago";

async function editarIconoMetodoPago(id, icono) {
  const { error } = await supabase
    .from(tabla)
    .update({ icono })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function MostrarMetodosPago(p) {
  if (!p?.id_empresa) return [];

  const { data, error } = await supabase
    .from(tabla)
    .select()
    .eq("id_empresa", p.id_empresa);
  if (error) throw new Error(error.message);
  return data;
}

export async function InsertarMetodosPago(p, file) {
  const { error, data } = await supabase
    .from(tabla)
    .insert(p)
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (hasImageFile(file)) {
    const image = await uploadCatalogImage({
      companyId: p.id_empresa,
      entity: "metodospago",
      recordId: data.id,
      file,
    });
    await editarIconoMetodoPago(data.id, image.publicUrl);
  }
}

export async function EditarMetodosPago(p, filenew) {
  const { id, id_empresa: companyId, ...changes } = p;
  const { error } = await supabase.from(tabla).update(changes).eq("id", id);
  if (error) throw new Error(error.message);

  if (hasImageFile(filenew)) {
    const image = await uploadCatalogImage({
      companyId,
      entity: "metodospago",
      recordId: id,
      file: filenew,
    });
    await editarIconoMetodoPago(id, image.publicUrl);
  }
}

export async function EliminarMetodosPago(p) {
  const { error } = await supabase.from(tabla).delete().eq("id", p.id);
  if (error) throw new Error(error.message);

  if (p.id_empresa && p.icono && p.icono !== "-") {
    await removeCatalogImage({
      companyId: p.id_empresa,
      entity: "metodospago",
      recordId: p.id,
    });
  }
}
