"use client";

import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { updateCellMapPosition } from "@/lib/module-actions";

type Cell = {
  id: string;
  code: string;
  name: string;
  mapX: number;
  mapY: number;
  mapW: number;
  mapH: number;
  type: string;
  zone: { name: string; color: string } | null;
};

export function TopologyMap({
  width,
  height,
  cells,
}: {
  width: number;
  height: number;
  cells: Cell[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const dragSession = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);

  function onDragStart(e: React.DragEvent) {
    dragSession.current = { x: e.clientX, y: e.clientY };
    suppressClick.current = false;
  }

  function onDrag(e: React.DragEvent) {
    const start = dragSession.current;
    if (!start) return;
    const dx = Math.abs(e.clientX - start.x);
    const dy = Math.abs(e.clientY - start.y);
    if (dx > 5 || dy > 5) suppressClick.current = true;
  }

  function onDragEnd(cell: Cell, e: React.DragEvent) {
    const canvas = (e.currentTarget.parentElement as HTMLElement)?.getBoundingClientRect();
    if (!canvas) return;
    const x = Math.max(0, Math.round(e.clientX - canvas.left - cell.mapW / 2));
    const y = Math.max(0, Math.round(e.clientY - canvas.top - cell.mapH / 2));
    const fd = new FormData();
    fd.set("id", cell.id);
    fd.set("mapX", String(x));
    fd.set("mapY", String(y));
    fd.set("mapW", String(cell.mapW));
    fd.set("mapH", String(cell.mapH));
    startTransition(async () => {
      await updateCellMapPosition(fd);
    });
    dragSession.current = null;
  }

  function openCell(cellId: string) {
    router.push(`/catalog/cells/${cellId}`);
  }

  return (
    <div className="overflow-auto rounded-xl border border-[var(--line)] bg-[var(--panel)]">
      <div
        className="relative bg-[repeating-linear-gradient(0deg,transparent,transparent_19px,rgba(0,0,0,0.04)_20px),repeating-linear-gradient(90deg,transparent,transparent_19px,rgba(0,0,0,0.04)_20px)]"
        style={{ width, height, minWidth: width, minHeight: height }}
      >
        {cells.map((cell) => (
          <div
            key={cell.id}
            draggable
            onDragStart={onDragStart}
            onDrag={onDrag}
            onDragEnd={(e) => onDragEnd(cell, e)}
            onClick={() => {
              if (suppressClick.current) {
                suppressClick.current = false;
                return;
              }
              openCell(cell.id);
            }}
            title={`${cell.code} · ${cell.name}${pending ? " …" : ""}`}
            className="absolute flex cursor-grab flex-col justify-center overflow-hidden rounded-md border border-white/40 px-1.5 text-[10px] font-medium text-white shadow-sm active:cursor-grabbing"
            style={{
              left: cell.mapX,
              top: cell.mapY,
              width: cell.mapW,
              height: cell.mapH,
              background: cell.zone?.color ?? "#0b6e4f",
            }}
          >
            <span className="truncate">{cell.code}</span>
            <span className="truncate opacity-90">{cell.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
