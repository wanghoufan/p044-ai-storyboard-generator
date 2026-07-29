import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { storyboardApiPlugin } from "./server/dev-middleware.mjs";

export default defineConfig(({ mode }) => {
  const serverEnv = loadEnv(mode, process.cwd(), "");

  return {
    build: {
      outDir: "dist/client",
    },
    optimizeDeps: {
      include: ["react", "react-dom/client"],
    },
    server: {
      host: "0.0.0.0",
      allowedHosts: ["terminal.local"],
      warmup: {
        clientFiles: ["./src/main.jsx"],
      },
    },
    plugins: [storyboardApiPlugin(serverEnv), react()],
  };
});
