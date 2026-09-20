"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createPortal } from "react-dom";
import {
  Field,
  buttonClass,
  buttonSecondaryClass,
  inputClass,
} from "@/components/ui";
import { CreateableSelect } from "@/components/createable-select";
import { enumLabel } from "@/lib/format";
import {
  loadQuickCreateOptions,
  quickCreateCell,
  quickCreateCounterparty,
  quickCreateLot,
  quickCreateNomenclature,
  quickCreateReceivingDock,
  quickCreateTransportUnit,
  quickCreateUnit,
  quickCreateZone,
  type QuickCreated,
} from "@/lib/quick-create-actions";

export type QuickCreateKind =
  | "nomenclature"
  | "counterparty"
  | "lot"
  | "cell"
  | "unit"
  | "zone"
  | "receivingDock"
  | "transportUnit";

type Option = { id: string; label: string };

export function QuickCreateDialog({
  kind,
  open,
  onClose,
  onCreated,
  defaults,
}: {
  kind: QuickCreateKind;
  open: boolean;
  onClose: () => void;
  onCreated: (item: QuickCreated) => void;
  defaults?: {
    productId?: string;
    counterpartyKind?: "SUPPLIER" | "CUSTOMER" | "BOTH";
  };
}) {
  const t = useTranslations("components.quickCreate");
  const tc = useTranslations("common");
  const ts = useTranslations("components.shared");
  const [pending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [units, setUnits] = useState<Option[]>([]);
  const [products, setProducts] = useState<Option[]>([]);
  const [zones, setZones] = useState<Option[]>([]);

  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [unitId, setUnitId] = useState("");
  const [barcode, setBarcode] = useState("");

  const [code, setCode] = useState("");
  const [cpKind, setCpKind] = useState<"SUPPLIER" | "CUSTOMER" | "BOTH">(
    defaults?.counterpartyKind ?? "SUPPLIER",
  );

  const [productId, setProductId] = useState(defaults?.productId ?? "");
  const [lotNumber, setLotNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  const [cellType, setCellType] = useState("STORAGE");
  const [zoneId, setZoneId] = useState("");
  const [symbol, setSymbol] = useState("");

  const [dockNotes, setDockNotes] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [driverLicense, setDriverLicense] = useState("");
  const [passport, setPassport] = useState("");
  const [carrierName, setCarrierName] = useState("");
  const [transportNotes, setTransportNotes] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSku("");
    setName("");
    setUnitId("");
    setBarcode("");
    setCode("");
    setCpKind(defaults?.counterpartyKind ?? "SUPPLIER");
    setProductId(defaults?.productId ?? "");
    setLotNumber("");
    setExpiryDate("");
    setCellType("STORAGE");
    setZoneId("");
    setSymbol("");
    setDockNotes("");
    setPlateNumber("");
    setDriverName("");
    setDriverPhone("");
    setDriverLicense("");
    setPassport("");
    setCarrierName("");
    setTransportNotes("");

    void (async () => {
      try {
        const data = await loadQuickCreateOptions(kind);
        if (data.units) setUnits(data.units);
        if (data.products) setProducts(data.products);
        if (data.zones) setZones(data.zones);
        if (data.units?.[0]) setUnitId(data.units[0].id);
      } catch (e) {
        setError(e instanceof Error ? e.message : ts("loadError"));
      }
    })();
  }, [open, kind, defaults?.productId, defaults?.counterpartyKind, ts]);

  function submit() {
    setError(null);
    if (kind === "lot" && (!productId.trim() || !lotNumber.trim())) {
      setError(t("lotProductRequired"));
      return;
    }
    if (kind === "nomenclature" && (!sku.trim() || !name.trim() || !unitId.trim())) {
      setError(t("nomenclatureRequired"));
      return;
    }
    if (kind === "counterparty" && !name.trim()) {
      setError(t("nameRequired"));
      return;
    }
    if (kind === "zone" && !name.trim()) {
      setError(t("nameRequired"));
      return;
    }
    if (kind === "cell" && (!code.trim() || !name.trim() || !zoneId.trim())) {
      setError(t("cellRequired"));
      return;
    }
    if (kind === "receivingDock" && !name.trim()) {
      setError(t("dockNameRequired"));
      return;
    }
    if (
      kind === "transportUnit" &&
      (!plateNumber.trim() || !driverName.trim())
    ) {
      setError(t("transportRequired"));
      return;
    }
    startTransition(async () => {
      try {
        let created: QuickCreated;
        if (kind === "nomenclature") {
          created = await quickCreateNomenclature({
            sku,
            name,
            unitId,
            barcode,
          });
        } else if (kind === "counterparty") {
          created = await quickCreateCounterparty({
            name,
            kind: cpKind,
          });
        } else if (kind === "lot") {
          created = await quickCreateLot({
            productId,
            number: lotNumber,
            expiryDate: expiryDate || undefined,
          });
        } else if (kind === "cell") {
          created = await quickCreateCell({
            code,
            name,
            zoneId,
          });
        } else if (kind === "unit") {
          created = await quickCreateUnit({
            name,
            symbol,
          });
        } else if (kind === "receivingDock") {
          created = await quickCreateReceivingDock({
            name,
            zoneId: zoneId || undefined,
            notes: dockNotes || undefined,
          });
        } else if (kind === "transportUnit") {
          created = await quickCreateTransportUnit({
            plateNumber,
            driverName,
            driverPhone: driverPhone || undefined,
            driverLicense: driverLicense || undefined,
            passport: passport || undefined,
            carrierName: carrierName || undefined,
            notes: transportNotes || undefined,
          });
        } else {
          created = await quickCreateZone({ name, type: cellType });
        }
        onCreated(created);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("saveError"));
      }
    });
  }

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-[var(--line)] bg-[var(--panel)] shadow-xl">
        <div className="border-b border-[var(--line)] px-4 py-3">
          <h3 className="text-sm font-semibold">{t(`titles.${kind}`)}</h3>
          <p className="mt-0.5 text-xs text-[var(--muted)]">{t("hint")}</p>
        </div>
        <div className="space-y-3 p-4">
          {kind === "nomenclature" ? (
            <>
              <Field label={t("sku")}>
                <input
                  className={inputClass}
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  autoFocus
                />
              </Field>
              <Field label={t("name")}>
                <input
                  className={inputClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field label={t("unit")}>
                <select
                  className={inputClass}
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                >
                  <option value="">—</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("barcode")}>
                <input
                  className={inputClass}
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                />
              </Field>
            </>
          ) : null}

          {kind === "counterparty" ? (
            <>
              <Field label={t("name")}>
                <input
                  className={inputClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </Field>
              <Field label={t("counterpartyType")}>
                <select
                  className={inputClass}
                  value={cpKind}
                  onChange={(e) =>
                    setCpKind(e.target.value as "SUPPLIER" | "CUSTOMER" | "BOTH")
                  }
                >
                  <option value="SUPPLIER">{enumLabel("SUPPLIER")}</option>
                  <option value="CUSTOMER">{enumLabel("CUSTOMER")}</option>
                  <option value="BOTH">{enumLabel("BOTH")}</option>
                </select>
              </Field>
            </>
          ) : null}

          {kind === "lot" ? (
            <>
              <Field label={t("product")}>
                {defaults?.productId ? (
                  <>
                    <input type="hidden" value={productId} readOnly />
                    <p className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm">
                        {products.find((p) => p.id === productId)?.label ??
                        t("selectedProduct")}
                    </p>
                  </>
                ) : (
                  <select
                    className={inputClass}
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                  >
                    <option value="">—</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label={t("lotNumber")}>
                <input
                  className={inputClass}
                  value={lotNumber}
                  onChange={(e) => setLotNumber(e.target.value)}
                  autoFocus
                />
              </Field>
              <Field label={t("expiryDate")}>
                <input
                  className={inputClass}
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </Field>
            </>
          ) : null}

          {kind === "cell" ? (
            <>
              <Field label={t("cellCode")}>
                <input
                  className={inputClass}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoFocus
                />
              </Field>
              <Field label={t("name")}>
                <input
                  className={inputClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field label={t("zone")}>
                <select
                  className={inputClass}
                  value={zoneId}
                  onChange={(e) => setZoneId(e.target.value)}
                >
                  <option value="">—</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.label}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          ) : null}

          {kind === "unit" ? (
            <>
              <Field label={t("name")}>
                <input
                  className={inputClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </Field>
              <Field label={t("symbol")}>
                <input
                  className={inputClass}
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                />
              </Field>
            </>
          ) : null}

          {kind === "zone" ? (
            <>
              <Field label={t("name")}>
                <input
                  className={inputClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </Field>
              <Field label={t("storageType")}>
                <select
                  className={inputClass}
                  value={cellType}
                  onChange={(e) => setCellType(e.target.value)}
                >
                  {["RECEIVING", "STORAGE", "SHIPPING", "QUARANTINE"].map(
                    (t) => (
                      <option key={t} value={t}>
                        {enumLabel(t)}
                      </option>
                    ),
                  )}
                </select>
              </Field>
            </>
          ) : null}

          {kind === "receivingDock" ? (
            <>
              <Field label={t("name")}>
                <input
                  className={inputClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </Field>
              <Field label={t("warehouseZone")}>
                <CreateableSelect
                  value={zoneId}
                  createKind="zone"
                  createLabel={t("createZone")}
                  emptyLabel={t("noZoneBinding")}
                  showAll={false}
                  options={zones}
                  onChange={setZoneId}
                  onCreated={(item) => {
                    setZones((prev) =>
                      prev.some((zone) => zone.id === item.id)
                        ? prev
                        : [...prev, { id: item.id, label: item.label }],
                    );
                    setZoneId(item.id);
                  }}
                />
              </Field>
              <Field label={t("note")}>
                <input
                  className={inputClass}
                  value={dockNotes}
                  onChange={(e) => setDockNotes(e.target.value)}
                />
              </Field>
            </>
          ) : null}

          {kind === "transportUnit" ? (
            <>
              <Field label={t("plateNumber")}>
                <input
                  className={inputClass}
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value)}
                  autoFocus
                />
              </Field>
              <Field label={t("driverName")}>
                <input
                  className={inputClass}
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                />
              </Field>
              <Field label={t("driverPhone")}>
                <input
                  className={inputClass}
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                />
              </Field>
              <Field label={t("driverLicense")}>
                <input
                  className={inputClass}
                  value={driverLicense}
                  onChange={(e) => setDriverLicense(e.target.value)}
                />
              </Field>
              <Field label={t("passport")}>
                <input
                  className={inputClass}
                  value={passport}
                  onChange={(e) => setPassport(e.target.value)}
                />
              </Field>
              <Field label={t("carrier")}>
                <input
                  className={inputClass}
                  value={carrierName}
                  onChange={(e) => setCarrierName(e.target.value)}
                />
              </Field>
              <Field label={t("note")}>
                <input
                  className={inputClass}
                  value={transportNotes}
                  onChange={(e) => setTransportNotes(e.target.value)}
                />
              </Field>
            </>
          ) : null}

          {error ? <p className="text-sm text-rose-700">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              className={buttonSecondaryClass}
              onClick={onClose}
              disabled={pending}
            >
              {tc("cancel")}
            </button>
            <button
              type="button"
              className={buttonClass}
              disabled={pending}
              onClick={submit}
            >
              {pending ? ts("saving") : ts("create")}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
