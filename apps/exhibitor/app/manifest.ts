import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Exhibition Badge Scanner",
    short_name: "Scanner",
    description: "Scan visitor badges, capture contact info, and build your personal visit list.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0a0a12",
    theme_color: "#0a0a12",
    orientation: "portrait",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/maskable-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
