import "server-only";
import { fail, file } from "@/lib/form";
import { addDocument } from "@/services/documents";

/**
 * Resolve o anexo de um formulário (ingresso, voucher, recibo):
 * arquivo novo → substitui; caixa "remover" marcada → desvincula; senão mantém `current`.
 * O documento antigo continua na Central de documentos (nada é apagado do disco aqui).
 */
export async function attachmentFromForm(opts: {
  tripId: string;
  formData: FormData;
  fileField: string;
  removeField?: string;
  doc: { type: "TICKET" | "RESERVATION" | "RECEIPT"; title: string };
  back: string;
  current: string | null;
}): Promise<string | null> {
  const upload = file(opts.formData, opts.fileField);
  if (upload) {
    try {
      const doc = await addDocument(opts.tripId, upload, opts.doc);
      return doc.id;
    } catch (e) {
      fail(opts.back, e instanceof Error ? e.message : "Falha no upload do arquivo.");
    }
  }
  if (opts.removeField && opts.formData.get(opts.removeField) === "on") return null;
  return opts.current;
}
