import { defineConfig } from "vite";
import { cenarioPlugin } from "./tools/cenario-plugin";

export default defineConfig({
  base: "/rally2d/",
  // Só em desenvolvimento: é o que deixa o editor de recortes gravar em src/cenario.json.
  plugins: [cenarioPlugin()],
});
