import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/hoje",
    name: "Galedos Gestão",
    short_name: "Galedos",
    description: "Gestão de serviços, presenças e remunerações do Grupo Galedos.",
    start_url: "/hoje",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "pt-AO",
    background_color: "#0b1b3a",
    theme_color: "#0b1b3a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}