"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createApiKeyAction } from "@/lib/integration/actions";
import { buttonClass, inputClass } from "@/components/ui";

export function CreateApiKeyForm() {
  const t = useTranslations("components.createApiKey");
  const [key, setKey] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const created = await createApiKeyAction(fd);
    setKey(created);
    setPending(false);
    e.currentTarget.reset();
  }

  return (
    <div className="space-y-2">
      <form onSubmit={onSubmit} className="flex flex-wrap gap-2">
        <input
          className={inputClass}
          name="name"
          placeholder={t("namePlaceholder")}
          defaultValue={t("defaultName")}
        />
        <button className={buttonClass} type="submit" disabled={pending}>
          {t("submit")}
        </button>
      </form>
      {key ? (
        <p className="break-all rounded-lg bg-[var(--surface)] p-3 text-sm">
          {t("created", { key })}
        </p>
      ) : null}
    </div>
  );
}
