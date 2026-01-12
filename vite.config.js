import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  base: "/Lee-s-Archives/",
  server: {
    cors: {
      origin: "https://www.owlbear.rodeo",
    },
  },
});