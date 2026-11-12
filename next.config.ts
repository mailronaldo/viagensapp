import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Todas as telas dependem do usuário logado, então usamos renderização
  // dinâmica simples (sem Cache Components).
  cacheComponents: false,
  partialPrefetching: false,
  // ffmpeg-static/onnxruntime-node resolvem caminho de binário nativo via
  // __dirname — empacotados pelo Turbopack, esse caminho vem errado.
  serverExternalPackages: ["pg", "ffmpeg-static", "@huggingface/transformers", "onnxruntime-node", "sharp"],
  experimental: {
    serverActions: { bodySizeLimit: "15mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
