"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Field,
  Panel,
  buttonClass,
  buttonSecondaryClass,
  inputClass,
} from "@/components/ui";
import { resolveLotAccountingPolicy } from "@/lib/accounting-model";
import {
  hasProductShelfLife,
  peerDateFromShelfLife,
} from "@/lib/lot-dates";

import { tsdFetch } from "@/lib/tsd/client-api";

const DEVICE_KEY = "wms.tsd.deviceKey";

/** order → cell → pallet (ТН) → product scan loop → after pallet done */
type Step = "order" | "cell" | "tn" | "scan" | "next";

type PackageInfo = {
  id: string;
  name: string;
  factor: number;
  barcode: string | null;
  unit?: { name: string; symbol: string | null } | null;
};

type AccountingModelInfo = {
  id: string;
  code: string;
  name: string;
  useLots: boolean;
  useExpiry: boolean;
  useSerial: boolean;
  lotNameTemplate: string | null;
};

type OrderLine = {
  id: string;
  quantity: number;
  lotId: string | null;
  lotNumber: string | null;
  expiryDate: string | null;
  packageId: string | null;
  package: PackageInfo | null;
  lot: {
    id: string;
    number: string;
    expiryDate: string | null;
  } | null;
  product: {
    id: string;
    sku: string;
    name: string;
    barcode: string | null;
    unitId?: string | null;
    trackLots: boolean;
    trackExpiry?: boolean;
    shelfLifeDays?: number | null;
    shelfLifeUnit?: string | null;
    accountingModelId?: string | null;
    accountingModel?: AccountingModelInfo | null;
    packages?: PackageInfo[];
  };
};

type Order = {
  id: string;
  number: string;
  supplier: string | null;
  lines: OrderLine[];
};

type Tn = {
  id: string;
  code: string;
  barcode: string | null;
};

function lineLotNumber(line: OrderLine | undefined | null) {
  if (!line) return "";
  return (line.lotNumber || line.lot?.number || "").trim();
}

function lineExpiryDate(line: OrderLine | undefined | null) {
  if (!line) return "";
  const raw = line.expiryDate || line.lot?.expiryDate;
  if (!raw) return "";
  return String(raw).slice(0, 10);
}

function packageLabel(
  pkg: PackageInfo | null | undefined,
  baseUnitLabel: string,
) {
  if (!pkg) return baseUnitLabel;
  return pkg.name;
}

function toPackageInfo(
  raw: unknown,
  defaultPackageName: string,
): PackageInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const id = String(p.id ?? "");
  if (!id) return null;
  return {
    id,
    name: String(p.name ?? defaultPackageName),
    factor: Number(p.factor) || 1,
    barcode: (p.barcode as string | null) ?? null,
    unit: (p.unit as PackageInfo["unit"]) ?? null,
  };
}

function packagesFromProduct(
  product: {
    packages?: unknown[] | PackageInfo[];
  } | null | undefined,
  defaultPackageName: string,
): PackageInfo[] {
  if (!product?.packages?.length) return [];
  return product.packages
    .map((p) => toPackageInfo(p, defaultPackageName))
    .filter((p): p is PackageInfo => Boolean(p));
}

async function api(path: string, init?: RequestInit) {
  return tsdFetch(path, init);
}

export function TsdReceiveWizard({
  lotsEnabled = false,
  showPutawayAfterReceive = true,
}: {
  lotsEnabled?: boolean;
  showPutawayAfterReceive?: boolean;
}) {
  const t = useTranslations("components.tsdReceive");
  const ts = useTranslations("components.shared");
  const [step, setStep] = useState<Step>("order");
  const [orders, setOrders] = useState<Order[]>([]);
  const [order, setOrder] = useState<Order | null>(null);
  const [tn, setTn] = useState<Tn | null>(null);
  const [tnScan, setTnScan] = useState("");
  const [cellCode, setCellCode] = useState("");
  const [productCode, setProductCode] = useState("");
  const [selectedLineId, setSelectedLineId] = useState("");
  const [availablePackages, setAvailablePackages] = useState<PackageInfo[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [creatingPackage, setCreatingPackage] = useState(false);
  const [newPkgFactor, setNewPkgFactor] = useState("10");
  const [newPkgUnitId, setNewPkgUnitId] = useState("");
  const [units, setUnits] = useState<
    Array<{ id: string; label: string; name: string; symbol: string | null }>
  >([]);
  const [defaultUnitId, setDefaultUnitId] = useState("");
  const [resolvedProductId, setResolvedProductId] = useState("");
  const [qty, setQty] = useState("1");
  const [lotNumber, setLotNumber] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [manufacturedAt, setManufacturedAt] = useState("");
  const [plannedLotHint, setPlannedLotHint] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [received, setReceived] = useState<Record<string, number>>({});
  /** На текущей паллете уже есть принятый товар в этой сессии */
  const [palletHasGoods, setPalletHasGoods] = useState(false);
  const [, setPalletAccepted] = useState(false);

  useEffect(() => {
    void reloadOrders();
    void loadUnits();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  async function loadUnits() {
    try {
      const data = await api("/api/tsd/units");
      setUnits(Array.isArray(data) ? data : []);
    } catch {
      setUnits([]);
    }
  }

  async function reloadOrders() {
    try {
      const ords = await api("/api/tsd/orders?type=inbound");
      setOrders(Array.isArray(ords) ? ords : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : ts("loadError"));
    }
  }

  /** Вернуться к списку заказов с актуальной выгрузкой (принятые уже не показываются). */
  async function goToOrders() {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      await reloadOrders();
      setOrder(null);
      setTn(null);
      setTnScan("");
      setCellCode("");
      setSessionId(null);
      setReceived({});
      setPalletHasGoods(false);
      setPalletAccepted(false);
      clearScanFields();
      setStep("order");
    } catch (e) {
      setError(e instanceof Error ? e.message : ts("loadError"));
    } finally {
      setPending(false);
    }
  }

  const selectedLine = useMemo(
    () => order?.lines.find((l) => l.id === selectedLineId) ?? null,
    [order, selectedLineId],
  );

  const activeProduct = useMemo(() => {
    if (selectedLine) return selectedLine.product;
    if (!order || !resolvedProductId) return null;
    return (
      order.lines.find((l) => l.product.id === resolvedProductId)?.product ??
      null
    );
  }, [order, resolvedProductId, selectedLine]);

  const displayPackage = useMemo(() => {
    if (!selectedPackageId) return null;
    return (
      availablePackages.find((p) => p.id === selectedPackageId) ?? null
    );
  }, [availablePackages, selectedPackageId]);

  const lotPolicy = useMemo(
    () => resolveLotAccountingPolicy(activeProduct),
    [activeProduct],
  );

  const showLotFields = lotsEnabled && lotPolicy.useLots;
  const showSerial = showLotFields && lotPolicy.useSerial;
  const showLotNumber = showLotFields && !lotPolicy.useSerial;
  /** Номер партии по шаблону модели — поле ввода на ТСД не показываем. */
  const lotFromTemplate =
    showLotNumber && Boolean(lotPolicy.lotNameTemplate);
  const showExpiry = showLotFields && lotPolicy.useExpiry;
  const productShelfLifeDays = activeProduct?.shelfLifeDays ?? null;
  const productShelfLifeUnit = activeProduct?.shelfLifeUnit ?? "DAY";
  const shelfLifeConfigured = hasProductShelfLife(productShelfLifeDays);

  const lotRequired =
    showLotFields &&
    (showSerial || (showLotNumber && !lotFromTemplate));

  function onExpiryChange(value: string) {
    setExpiryDate(value);
    if (
      shelfLifeConfigured &&
      value &&
      productShelfLifeDays &&
      productShelfLifeDays
    ) {
      setManufacturedAt(
        peerDateFromShelfLife({
          source: "expiry",
          value,
          shelfLifeDays: productShelfLifeDays,
          shelfLifeUnit: productShelfLifeUnit,
        }),
      );
    }
  }

  function onManufacturedChange(value: string) {
    setManufacturedAt(value);
    if (
      shelfLifeConfigured &&
      value &&
      productShelfLifeDays &&
      productShelfLifeUnit
    ) {
      setExpiryDate(
        peerDateFromShelfLife({
          source: "manufactured",
          value,
          shelfLifeDays: productShelfLifeDays,
          shelfLifeUnit: productShelfLifeUnit,
        }),
      );
    }
  }

  const progress = useMemo(() => {
    if (!order) return [];
    const byProduct = new Map<
      string,
      { need: number; name: string; sku: string }
    >();
    for (const line of order.lines) {
      const cur = byProduct.get(line.product.id) ?? {
        need: 0,
        name: line.product.name,
        sku: line.product.sku,
      };
      cur.need += line.quantity;
      byProduct.set(line.product.id, cur);
    }
    return [...byProduct.entries()].map(([id, v]) => ({
      id,
      ...v,
      got: received[id] ?? 0,
    }));
  }, [order, received]);

  const remainingLines = useMemo(() => {
    if (!order) return [];
    return order.lines.filter((l) => {
      const got = received[l.product.id] ?? 0;
      // rough: still show lines until product fully received
      const need = order.lines
        .filter((x) => x.product.id === l.product.id)
        .reduce((s, x) => s + x.quantity, 0);
      return got + 1e-9 < need;
    });
  }, [order, received]);

  function applyLineDefaults(line: OrderLine | null | undefined) {
    const planned = lineLotNumber(line);
    setLotNumber(planned);
    setSerialNumber("");
    const exp = lineExpiryDate(line);
    setExpiryDate(exp);
    const days = line?.product.shelfLifeDays ?? null;
    const unit = line?.product.shelfLifeUnit ?? "DAY";
    if (exp && hasProductShelfLife(days) && days) {
      setManufacturedAt(
        peerDateFromShelfLife({
          source: "expiry",
          value: exp,
          shelfLifeDays: days,
          shelfLifeUnit: unit,
        }),
      );
    } else {
      setManufacturedAt("");
    }
    setPlannedLotHint(planned);
    setResolvedProductId(line?.product.id ?? "");
    const pkgs = packagesFromProduct(line?.product, t("defaultPackageName"));
    if (line?.package && !pkgs.some((p) => p.id === line.package!.id)) {
      pkgs.unshift(line.package);
    }
    setAvailablePackages(pkgs);
    setSelectedPackageId(line?.packageId || line?.package?.id || pkgs[0]?.id || "");
    setCreatingPackage(false);
    setDefaultUnitId(line?.product.unitId ?? "");
    setNewPkgUnitId(line?.product.unitId ?? "");
  }

  function clearScanFields() {
    setProductCode("");
    setSelectedLineId("");
    setAvailablePackages([]);
    setSelectedPackageId("");
    setCreatingPackage(false);
    setNewPkgFactor("10");
    setNewPkgUnitId("");
    setDefaultUnitId("");
    setResolvedProductId("");
    setQty("1");
    setLotNumber("");
    setSerialNumber("");
    setExpiryDate("");
    setManufacturedAt("");
    setPlannedLotHint("");
  }

  async function ensureSession(documentId: string, palletId?: string) {
    if (sessionId) return sessionId;
    let deviceKey = localStorage.getItem(DEVICE_KEY);
    if (!deviceKey) {
      deviceKey = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, deviceKey);
    }
    const data = await api("/api/tsd/session", {
      method: "POST",
      body: JSON.stringify({
        type: "receive",
        documentId,
        palletId,
        deviceKey,
      }),
    });
    setSessionId(data.session.id);
    return data.session.id as string;
  }

  function pickOrder(o: Order) {
    setOrder(o);
    setReceived({});
    setTn(null);
    setTnScan("");
    setCellCode("");
    setSessionId(null);
    setPalletHasGoods(false);
    setPalletAccepted(false);
    clearScanFields();
    setStep("cell");
    setMessage(null);
    setError(null);
  }

  async function confirmCell() {
    if (!cellCode.trim()) {
      setError(t("specifyReceiveCell"));
      return;
    }
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const loc = await api(
        `/api/tsd/location?code=${encodeURIComponent(cellCode.trim())}&purpose=receive`,
      );
      setCellCode(String(loc.code || cellCode.trim()));
      setStep("tn");
      setMessage(
        loc.zone
          ? t("cellWithZone", { code: loc.code, zone: loc.zone.name })
          : t("cellOnly", { code: loc.code }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : t("cellUnavailable"));
    } finally {
      setPending(false);
    }
  }

  async function resolveTn() {
    if (!tnScan.trim()) {
      setError(t("scanTnLabel"));
      return;
    }
    setPending(true);
    setError(null);
    try {
      const data = await api(
        `/api/tsd/pallet?code=${encodeURIComponent(tnScan.trim())}`,
      );
      setTn(data.pallet);
      if (order) await ensureSession(order.id, data.pallet.id);
      setPalletHasGoods(false);
      setPalletAccepted(false);
      setStep("scan");
      setMessage(t("tnAtCell", { code: data.pallet.code, cell: cellCode.trim() }));
      clearScanFields();
    } catch (e) {
      setError(e instanceof Error ? e.message : ts("genericError"));
    } finally {
      setPending(false);
    }
  }

  async function resolveProductBarcode(code: string) {
    const trimmed = code.trim();
    if (!trimmed || !order) {
      setAvailablePackages([]);
      setSelectedPackageId("");
      setResolvedProductId("");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const data = await api(
        `/api/tsd/product?barcode=${encodeURIComponent(trimmed)}`,
      );
      const productId = String(data.id || "");
      const inOrder = order.lines.some((l) => l.product.id === productId);
      if (!inOrder) {
        setError(t("productNotInOrder"));
        setAvailablePackages([]);
        setSelectedPackageId("");
        setResolvedProductId("");
        return;
      }

      setResolvedProductId(productId);
      setSelectedLineId("");

      const pkgs = packagesFromProduct(data, t("defaultPackageName"));
      const matched = toPackageInfo(data.matchedPackage, t("defaultPackageName"));
      if (matched && !pkgs.some((p) => p.id === matched.id)) {
        pkgs.unshift(matched);
      }
      setAvailablePackages(pkgs);

      const line =
        order.lines.find(
          (l) =>
            l.product.id === productId &&
            (matched ? l.packageId === matched.id : true),
        ) || order.lines.find((l) => l.product.id === productId);

      const preferredId =
        matched?.id ||
        line?.packageId ||
        line?.package?.id ||
        pkgs.find((p) => p.factor !== 1)?.id ||
        pkgs[0]?.id ||
        "";
      setSelectedPackageId(preferredId);
      setCreatingPackage(false);

      const unitId =
        String(data.unitId || data.unit?.id || line?.product.unitId || "") ||
        "";
      setDefaultUnitId(unitId);
      setNewPkgUnitId(unitId);

      if (line) {
        const planned = lineLotNumber(line);
        setLotNumber(planned);
        const exp = lineExpiryDate(line);
        setExpiryDate(exp);
        const days = line.product.shelfLifeDays ?? null;
        const unit = line.product.shelfLifeUnit ?? "DAY";
        if (exp && hasProductShelfLife(days) && days) {
          setManufacturedAt(
            peerDateFromShelfLife({
              source: "expiry",
              value: exp,
              shelfLifeDays: days,
              shelfLifeUnit: unit,
            }),
          );
        } else {
          setManufacturedAt("");
        }
        setPlannedLotHint(planned);
      } else {
        setLotNumber("");
        setSerialNumber("");
        setExpiryDate("");
        setManufacturedAt("");
        setPlannedLotHint("");
      }
      setMessage(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("productNotFound"));
      setAvailablePackages([]);
      setSelectedPackageId("");
      setCreatingPackage(false);
      setResolvedProductId("");
    } finally {
      setPending(false);
    }
  }

  async function createPackageOnTsd() {
    const productId =
      selectedLine?.product.id || resolvedProductId || "";
    if (!productId) {
      setError(t("selectProductFirst"));
      return;
    }
    const factor = Number(newPkgFactor);
    if (!Number.isFinite(factor) || factor <= 0) {
      setError(t("factorMustBePositive"));
      return;
    }
    if (!newPkgUnitId) {
      setError(t("specifyUnit"));
      return;
    }

    setPending(true);
    setError(null);
    try {
      const data = await api("/api/tsd/package", {
        method: "POST",
        body: JSON.stringify({
          productId,
          unitId: newPkgUnitId,
          factor,
          barcode:
            productCode.trim() &&
            !availablePackages.some((p) => p.barcode === productCode.trim())
              ? productCode.trim()
              : undefined,
        }),
      });
      const created = toPackageInfo(data.package, t("defaultPackageName"));
      if (!created) throw new Error(t("packageNotCreated"));
      setAvailablePackages((prev) => {
        if (prev.some((p) => p.id === created.id)) return prev;
        return [...prev, created].sort((a, b) => a.factor - b.factor);
      });
      setSelectedPackageId(created.id);
      setCreatingPackage(false);
      setMessage(t("packageCreated", { name: packageLabel(created, ts("baseUnit")) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("packageCreateError"));
    } finally {
      setPending(false);
    }
  }

  async function confirmReceive() {
    if (!order || !tn) return;

    const line =
      selectedLine ||
      order.lines.find((l) => l.product.id === resolvedProductId) ||
      null;
    const productId = line?.product.id || resolvedProductId;
    if (!productId) {
      setError(t("scanOrSelectProduct"));
      return;
    }

    if (creatingPackage) {
      setError(t("createPackageOrSelect"));
      return;
    }
    if (!selectedPackageId) {
      setError(t("selectPackage"));
      return;
    }

    const policy = resolveLotAccountingPolicy(
      line?.product ?? activeProduct,
    );
    const needsLot =
      lotsEnabled &&
      policy.useLots &&
      (policy.useSerial || !policy.lotNameTemplate);
    if (needsLot) {
      if (policy.useSerial && !serialNumber.trim() && !lotNumber.trim()) {
        setError(t("specifySerial"));
        return;
      }
      if (!policy.useSerial && !lotNumber.trim()) {
        setError(t("specifyLot"));
        return;
      }
    }
    if (lotsEnabled && policy.useExpiry) {
      const product = line?.product ?? activeProduct;
      const hasShelf = hasProductShelfLife(product?.shelfLifeDays);
      if (hasShelf) {
        if (!expiryDate.trim() && !manufacturedAt.trim()) {
          setError(t("specifyMfgOrExpiry"));
          return;
        }
      } else if (!expiryDate.trim() || !manufacturedAt.trim()) {
        setError(t("specifyBothDatesNoShelfLife"));
        return;
      }
    }

    if (!Number.isFinite(Number(qty)) || Number(qty) <= 0) {
      setError(t("specifyQuantity"));
      return;
    }

    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const sid = await ensureSession(order.id, tn.id);
      const pkg = displayPackage;
      const data = await api("/api/tsd/receive", {
        method: "POST",
        body: JSON.stringify({
          documentId: order.id,
          palletId: tn.id,
          locationCode: cellCode.trim(),
          productId,
          quantity: Number(qty),
          packageId: pkg?.id || undefined,
          lotNumber: (() => {
            if (!lotsEnabled || !policy.useLots) return undefined;
            if (policy.useSerial) return undefined;
            if (policy.lotNameTemplate) {
              // По шаблону — номер создаст сервер; из документа берём только плановый.
              const planned = lineLotNumber(line) || plannedLotHint;
              return planned || undefined;
            }
            return lotNumber.trim() || undefined;
          })(),
          serialNumber:
            lotsEnabled && serialNumber.trim()
              ? serialNumber.trim()
              : undefined,
          expiryDate:
            lotsEnabled && expiryDate.trim() ? expiryDate.trim() : undefined,
          manufacturedAt:
            lotsEnabled && manufacturedAt.trim()
              ? manufacturedAt.trim()
              : undefined,
          sessionId: sid,
        }),
      });

      const factor = pkg && pkg.factor > 0 ? pkg.factor : 1;
      const baseGot = Number(qty) * factor;
      setReceived((prev) => ({
        ...prev,
        [productId]: (prev[productId] ?? 0) + baseGot,
      }));
      setPalletHasGoods(true);

      if (data.accepted) {
        setOrders((prev) => prev.filter((o) => o.id !== order.id));
        setMessage(t("orderFullyReceived"));
      } else {
        setMessage(
          t("receivedOnPallet", {
            tn: tn.code,
            qty,
            package: packageLabel(pkg, ts("baseUnit")),
          }),
        );
      }
      clearScanFields();
    } catch (e) {
      setError(e instanceof Error ? e.message : ts("genericError"));
    } finally {
      setPending(false);
    }
  }

  async function completePalletAcceptance() {
    if (!order || !tn) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const data = await api("/api/tsd/receive/complete-pallet", {
        method: "POST",
        body: JSON.stringify({
          palletId: tn.id,
          documentId: order.id,
          sessionId,
        }),
      });
      setPalletAccepted(true);
      setMessage(
        data.alreadyAccepted
          ? t("palletAlreadyAccepted", { code: tn.code })
          : t("palletAcceptanceComplete", { code: tn.code }),
      );
      clearScanFields();
      setStep("next");
    } catch (e) {
      setError(e instanceof Error ? e.message : ts("genericError"));
    } finally {
      setPending(false);
    }
  }

  function startNextCarrier() {
    setTn(null);
    setTnScan("");
    setPalletHasGoods(false);
    setPalletAccepted(false);
    setSessionId(null);
    clearScanFields();
    setError(null);
    setMessage(null);
    setStep("tn");
  }

  return (
    <div className="space-y-3">
      {step === "order" ? (
        <Panel title={t("selectOrder")}>
          {orders.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">{t("noOrders")}</p>
          ) : (
            <div className="space-y-2">
              {orders.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className="flex w-full flex-col rounded-lg border border-[var(--line)] px-3 py-3 text-left hover:border-[var(--accent)]"
                  onClick={() => pickOrder(o)}
                >
                  <span className="text-sm font-semibold">{o.number}</span>
                  <span className="text-xs text-[var(--muted)]">
                    {o.supplier ?? "—"} · {ts("lineCount", { count: o.lines.length })}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Panel>
      ) : null}

      {step === "cell" && order ? (
        <Panel title={order.number}>
          <div className="space-y-3">
            <Field label={t("cellRequired")}>
              <input
                className={`${inputClass} text-lg`}
                value={cellCode}
                onChange={(e) => setCellCode(e.target.value)}
                autoFocus
                placeholder={t("scanOrEnterCode")}
                disabled={pending}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void confirmCell();
                  }
                }}
              />
            </Field>
            <button
              className={`${buttonClass} w-full py-3`}
              type="button"
              disabled={pending}
              onClick={() => void confirmCell()}
            >
              {ts("next")}
            </button>
            <button
              className={`${buttonSecondaryClass} w-full`}
              type="button"
              disabled={pending}
              onClick={() => void goToOrders()}
            >
              {ts("back")}
            </button>
          </div>
        </Panel>
      ) : null}

      {step === "tn" && order ? (
        <Panel title={t("cellTitle", { code: cellCode })}>
          <div className="space-y-3">
            <p className="text-sm text-[var(--muted)]">{t("scanPalletHint")}</p>
            <Field label={t("tnPallet")}>
              <input
                className={`${inputClass} text-lg`}
                value={tnScan}
                onChange={(e) => setTnScan(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void resolveTn();
                  }
                }}
              />
            </Field>
            <button
              className={`${buttonClass} w-full py-3`}
              type="button"
              disabled={pending}
              onClick={() => void resolveTn()}
            >
              {ts("next")}
            </button>
            <button
              className={`${buttonSecondaryClass} w-full`}
              type="button"
              onClick={() => setStep("cell")}
            >
              {ts("back")}
            </button>
          </div>
        </Panel>
      ) : null}

      {step === "scan" && order && tn ? (
        <>
          <Panel title={`${order.number} · ${tn.code}`}>
            <div className="space-y-3">
              <p className="text-xs text-[var(--muted)]">
                {t("scanProductHint", { cell: cellCode })}
              </p>
              <Field label={t("productBarcode")}>
                <input
                  className={`${inputClass} text-lg`}
                  value={productCode}
                  onChange={(e) => {
                    setProductCode(e.target.value);
                    setSelectedLineId("");
                  }}
                  onBlur={() => {
                    if (productCode.trim()) void resolveProductBarcode(productCode);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void resolveProductBarcode(productCode);
                    }
                  }}
                  autoFocus
                />
              </Field>
              <Field label={t("orOrderLine")}>
                <select
                  className={inputClass}
                  value={selectedLineId}
                  onChange={(e) => {
                    const lineId = e.target.value;
                    setSelectedLineId(lineId);
                    setProductCode("");
                    const line = order.lines.find((l) => l.id === lineId);
                    applyLineDefaults(line ?? null);
                  }}
                >
                  <option value="">—</option>
                  {order.lines.map((l) => {
                    const lot = lineLotNumber(l);
                    return (
                      <option key={l.id} value={l.id}>
                        {l.product.sku} · {l.product.name}
                        {l.package ? ` · ${l.package.name}` : ""} ({l.quantity})
                        {lot ? t("lotInLine", { lot }) : ""}
                      </option>
                    );
                  })}
                </select>
              </Field>

              {(resolvedProductId || selectedLine) && (
                <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm">
                  <div className="font-medium">
                    {activeProduct
                      ? `${activeProduct.sku} · ${activeProduct.name}`
                      : "—"}
                  </div>
                </div>
              )}

              {(resolvedProductId || selectedLine) ? (
                <>
                  <Field label={t("packageRequired")}>
                    <select
                      className={inputClass}
                      value={creatingPackage ? "__new__" : selectedPackageId}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "__new__") {
                          setCreatingPackage(true);
                          setSelectedPackageId("");
                          setNewPkgUnitId(defaultUnitId || units[0]?.id || "");
                          return;
                        }
                        setCreatingPackage(false);
                        setSelectedPackageId(v);
                      }}
                      disabled={pending}
                    >
                      <option value="">{ts("selectPlaceholder")}</option>
                      {availablePackages.map((p) => (
                        <option key={p.id} value={p.id}>
                          {packageLabel(p, ts("baseUnit"))}
                          {p.factor !== 1 ? ` ${t("stockFactor", { factor: p.factor })}` : ""}
                        </option>
                      ))}
                      <option value="__new__">{t("createPackageOption")}</option>
                    </select>
                  </Field>

                  {creatingPackage ? (
                    <div className="space-y-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3">
                      <Field label={t("factor")}>
                        <input
                          className={`${inputClass} text-lg`}
                          type="number"
                          step="any"
                          min="0.0001"
                          value={newPkgFactor}
                          onChange={(e) => setNewPkgFactor(e.target.value)}
                          placeholder={t("factorPlaceholder")}
                          disabled={pending}
                        />
                      </Field>
                      <Field label={t("unit")}>
                        <select
                          className={inputClass}
                          value={newPkgUnitId}
                          onChange={(e) => setNewPkgUnitId(e.target.value)}
                          disabled={pending}
                        >
                          <option value="">{ts("selectPlaceholder")}</option>
                          {units.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <button
                        className={`${buttonClass} w-full`}
                        type="button"
                        disabled={pending}
                        onClick={() => void createPackageOnTsd()}
                      >
                        {t("createPackage")}
                      </button>
                    </div>
                  ) : null}
                </>
              ) : null}

              <Field
                label={
                  displayPackage && displayPackage.factor !== 1
                    ? t("packageCount")
                    : ts("quantityRequired")
                }
              >
                <input
                  className={`${inputClass} text-lg`}
                  type="number"
                  step="any"
                  min="0.0001"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
              </Field>

              {showLotFields ? (
                <>
                  {showSerial ? (
                    <Field label={t("serialNumber")}>
                      <input
                        className={inputClass}
                        value={serialNumber}
                        onChange={(e) => setSerialNumber(e.target.value)}
                        placeholder={t("serialPlaceholder")}
                      />
                    </Field>
                  ) : null}
                  {showLotNumber && !lotFromTemplate ? (
                    <Field label={lotRequired ? t("lotRequired") : t("lotOptional")}>
                      <input
                        className={inputClass}
                        value={lotNumber}
                        onChange={(e) => setLotNumber(e.target.value)}
                        placeholder={
                          plannedLotHint
                            ? t("lotFromDoc", { hint: plannedLotHint })
                            : t("enterLotNumber")
                        }
                      />
                    </Field>
                  ) : null}
                  {showExpiry ? (
                    <>
                      <p className="text-xs text-[var(--muted)]">
                        {shelfLifeConfigured
                          ? t("shelfLifeOneDate")
                          : t("shelfLifeBothDates")}
                      </p>
                      <Field
                        label={
                          shelfLifeConfigured
                            ? t("manufacturedDate")
                            : t("manufacturedDateRequired")
                        }
                      >
                        <input
                          className={inputClass}
                          type="date"
                          value={manufacturedAt}
                          onChange={(e) => onManufacturedChange(e.target.value)}
                        />
                      </Field>
                      <Field
                        label={
                          shelfLifeConfigured
                            ? t("expiryDate")
                            : t("expiryDateRequired")
                        }
                      >
                        <input
                          className={inputClass}
                          type="date"
                          value={expiryDate}
                          onChange={(e) => onExpiryChange(e.target.value)}
                        />
                      </Field>
                    </>
                  ) : null}
                </>
              ) : null}

              <button
                className={`${buttonClass} w-full py-3 text-base`}
                type="button"
                disabled={pending || (!resolvedProductId && !selectedLineId)}
                onClick={() => void confirmReceive()}
              >
                {ts("confirm")}
              </button>
              {palletHasGoods ? (
                <button
                  className={`${buttonClass} w-full py-3 text-base`}
                  type="button"
                  disabled={pending}
                  onClick={() => void completePalletAcceptance()}
                >
                  {t("completePallet")}
                </button>
              ) : null}
              <button
                className={`${buttonSecondaryClass} w-full`}
                type="button"
                onClick={() => {
                  clearScanFields();
                  setPalletHasGoods(false);
                  setPalletAccepted(false);
                  setStep("tn");
                }}
              >
                {t("changePallet")}
              </button>
              <button
                className={`${buttonSecondaryClass} w-full`}
                type="button"
                disabled={pending}
                onClick={() => void goToOrders()}
              >
                {t("backToOrders")}
              </button>
            </div>
          </Panel>

          <Panel title={t("progress")}>
            {remainingLines.length === 0 && order.lines.length > 0 ? (
              <p className="text-sm text-emerald-700">{t("allLinesReceived")}</p>
            ) : (
              <p className="mb-2 text-xs text-[var(--muted)]">
                {t("scanNextProduct")}
              </p>
            )}
            <ul className="space-y-1 text-sm">
              {progress.map((p) => (
                <li key={p.id} className="flex justify-between gap-2">
                  <span>
                    {p.sku} {p.name}
                  </span>
                  <span className="text-xs">
                    {p.got} / {p.need}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </>
      ) : null}

      {step === "next" && order && tn ? (
        <Panel title={t("tnAccepted", { code: tn.code })}>
          <div className="space-y-3">
            <p className="text-sm text-[var(--muted)]">{t("whatNext")}</p>
            <button
              className={`${buttonClass} w-full py-3 text-base`}
              type="button"
              onClick={startNextCarrier}
            >
              {t("nextCarrier")}
            </button>
            {showPutawayAfterReceive ? (
              <a
                href="/tsd/putaway"
                className={`${buttonClass} w-full py-3 text-center`}
              >
                {t("toPutaway")}
              </a>
            ) : null}
            <a
              href="/tsd"
              className={`${buttonSecondaryClass} w-full py-3 text-center`}
            >
              {t("toMainMenu")}
            </a>
            <button
              className={`${buttonSecondaryClass} w-full`}
              type="button"
              disabled={pending}
              onClick={() => void goToOrders()}
            >
              {t("backToOrderSelect")}
            </button>
          </div>
        </Panel>
      ) : null}

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
