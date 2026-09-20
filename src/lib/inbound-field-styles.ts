/** Единая высота контролов в блоке реквизитов приёмки (поля + бейдж статуса). */
export const inboundFieldControlHeightClass = "h-[34px] box-border";

export const inboundFieldLabelClass =
  "text-[11px] leading-tight text-[var(--muted)]";

export const inboundFieldValueClass = "mt-0.5";

export const inboundFieldInputClass = [
  "w-full rounded-md border border-[var(--line)] bg-white px-2.5 py-0",
  "font-sans text-sm leading-none",
  "outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20",
  inboundFieldControlHeightClass,
].join(" ");

export const inboundStatusBadgeClass = [
  "inline-flex items-center justify-center rounded-md px-2.5 !py-0",
  "!text-sm !font-medium leading-none",
  inboundFieldControlHeightClass,
].join(" ");
