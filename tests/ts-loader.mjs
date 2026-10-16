import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";

export async function resolve(specifier, context, nextResolve) {
  const result = await nextResolve(specifier, context);
  if (result.url.endsWith(".ts") || result.url.endsWith(".tsx")) {
    return {
      ...result,
      format: "module",
      shortCircuit: true,
    };
  }
  return result;
}

export async function load(url, context, nextLoad) {
  if (url.endsWith(".ts") || url.endsWith(".tsx")) {
    const filePath = fileURLToPath(url);
    const raw = fs.readFileSync(filePath, "utf8");
    const { code } = transformSync(raw, {
      loader: url.endsWith(".tsx") ? "tsx" : "ts",
      format: "esm",
      target: "es2022",
      sourcemap: "inline",
    });
    return {
      format: "module",
      shortCircuit: true,
      source: code,
    };
  }
  return nextLoad(url, context);
}
