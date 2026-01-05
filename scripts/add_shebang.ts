/**
 * Add shebang to the compiled JavaScript file
 */

import fs from "node:fs";
import { join } from "node:path";

const file = join(__dirname, "..", "dist", "index.js");

fs.writeFileSync(file, "#!/usr/bin/env node\n" + fs.readFileSync(file, "utf8"));
