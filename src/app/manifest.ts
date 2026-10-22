import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
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
      { src: "/icone/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icone/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icone/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}