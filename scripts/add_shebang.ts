/**
 * Add shebang to the compiled JavaScript file
 */

import fs from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const file = join(__dirname, "..", "dist", "index.js");

fs.writeFileSync(file, "#!/usr/bin/env node\n" + fs.readFileSync(file, "utf8"));
