import { z } from "zod";

export const tsdSessionPostSchema = z.object({
  type: z.enum(["receive", "putaway"]),
  deviceKey: z.string().trim().optional(),
  deviceName: z.string().trim().optional(),
  documentId: z.string().trim().optional(),
  palletId: z.string().trim().optional(),
  locationId: z.string().trim().optional(),
});

export const tsdSessionPatchSchema = z.object({
  id: z.string().trim().min(1, "Укажите идентификатор"),
  deviceKey: z.string().trim().optional(),
  documentId: z.string().trim().optional(),
  palletId: z.string().trim().optional(),
  locationId: z.string().trim().optional(),
  plannedLocId: z.string().trim().optional(),
  status: z.string().trim().optional(),
});

export const tsdPickSchema = z.object({
  productBarcode: z.string().trim().min(1),
  locationCode: z.string().trim().min(1),
  quantity: z.number().positive(),
  lotNumber: z.string().trim().optional(),
  packageId: z.string().trim().optional(),
  documentId: z.string().trim().optional(),
});

export const tsdReceiveSchema = z.object({
  productBarcode: z.string().trim().min(1),
  locationCode: z.string().trim().min(1),
  quantity: z.number().positive(),
  documentId: z.string().trim().optional(),
  palletId: z.string().trim().optional(),
  lotNumber: z.string().trim().optional(),
  packageId: z.string().trim().optional(),
  expiryDate: z.string().trim().optional(),
  serialNumber: z.string().trim().optional(),
});

export const tsdTransferSchema = z.object({
  productBarcode: z.string().trim().min(1),
  fromLocationCode: z.string().trim().min(1),
  toLocationCode: z.string().trim().min(1),
  quantity: z.number().positive(),
  lotNumber: z.string().trim().optional(),
  packageId: z.string().trim().optional(),
});

export const tsdPalletCreateSchema = z.object({
  palletTypeId: z.string().trim().min(1),
  locationId: z.string().trim().optional(),
});

export const integrationInboxSchema = z.object({
  source: z.string().trim().min(1),
  externalId: z.string().trim().min(1),
  eventType: z.string().trim().min(1),
  payload: z.record(z.string(), z.unknown()).default({}),
});
