"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { inputClass, StatusBadge } from "@/components/ui";
import { useStatusCatalog } from "@/components/status-styles-provider";
import { statusLabelFallback } from "@/lib/status/labels";
import { updateInboundDocumentStatus } from "@/lib/module-actions";

export function InboundStatusSelect({
  documentId,
  status,
  options,
}: {
  documentId: string;
  status: string;
  options: string[];
}) {
  const router = useRouter();
  const catalog = useStatusCatalog();
  const [pending, startTransition] = useTransition();
  const locked = options.length <= 1;

  function labelFor(code: string) {
    return catalog[code]?.name ?? statusLabelFallback(code);
  }

  return (
    <div className="space-y-2">
      <StatusBadge status={status} label={labelFor(status)} />
      <form
      action={(formData) => {
        startTransition(async () => {
          await updateInboundDocumentStatus(formData);
          router.refresh();
        });
      }}
    >
      <input type="hidden" name="documentId" value={documentId} />
      <select
        key={status}
        className={inputClass}
        name="status"
        defaultValue={status}
        disabled={locked || pending}
        onChange={(e) => {
          if (e.target.value === status) return;
          e.currentTarget.form?.requestSubmit();
        }}
      >
        {options.map((value) => (
          <option key={value} value={value}>
            {labelFor(value)}
          </option>
        ))}
      </select>
    </form>
    </div>
  );
}
