"use client";

import { createContext, useContext } from "react";
import type { StatusCatalog } from "@/lib/status/appearance";

const StatusCatalogContext = createContext<StatusCatalog>({});

export function StatusCatalogProvider({
  catalog,
  children,
}: {
  catalog: StatusCatalog;
  children: React.ReactNode;
}) {
  return (
    <StatusCatalogContext.Provider value={catalog}>
      {children}
    </StatusCatalogContext.Provider>
  );
}

export function useStatusCatalog() {
  return useContext(StatusCatalogContext);
}
