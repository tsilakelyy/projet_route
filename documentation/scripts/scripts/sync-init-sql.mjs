import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const source = resolve(root, "fournisseurIdentite", "src", "main", "resources", "script.sql");
const target = resolve(root, "docker-entrypoint-initdb.d", "script.sql");

if (!existsSync(source)) {
  console.error(`[sync-init-sql] Source missing: ${source}`);
  process.exit(1);
}

copyFileSync(source, target);
console.log(`[sync-init-sql] Synced ${source} -> ${target}`);
