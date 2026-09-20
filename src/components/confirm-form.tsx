"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

type FormAction = (formData: FormData) => void | Promise<void>;

export function ConfirmForm({
  action,
  message,
  className,
  children,
}: {
  action: FormAction;
  message?: string;
  className?: string;
  children: ReactNode;
}) {
  const t = useTranslations("components.confirmForm");
  const confirmMessage = message ?? t("defaultMessage");

  return (
    <form
      action={action}
      className={className}
      onSubmit={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      {children}
    </form>
  );
}
