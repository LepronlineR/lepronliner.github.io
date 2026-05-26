import { createServer } from "node:http";
import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const port = Number(process.argv[2] || 4173);
const root = resolve(process.cwd());
const publicRoot = join(root, "public");

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

const generatedOutputs = [
  join(publicRoot, "blog", "posts.json"),
  join(publicRoot, "projects", "projects.json")
];
const sourceFolders = [
  "_posts",
  "content",
  "assets",
  "portfolio",
  "resume",
  "scripts",
  "styles"
].map((folder) => join(root, folder));
const sourceFiles = ["favicon.ico", "index.html"].map((file) => join(root, file));
const sourceExtensions = new Set([
  ".css",
  ".gif",
  ".glsl",
  ".html",
  ".ico",
  ".jpeg",
  ".jpg",
  ".js",
  ".json",
  ".md",
  ".obj",
  ".pdf",
  ".png",
  ".svg",
  ".webp"
]);
let isBuilding = false;
let lastBuildCheck = 0;

function latestSourceTime(directory) {
  if (!existsSync(directory)) return 0;
  let latest = statSync(directory).mtimeMs;

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const filePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      latest = Math.max(latest, latestSourceTime(filePath));
      continue;
    }
    if (entry.isFile() && sourceExtensions.has(extname(entry.name).toLowerCase())) {
      latest = Math.max(latest, statSync(filePath).mtimeMs);
    }
  }

  return latest;
}

function latestFileTime(file) {
  return existsSync(file) ? statSync(file).mtimeMs : 0;
}

function generatedTime() {
  if (generatedOutputs.some((file) => !existsSync(file))) return 0;
  return Math.min(...generatedOutputs.map((file) => statSync(file).mtimeMs));
}

function refreshGeneratedContent() {
  const now = Date.now();
  if (isBuilding || now - lastBuildCheck < 750) return;
  lastBuildCheck = now;

  const latest = Math.max(
    ...sourceFolders.map(latestSourceTime),
    ...sourceFiles.map(latestFileTime)
  );
  if (latest <= generatedTime()) return;

  isBuilding = true;
  const result = spawnSync(process.execPath, [join(root, "scripts", "build.mjs")], {
    cwd: root,
    stdio: "inherit"
  });
  isBuilding = false;

  if (result.error) console.error(result.error);
}

function stripLeadingSlashes(value = "") {
  let clean = String(value);
  while (clean.startsWith("/")) clean = clean.slice(1);
  return clean;
}

function resolvePath(url) {
  const cleanUrl = stripLeadingSlashes(decodeURIComponent(url.split("?")[0]));
  let filePath = resolve(publicRoot, cleanUrl);
  if (filePath !== publicRoot && !filePath.startsWith(publicRoot + "\\")) return null;
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, "index.html");
  }
  return filePath;
}

createServer((request, response) => {
  refreshGeneratedContent();
  const filePath = resolvePath(request.url || "/");
  if (!filePath || !existsSync(filePath)) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, { "content-type": types[extname(filePath)] || "application/octet-stream" });
  createReadStream(filePath).pipe(response);
}).listen(port, () => {
  console.log(`Serving http://localhost:${port}`);
});
