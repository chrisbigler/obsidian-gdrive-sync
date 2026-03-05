import { copyFileSync, mkdirSync } from "fs";
import { join } from "path";

const PLUGIN_DIR = join(
  process.env.HOME,
  "Library/Mobile Documents/iCloud~md~obsidian/Documents/Work/.obsidian/plugins/gdrive-sync"
);

mkdirSync(PLUGIN_DIR, { recursive: true });

const root = join(import.meta.dirname, "..");
copyFileSync(join(root, "main.js"), join(PLUGIN_DIR, "main.js"));
copyFileSync(join(root, "manifest.json"), join(PLUGIN_DIR, "manifest.json"));

console.log(`Installed to ${PLUGIN_DIR}`);
