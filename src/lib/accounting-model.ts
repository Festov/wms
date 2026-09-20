/** Политика учёта партий/срока/серии для номенклатуры. */
export type LotAccountingPolicy = {
  useLots: boolean;
  useExpiry: boolean;
  useSerial: boolean;
  lotNameTemplate: string | null;
  accountingModelId: string | null;
  accountingModelCode: string | null;
  accountingModelName: string | null;
};

export type AccountingModelLike = {
  id: string;
  code: string;
  name: string;
  useLots: boolean;
  useExpiry: boolean;
  useSerial: boolean;
  lotNameTemplate: string | null;
} | null | undefined;

export type ProductAccountingLike = {
  trackLots?: boolean;
  trackExpiry?: boolean;
  accountingModelId?: string | null;
  accountingModel?: AccountingModelLike;
};

/** Флаги trackLots/trackExpiry из модели учёта. */
export function flagsFromAccountingModel(model: AccountingModelLike) {
  if (!model) {
    return { trackLots: false, trackExpiry: false };
  }
  const useLots = Boolean(model.useLots);
  return {
    trackLots: useLots,
    trackExpiry: Boolean(useLots && model.useExpiry),
  };
}

/** Политика с учётом модели; без модели — legacy trackLots/trackExpiry. */
export function resolveLotAccountingPolicy(
  product: ProductAccountingLike | null | undefined,
): LotAccountingPolicy {
  const model = product?.accountingModel ?? null;
  if (model) {
    const useLots = Boolean(model.useLots);
    return {
      useLots,
      useExpiry: Boolean(useLots && model.useExpiry),
      useSerial: Boolean(useLots && model.useSerial),
      lotNameTemplate: useLots ? model.lotNameTemplate?.trim() || null : null,
      accountingModelId: model.id,
      accountingModelCode: model.code,
      accountingModelName: model.name,
    };
  }
  return {
    useLots: Boolean(product?.trackLots),
    useExpiry: Boolean(product?.trackLots && product?.trackExpiry),
    useSerial: false,
    lotNameTemplate: null,
    accountingModelId: product?.accountingModelId ?? null,
    accountingModelCode: null,
    accountingModelName: null,
  };
}
