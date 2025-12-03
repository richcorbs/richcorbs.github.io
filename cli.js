import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { marked } from "marked";
import http from "http";
import chokidar from "chokidar";
import sirv from "sirv";
import matter from "gray-matter";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, "src");
const PAGES = path.join(SRC, "pages");
const LAYOUTS = path.join(SRC, "layouts");
const PARTIALS = path.join(SRC, "partials");
const DIST = path.join(__dirname, "dist");
const PORT = 8000;

/* ---------------------------
   CLI
   --------------------------- */
const args = process.argv.slice(2);
const command = args[0];

if (command === "build") {
  build()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
} else if (command === "dev") {
  dev().catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else {
  console.log("Usage: node cli.js <build|dev>");
  process.exit(1);
}

/* ---------------------------
   Utility: Recursive file reading
   --------------------------- */
async function readFilesRecursive(dir, baseDir = dir) {
  const results = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const subFiles = await readFilesRecursive(fullPath, baseDir);
        results.push(...subFiles);
      } else {
        results.push({
          path: fullPath,
          relativePath: path.relative(baseDir, fullPath),
        });
      }
    }
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
  return results;
}

/* ---------------------------
   Templates (layouts & partials)
   --------------------------- */
let templateCache = Object.create(null);

// Pre-compiled regex patterns for performance
const CONTENT_REGEX = /\{\{\s*content\s*\}\}/gi;
const PARTIAL_REGEX = /\{\{\s*([a-zA-Z0-9_\/-]+)\s*\}\}/g;

async function loadTemplates() {
  templateCache = Object.create(null);

  // Load layouts
  const layoutFiles = await readFilesRecursive(LAYOUTS);
  await Promise.all(
    layoutFiles.map(async (file) => {
      if (!file.path.endsWith(".html")) return;
      const content = await fs.readFile(file.path, "utf8");
      const key = "layouts/" + file.relativePath.replace(/\.html$/, "").replace(/\\/g, "/");
      templateCache[key] = content;
    }),
  );

  // Load partials
  const partialFiles = await readFilesRecursive(PARTIALS);
  await Promise.all(
    partialFiles.map(async (file) => {
      if (!file.path.endsWith(".html")) return;
      const content = await fs.readFile(file.path, "utf8");
      const key = file.relativePath.replace(/\.html$/, "").replace(/\\/g, "/");
      templateCache[key] = content;
    }),
  );
}

function applyTemplates(html, data) {
  return html.replace(PARTIAL_REGEX, (match, name) => {
    // First check if it's a partial
    if (templateCache[name]) {
      return templateCache[name];
    }
    // Then check if it's a frontmatter variable
    if (data[name] !== undefined) {
      return data[name];
    }
    // Leave unchanged if neither
    return match;
  });
}

async function renderPage(rawContent, frontmatter, isMarkdown = true) {
  // Convert markdown to HTML if needed
  const htmlBody = isMarkdown ? marked.parse(rawContent) : rawContent;

  // Get layout from frontmatter or use default
  const layoutName = frontmatter.layout || "default";
  const layoutHtml = templateCache[`layouts/${layoutName}`];

  if (!layoutHtml) {
    throw new Error(`Layout "${layoutName}" not found. Create src/layouts/${layoutName}.html`);
  }

  // Merge content into layout
  let merged = layoutHtml.replace(CONTENT_REGEX, htmlBody);

  // Apply partials and variables (single pass)
  merged = applyTemplates(merged, frontmatter);

  return merged;
}

/* ---------------------------
   Pretty URL logic
   --------------------------- */
function outputPathForPage(filename) {
  const name = filename.replace(/\.(md|html)$/, "");
  return name === "index" ? "index.html" : path.join(name, "index.html");
}

/* ---------------------------
   Live reload (SSE) + inject script
   --------------------------- */
let reloadClients = [];

function startReloadServerFor(server) {
  server.on("request", (req, res) => {
    if (req.url === "/livereload") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write("\n");
      reloadClients.push(res);
      req.on("close", () => {
        reloadClients = reloadClients.filter((r) => r !== res);
      });
    }
  });
}

function triggerReload() {
  reloadClients.forEach((res) => {
    res.write(`event: reload\ndata: ${Date.now()}\n\n`);
  });
}

function injectReloadScript(html) {
  const script = `<script>
    (function(){
      const es = new EventSource('/livereload');
      es.addEventListener('reload', function(){ location.reload(); });
    })();
  </script></body>`;
  return html.replace(/<\/body>/i, script);
}

/* ---------------------------
   Build tasks
   --------------------------- */
async function cleanDist() {
  try {
    await fs.rm(DIST, { recursive: true, force: true });
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
}

async function buildPagesTask() {
  const files = await readFilesRecursive(PAGES);
  const pageFiles = files.filter((f) => f.path.endsWith(".md") || f.path.endsWith(".html"));

  await Promise.all(pageFiles.map(async (file) => {
    try {
      const raw = await fs.readFile(file.path, "utf8");
      const isMarkdown = file.path.endsWith(".md");

      // Parse frontmatter
      const { data: frontmatter, content } = matter(raw);

      // Render page
      const rendered = await renderPage(content, frontmatter, isMarkdown);

      // Write output
      const out = file.relativePath.endsWith(".html")
        ? file.relativePath
        : outputPathForPage(file.relativePath);
      const outDir = path.dirname(path.join(DIST, out));
      await fs.mkdir(outDir, { recursive: true });
      await fs.writeFile(path.join(DIST, out), rendered, "utf8");

      console.log(`✓ Built ${out}`);
    } catch (err) {
      console.error(`\n❌ Error building ${file.relativePath}:`);
      console.error(`   ${err.message}`);
      throw err;
    }
  }));
}

async function copyAssetsTask() {
  const src = path.join(SRC, "assets");
  const dest = path.join(DIST, "assets");

  async function copyRecursive(srcPath, destPath) {
    const stat = await fs.stat(srcPath);

    if (stat.isDirectory()) {
      await fs.mkdir(destPath, { recursive: true });
      const entries = await fs.readdir(srcPath);
      await Promise.all(
        entries.map((entry) =>
          copyRecursive(path.join(srcPath, entry), path.join(destPath, entry))
        )
      );
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }

  try {
    await copyRecursive(src, dest);
    console.log("✓ Copied assets");
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
}

async function build() {
  const startTime = performance.now();
  console.log("Building...");

  await cleanDist();
  await loadTemplates();
  await Promise.all([buildPagesTask(), copyAssetsTask()]);

  const duration = (performance.now() - startTime).toFixed(2);
  console.log(`✓ Build complete (${duration}ms)`);
}

/* ---------------------------
   Dev mode
   --------------------------- */
let rebuildTimer = null;
const DEBOUNCE_MS = 120;

function scheduleDebouncedRebuild() {
  if (rebuildTimer) clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(async () => {
    console.log("\nRebuilding...");
    try {
      await build();
      triggerReload();
    } catch (err) {
      console.error("Build error:", err.message);
    }
  }, DEBOUNCE_MS);
}

async function dev() {
  // Initial build
  await build().catch((err) => console.error("Initial build failed:", err));

  // Create server with sirv for static files
  const serve = sirv(DIST, {
    dev: true,
    single: false,
  });

  const server = http.createServer(async (req, res) => {
    // Handle live reload endpoint
    if (req.url === "/livereload") return;

    // Serve static files with sirv
    serve(req, res, () => {
      // If sirv doesn't find the file, try injecting reload script for HTML
      if (req.url.endsWith("/") || !path.extname(req.url)) {
        const htmlPath = req.url.endsWith("/")
          ? path.join(DIST, req.url, "index.html")
          : path.join(DIST, req.url, "index.html");

        fs.readFile(htmlPath, "utf8")
          .then((data) => {
            const injected = injectReloadScript(data);
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            res.end(injected);
          })
          .catch(() => {
            res.writeHead(404, { "Content-Type": "text/plain" });
            res.end("Not Found");
          });
      } else {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
      }
    });
  });

  startReloadServerFor(server);

  // Watch src directory
  chokidar.watch(SRC, {
    ignoreInitial: true,
    ignored: [
      /(^|[\/\\])\../,
      /\.DS_Store$/,
      /~$/,
      /\.swp$/,
      /\.tmp$/,
      /#.*#$/,
      /\.lock$/
    ]
  }).on("all", () => {
    scheduleDebouncedRebuild();
  });

  server.listen(PORT, () => {
    console.log(`\nDev server: http://localhost:${PORT}`);
    console.log("Watching src/ for changes...\n");
  });
}
