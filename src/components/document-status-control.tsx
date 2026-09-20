"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { StatusBadge, buttonSecondaryClass } from "@/components/ui";
import {
  inboundFieldLabelClass,
  inboundFieldValueClass,
  inboundStatusBadgeClass,
} from "@/lib/inbound-field-styles";
import { useStatusCatalog } from "@/components/status-styles-provider";
import { statusLabelFallback } from "@/lib/status/labels";
import { executeDocumentTransition } from "@/lib/module-actions";
import type { DocumentStatusTransition } from "@/lib/document-status-ui";

export function DocumentStatusControl({
  entityCode,
  documentId,
  status,
  transitions,
}: {
  entityCode: string;
  documentId: string;
  status: string;
  transitions: DocumentStatusTransition[];
}) {
  const router = useRouter();
  const catalog = useStatusCatalog();
  const t = useTranslations("components.documentStatus");
  const [pending, startTransition] = useTransition();

  function labelFor(code: string, fallback?: string) {
    return catalog[code]?.name ?? fallback ?? statusLabelFallback(code);
  }

  return (
    <div>
      <dt className={inboundFieldLabelClass}>{t("status")}</dt>
      <dd className={inboundFieldValueClass}>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            status={status}
            label={labelFor(status)}
            className={inboundStatusBadgeClass}
          />
          {transitions.map((transition) => (
            <form
              key={`${transition.transitionId}:${transition.toStatusCode}`}
              action={(formData) => {
                startTransition(async () => {
                  await executeDocumentTransition(formData);
                  router.refresh();
                });
              }}
            >
              <input type="hidden" name="entityCode" value={entityCode} />
              <input type="hidden" name="documentId" value={documentId} />
              <input
                type="hidden"
                name="transitionId"
                value={transition.transitionId}
              />
              <input
                type="hidden"
                name="toStatusCode"
                value={transition.toStatusCode}
              />
              <button
                type="submit"
                className={buttonSecondaryClass}
                disabled={pending}
              >
                {transition.label || labelFor(transition.toStatusCode)}
              </button>
            </form>
          ))}
        </div>
      </dd>
    </div>
  );
}
