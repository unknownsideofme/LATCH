import { register } from "node:module";

if (typeof register === "function") {
  register(new URL("./ts-loader.mjs", import.meta.url));
}
