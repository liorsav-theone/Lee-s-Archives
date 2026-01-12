import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  base: "/",
  server: {
    cors: {
      origin: "https://www.owlbear.rodeo",
    },
  },
});