import { throwLocalized } from "@/lib/i18n/errors-server";
import {
  formFieldName,
  type DocumentFormAttr,
} from "@/lib/meta/document-form-shared";

export async function validateDocumentForm(
  attributes: DocumentFormAttr[],
  formData: FormData,
) {
  for (const attr of attributes) {
    if (!attr.formVisible || !attr.required) continue;
    if (attr.widget === "readonly") continue;
    const name = formFieldName(attr);
    const raw = formData.get(name);
    if (attr.type === "bool") {
      if (raw !== "on" && raw !== "true" && raw !== "1") {
        return throwLocalized("errors.meta.fillField", { name: attr.name });
      }
      continue;
    }
    const s = String(raw ?? "").trim();
    if (!s) return throwLocalized("errors.meta.fillField", { name: attr.name });
  }
}

export type { DocumentFormAttr };
