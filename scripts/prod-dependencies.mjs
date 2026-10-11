// The top-level directories the production dependency tree should contain,
// derived from package-lock.json rather than written out by hand.
//
// npm ci --omit=dev removes the unscoped dev entry points and leaves the scoped
// ones, so neither npm nor a hand-written list gives a reliable answer. Reading
// the lockfile does.
//
//   node scripts/prod-dependencies.mjs --list    print the expected directories
//   node scripts/prod-dependencies.mjs --prune   delete everything else

import { readFileSync, readdirSync, rmSync } from "node:fs";

const lock = JSON.parse(
  readFileSync(new URL("../package-lock.json", import.meta.url), "utf8")
);

const productionDirectories = new Set(
  Object.entries(lock.packages)
    .filter(([path, entry]) => path && !entry.dev && !entry.devOptional)
    .map(
      ([path]) => path.replace(/^node_modules\//, "").split("/node_modules/")[0]
    )
    .map((name) => (name.startsWith("@") ? name.split("/")[0] : name))
);

if (process.argv.includes("--prune")) {
  const modules = new URL("../node_modules/", import.meta.url);
  const remove = (name) =>
    rmSync(new URL(name, modules), { recursive: true, force: true });

  for (const entry of readdirSync(modules)) {
    if (entry.startsWith(".")) continue;

    if (!entry.startsWith("@")) {
      if (!productionDirectories.has(entry)) remove(entry);
      continue;
    }

    const scope = new URL(`${entry}/`, modules);
    for (const name of readdirSync(scope)) {
      if (!productionDirectories.has(`${entry}/${name}`))
        remove(`${entry}/${name}`);
    }
    if (readdirSync(scope).length === 0) remove(entry);
  }
} else {
  console.log([...productionDirectories].sort().join("\n"));
}
