import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Toq Tennis",
    short_name: "Toq Tennis",
    description:
      "Rede social e plataforma de jogos de tênis — feed, comunidades e partidas",
    start_url: "/inicio",
    display: "standalone",
    background_color: "#0a111e",
    theme_color: "#0a111e",
    icons: [
      {
        src: "/imagens_publicas/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/imagens_publicas/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
