import { existsSync } from "node:fs";
import { dirname, extname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export async function resolve(specifier, context, defaultResolve) {
  const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
  const hasExtension = extname(specifier) !== "";

  if (isRelative && !hasExtension && context.parentURL?.startsWith("file:")) {
    const parentDir = dirname(fileURLToPath(context.parentURL));
    const tsCandidate = resolvePath(parentDir, `${specifier}.ts`);

    if (existsSync(tsCandidate)) {
      return {
        shortCircuit: true,
        url: pathToFileURL(tsCandidate).href,
      };
    }
  }

  return defaultResolve(specifier, context, defaultResolve);
}