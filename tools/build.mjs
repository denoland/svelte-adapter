import fs from "node:fs";
import path from "node:path";

const target = path.join(
  import.meta.dirname,
  "..",
  "dist",
  "files",
);

try {
  fs.mkdirSync(target, { recursive: true });
} catch (_e) {
  // ignore
}
fs.cpSync(
  path.join(import.meta.dirname, "..", "src", "files"),
  path.join(target),
  { recursive: true },
);

const serverTs = path.join(target, "server.ts");
const content = fs.readFileSync(serverTs, "utf-8");
fs.writeFileSync(
  serverTs,
  content.replaceAll(/handler\.js/g, "handler.ts"),
  "utf-8",
);
