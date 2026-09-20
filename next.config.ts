import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const noStore = [
  {
    key: "Cache-Control",
    value: "no-store, no-cache, must-revalidate, max-age=0",
  },
  { key: "Pragma", value: "no-cache" },
];

const nextConfig: NextConfig = {
  // Hide the Next.js "N" floating badge — it is a framework tool, not WMS UI.
  devIndicators: false,
  async redirects() {
    return [
      {
        source: "/inbound/docks",
        destination: "/catalog/receiving_docks",
        permanent: false,
      },
      {
        source: "/inbound/docks/new",
        destination: "/catalog/receiving_docks/new",
        permanent: false,
      },
      {
        source: "/inbound/docks/:id",
        destination: "/catalog/receiving_docks/:id",
        permanent: false,
      },
      {
        source: "/inbound/transport",
        destination: "/catalog/transport_units",
        permanent: false,
      },
      {
        source: "/inbound/transport/new",
        destination: "/catalog/transport_units/new",
        permanent: false,
      },
      {
        source: "/inbound/transport/:id",
        destination: "/catalog/transport_units/:id",
        permanent: false,
      },
      {
        source: "/admin/icons",
        destination: "/admin/nav",
        permanent: false,
      },
      {
        source: "/products",
        destination: "/nsi/nomenclature",
        permanent: false,
      },
      {
        source: "/nomenclature",
        destination: "/nsi/nomenclature",
        permanent: false,
      },
      {
        source: "/locations",
        destination: "/nsi/cells",
        permanent: false,
      },
      {
        source: "/types",
        destination: "/nsi/pallet-types",
        permanent: false,
      },
      {
        source: "/movements",
        destination: "/operations",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      // Whole web app + API — always from server (no browser HTTP cache).
      // Exception: /_next/static/* is content-hashed by Next and left alone.
      { source: "/:path*", headers: noStore },
      { source: "/api/:path*", headers: noStore },
      { source: "/sw.js", headers: noStore },
      { source: "/manifest.webmanifest", headers: noStore },
    ];
  },
};

export default withNextIntl(nextConfig);
