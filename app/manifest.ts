import type { MetadataRoute } from "next";

// Lets a self-hosted instance be installed to the home screen: on iOS via
// Share -> "Add to Home Screen", on Android through the install prompt. It then
// opens standalone, without browser chrome, which makes checking campaigns from
// a phone practical.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "СМАРТУЧЕТ · Instagram",
    short_name: "СМАРТУЧЕТ · Instagram",
    description: "Instagram-автоматизация: комментарий → сообщение в Direct",
    start_url: "/overview",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0f1c",
    theme_color: "#0a0f1c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
