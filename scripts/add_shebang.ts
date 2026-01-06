/**
 * Add shebang to the compiled JavaScript file
 */

import fs from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const file = join(__dirname, "..", "dist", "index.js");

try {
  const originalContent = fs.readFileSync(file, "utf8");
  fs.writeFileSync(file, "#!/usr/bin/env node\n" + originalContent);
} catch (error) {
  throw new Error(`Failed to add shebang to "${file}": ${error}`);
}
