import { prisma } from "@/lib/db";
import { throwLocalized } from "@/lib/i18n/errors-server";
import {
  DOCK_OCCUPYING_INBOUND_STATUSES,
  DOCK_OCCUPYING_OUTBOUND_STATUSES,
} from "@/lib/receiving-dock-labels";

export {
  DOCK_OCCUPYING_INBOUND_STATUSES,
  DOCK_OCCUPYING_OUTBOUND_STATUSES,
  formatReceivingDockLabel,
  formatReceivingDockListLabel,
  receivingDockStatusLabel,
} from "@/lib/receiving-dock-labels";

export async function syncReceivingDockStatus(dockId: string | null | undefined) {
  if (!dockId) return;
  const [inboundActive, outboundActive] = await Promise.all([
    prisma.inboundDocument.count({
      where: {
        receivingDockId: dockId,
        status: { in: [...DOCK_OCCUPYING_INBOUND_STATUSES] },
      },
    }),
    prisma.outboundDocument.count({
      where: {
        receivingDockId: dockId,
        status: { in: [...DOCK_OCCUPYING_OUTBOUND_STATUSES] },
      },
    }),
  ]);
  const active = inboundActive + outboundActive;
  await prisma.receivingDock.update({
    where: { id: dockId },
    data: { status: active > 0 ? "BUSY" : "FREE" },
  });
}

export async function assertReceivingDockAssignable(
  dockId: string,
  documentId?: string,
  flow: "inbound" | "outbound" = "inbound",
) {
  const dock = await prisma.receivingDock.findFirst({
    where: { id: dockId, isActive: true },
  });
  if (!dock) return throwLocalized("errors.receiving.dockNotFoundOrInactive");

  if (dock.status === "BUSY") {
    const inboundHolder = await prisma.inboundDocument.findFirst({
      where: {
        receivingDockId: dockId,
        status: { in: [...DOCK_OCCUPYING_INBOUND_STATUSES] },
        ...(flow === "inbound" && documentId ? { NOT: { id: documentId } } : {}),
      },
      select: { number: true },
    });
    if (inboundHolder) {
      return throwLocalized("errors.receiving.dockBusyInbound", {
        number: inboundHolder.number,
      });
    }

    const outboundHolder = await prisma.outboundDocument.findFirst({
      where: {
        receivingDockId: dockId,
        status: { in: [...DOCK_OCCUPYING_OUTBOUND_STATUSES] },
        ...(flow === "outbound" && documentId ? { NOT: { id: documentId } } : {}),
      },
      select: { number: true },
    });
    if (outboundHolder) {
      return throwLocalized("errors.receiving.dockBusyOutbound", {
        number: outboundHolder.number,
      });
    }
  }
}

export async function syncOutboundDocumentDock(documentId: string) {
  const doc = await prisma.outboundDocument.findUnique({
    where: { id: documentId },
    select: { receivingDockId: true },
  });
  if (doc?.receivingDockId) {
    await syncReceivingDockStatus(doc.receivingDockId);
  }
}
