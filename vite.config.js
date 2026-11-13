import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          editor: ["@tiptap/react", "@tiptap/starter-kit"],
          react: ["react", "react-dom", "react-dom/client"],
          realtime: ["socket.io-client"],
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:3001",
      "/socket.io": { target: "http://127.0.0.1:3001", ws: true },
    },
  },
});
