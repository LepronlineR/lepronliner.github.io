import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, dirname, extname, join, relative, sep } from "node:path";
import { createHighlighter } from "shiki";

const root = process.cwd();
const publicDir = join(root, "public");
const postSources = ["content/blog", "_posts"];
const projectSourceDir = join(root, "content", "projects");
const outDir = join(publicDir, "blog");
const projectOutDir = join(publicDir, "projects");
const blogAssetDir = join(root, "assets", "blogs");
const blogImageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]);
const staticFiles = ["favicon.ico", "index.html"];
const staticFolders = ["assets", "portfolio", "resume", "scripts", "styles"];
const buildOnlyFiles = new Set(["scripts/build.mjs", "scripts/dev-server.mjs"]);
const codeTheme = "github-dark";
const codeLanguages = [
  "bash",
  "c",
  "cpp",
  "css",
  "csv",
  "csharp",
  "diff",
  "html",
  "java",
  "javascript",
  "json",
  "markdown",
  "python",
  "shell",
  "sh",
  "typescript",
  "yaml"
];
let codeHighlighter;

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function isDigit(character) {
  const code = character.charCodeAt(0);
  return code >= 48 && code <= 57;
}

function isLowerAlpha(character) {
  const code = character.charCodeAt(0);
  return code >= 97 && code <= 122;
}

function isAlphaNumeric(character) {
  return isLowerAlpha(character) || isDigit(character);
}

function isWhitespace(character) {
  return character === " " || character === "\n" || character === "\r" || character === "\t";
}

function splitLines(value = "") {
  return String(value).replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
}

function splitWords(value = "") {
  const words = [];
  let word = "";

  for (const character of String(value).trim()) {
    if (isWhitespace(character)) {
      if (word) words.push(word);
      word = "";
    } else {
      word += character;
    }
  }

  if (word) words.push(word);
  return words;
}

function stripLeadingSlashes(value = "") {
  let clean = String(value);
  while (clean.startsWith("/")) clean = clean.slice(1);
  return clean;
}

function titleFromSlug(slug) {
  return splitWords(String(slug).split("-").join(" ")).join(" ");
}

function stripWrappingQuotes(value = "") {
  const trimmed = String(value).trim();
  if (trimmed.length < 2) return trimmed;
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  return (first === last && (first === "'" || first === '"')) ? trimmed.slice(1, -1) : trimmed;
}

function slugify(value) {
  let source = String(value).toLowerCase();
  if (source.endsWith(".md")) source = source.slice(0, -3);
  if (
    source.length > 10 &&
    [...source.slice(0, 4)].every(isDigit) &&
    source[4] === "-" &&
    [...source.slice(5, 7)].every(isDigit) &&
    source[7] === "-" &&
    [...source.slice(8, 10)].every(isDigit) &&
    source[10] === "-"
  ) {
    source = source.slice(11);
  }

  let slug = "";
  for (const character of source) {
    if (isAlphaNumeric(character)) {
      slug += character;
    } else if (slug && !slug.endsWith("-")) {
      slug += "-";
    }
  }

  return slug.endsWith("-") ? slug.slice(0, -1) : slug;
}

function assetUrl(file) {
  return `/${relative(root, file).split(sep).map(encodeURIComponent).join("/")}`;
}

function tokenize(value = "") {
  const tokens = [];
  let token = "";
  let previousType = "";

  for (const character of String(value).toLowerCase()) {
    if (!isAlphaNumeric(character)) {
      if (token) tokens.push(token);
      token = "";
      previousType = "";
      continue;
    }

    const type = isDigit(character) ? "number" : "letter";
    if (token && previousType && previousType !== type) {
      tokens.push(token);
      token = "";
    }
    token += character;
    previousType = type;
  }

  if (token) tokens.push(token);
  return tokens;
}

function tokenMatches(a, b) {
  const singularA = a.endsWith("s") ? a.slice(0, -1) : a;
  const singularB = b.endsWith("s") ? b.slice(0, -1) : b;
  return a === b || singularA === singularB;
}

async function getCodeHighlighter() {
  if (!codeHighlighter) {
    codeHighlighter = await createHighlighter({
      themes: [codeTheme],
      langs: codeLanguages
    });
  }
  return codeHighlighter;
}

function normalizeCodeLanguage(language = "") {
  const normalized = String(language).trim().toLowerCase();
  const aliases = {
    cplusplus: "cpp",
    "c++": "cpp",
    cs: "csharp",
    js: "javascript",
    md: "markdown",
    py: "python",
    ts: "typescript",
    yml: "yaml",
    zsh: "shell"
  };
  return aliases[normalized] || normalized || "text";
}

function codeHtmlInner(html) {
  const codeStart = html.indexOf("<code>");
  const codeEnd = html.lastIndexOf("</code></pre>");
  return codeStart >= 0 && codeEnd > codeStart ? html.slice(codeStart + 6, codeEnd) : "";
}

function parseList(value = "") {
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return trimmed ? [trimmed] : [];
  return trimmed.slice(1, -1).split(",").map((item) => item.trim()).filter(Boolean);
}

function parseFrontMatterLine(line) {
  const colonIndex = line.indexOf(":");
  if (colonIndex < 1) return null;

  const key = line.slice(0, colonIndex);
  const isValidKey = [...key].every((character) => {
    return isAlphaNumeric(character.toLowerCase()) || character === "_" || character === "-";
  });
  if (!isValidKey) return null;

  return [key, stripWrappingQuotes(line.slice(colonIndex + 1))];
}

function parseFrontMatter(source) {
  if (!source.startsWith("---")) return [{}, source];
  const end = source.indexOf("\n---", 3);
  if (end === -1) return [{}, source];
  const raw = source.slice(3, end).trim();
  const body = source.slice(end + 4).trim();
  const data = {};

  splitLines(raw).forEach((line) => {
    const entry = parseFrontMatterLine(line);
    if (!entry) return;
    const [key, value] = entry;
    data[key] = value;
  });

  if (data.tags) data.tags = parseList(data.tags);
  if (data.categories) data.categories = parseList(data.categories);
  return [data, body];
}

function resolveImageFromAssets(imagePath, post = {}) {
  if (!imagePath) return "";
  if (imagePath.startsWith("/") && existsSync(join(root, imagePath.slice(1)))) return imagePath;

  const images = post.assetImages || [];
  const imageBase = basename(imagePath);
  const imageStem = basename(imagePath, extname(imagePath));
  const imageTokens = tokenize(imageStem);

  const exactBase = images.find((image) => image.base.toLowerCase() === imageBase.toLowerCase());
  if (exactBase) return exactBase.url;

  const exactStem = images.find((image) => image.name.toLowerCase() === imageStem.toLowerCase());
  if (exactStem) return exactStem.url;

  const closeStem = images.find((image) => {
    const candidate = image.name.toLowerCase();
    const target = imageStem.toLowerCase();
    return candidate.startsWith(target) || target.startsWith(candidate);
  });
  if (closeStem) return closeStem.url;

  const tokenMatch = images.find((image) => {
    return imageTokens.length && imageTokens.every((token) => {
      return image.tokens.some((imageToken) => tokenMatches(token, imageToken));
    });
  });
  if (tokenMatch) return tokenMatch.url;

  return imagePath;
}

function localAssetExists(url = "") {
  return url.startsWith("/") && existsSync(join(root, stripLeadingSlashes(url)));
}

function renderImage(raw, post = {}) {
  const pieces = splitWords(raw);
  const imagePath = pieces.find((piece) => (piece.startsWith("/") || piece.includes(".")) && !piece.includes(":"));
  const caption = pieces.filter((piece) => piece !== imagePath && !piece.includes(":")).join(" ");
  const width = pieces.find((piece) => piece.toLowerCase().startsWith("width:"))?.split(":").slice(1).join(":");
  const resolvedPath = resolveImageFromAssets(imagePath, post);
  const label = caption || (imagePath ? tokenize(basename(imagePath, extname(imagePath))).join(" ") : "Referenced image");
  const widthStyle = width ? ` style="--image-width: ${escapeHtml(width)}"` : "";

  if (!resolvedPath || !localAssetExists(resolvedPath)) {
    const missing = imagePath ? basename(imagePath) : "Referenced image";
    return `<figure class="media-placeholder"><span>${escapeHtml(missing)}</span>${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}</figure>`;
  }

  return `<figure class="post-image"${widthStyle}><img src="${escapeHtml(resolvedPath)}" alt="${escapeHtml(label)}" loading="lazy">${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}</figure>`;
}

function firstWord(value = "") {
  const trimmed = String(value).trim();
  const boundary = [...trimmed].findIndex(isWhitespace);
  if (boundary === -1) return [trimmed, ""];
  return [trimmed.slice(0, boundary), trimmed.slice(boundary).trim()];
}

function stripTrailingOption(value, optionName) {
  const words = splitWords(value);
  const last = words.at(-1) || "";
  return last.toLowerCase().startsWith(`${optionName}:`) ? words.slice(0, -1).join(" ") : value.trim();
}

function renderHexoTag(rawTag, post) {
  const [command, args] = firstWord(rawTag);
  const normalizedCommand = command.toLowerCase();

  if (normalizedCommand === "grid") return '<div class="post-grid">';
  if (normalizedCommand === "endgrid") return "</div>";
  if (["box", "endbox", "folders", "endfolders", "banner", "endbanner"].includes(normalizedCommand)) return "";
  if (normalizedCommand === "image") return renderImage(args, post);

  if (normalizedCommand === "link") {
    const [url, label] = firstWord(args);
    const cleanLabel = splitWords(label).filter((word) => !word.toLowerCase().startsWith("icon:")).join(" ");
    return `[${cleanLabel}](${url})`;
  }

  if (normalizedCommand === "video" && args.startsWith("youtube:")) {
    const id = firstWord(args.slice("youtube:".length))[0];
    return `<iframe class="video-embed" src="https://www.youtube.com/embed/${id}" title="Video" loading="lazy" allowfullscreen></iframe>`;
  }

  if (normalizedCommand === "note") {
    return `<blockquote>${stripTrailingOption(args, "color")}</blockquote>`;
  }

  if (normalizedCommand === "mark") {
    return `<mark>${args.trim()}</mark>`;
  }

  return `{% ${rawTag} %}`;
}

function transformHexoLine(line, post) {
  let output = "";
  let cursor = 0;

  while (cursor < line.length) {
    const cellStart = line.indexOf("<!--", cursor);
    const tagStart = line.indexOf("{%", cursor);
    const nextStart = [cellStart, tagStart].filter((index) => index >= 0).sort((a, b) => a - b)[0];
    if (nextStart === undefined) {
      output += line.slice(cursor);
      break;
    }

    output += line.slice(cursor, nextStart);
    if (nextStart === cellStart) {
      const cellEnd = line.indexOf("-->", cellStart + 4);
      const comment = cellEnd >= 0 ? line.slice(cellStart + 4, cellEnd).trim() : "";
      if (comment === "cell") {
        cursor = cellEnd >= 0 ? cellEnd + 3 : line.length;
      } else {
        output += line.slice(cellStart, cellEnd >= 0 ? cellEnd + 3 : line.length);
        cursor = cellEnd >= 0 ? cellEnd + 3 : line.length;
      }
      continue;
    }

    const tagEnd = line.indexOf("%}", tagStart + 2);
    if (tagEnd === -1) {
      output += line.slice(tagStart);
      break;
    }

    output += renderHexoTag(line.slice(tagStart + 2, tagEnd).trim(), post);
    cursor = tagEnd + 2;
  }

  return output;
}

function transformHexo(source, post = {}) {
  return transformHexoLine(source, post);
}

function parseMarkdownLink(source, start) {
  const isImage = source[start] === "!" && source[start + 1] === "[";
  const labelStart = start + (isImage ? 2 : 1);
  const labelEnd = source.indexOf("]", labelStart);
  if (labelEnd === -1 || source[labelEnd + 1] !== "(") return null;
  const urlEnd = source.indexOf(")", labelEnd + 2);
  if (urlEnd === -1) return null;

  return {
    isImage,
    label: source.slice(labelStart, labelEnd),
    url: source.slice(labelEnd + 2, urlEnd),
    end: urlEnd + 1
  };
}

function inlineMarkdown(value, post = {}) {
  const source = String(value);
  let html = "";
  let cursor = 0;

  function appendText(text) {
    html += escapeHtml(text);
  }

  while (cursor < source.length) {
    if (source[cursor] === "`") {
      const end = source.indexOf("`", cursor + 1);
      if (end !== -1) {
        html += `<code>${escapeHtml(source.slice(cursor + 1, end))}</code>`;
        cursor = end + 1;
        continue;
      }
    }

    if (source[cursor] === "!" && source[cursor + 1] === "[") {
      const image = parseMarkdownLink(source, cursor);
      if (image) {
        const resolvedPath = resolveImageFromAssets(image.url, post);
        html += `<img class="inline-post-image" src="${escapeHtml(resolvedPath)}" alt="${escapeHtml(image.label)}" loading="lazy">`;
        cursor = image.end;
        continue;
      }
    }

    if (source[cursor] === "[") {
      const link = parseMarkdownLink(source, cursor);
      if (link) {
        html += `<a href="${escapeHtml(link.url)}">${escapeHtml(link.label)}</a>`;
        cursor = link.end;
        continue;
      }
    }

    if (source.startsWith("**", cursor)) {
      const end = source.indexOf("**", cursor + 2);
      if (end !== -1) {
        html += `<strong>${escapeHtml(source.slice(cursor + 2, end))}</strong>`;
        cursor = end + 2;
        continue;
      }
    }

    if (source[cursor] === "*") {
      const end = source.indexOf("*", cursor + 1);
      if (end !== -1) {
        html += `<em>${escapeHtml(source.slice(cursor + 1, end))}</em>`;
        cursor = end + 1;
        continue;
      }
    }

    const nextSpecials = ["`", "![", "[", "**", "*"]
      .map((marker) => source.indexOf(marker, cursor + 1))
      .filter((index) => index !== -1);
    const next = nextSpecials.length ? Math.min(...nextSpecials) : source.length;
    appendText(source.slice(cursor, next));
    cursor = next;
  }

  return html;
}

async function renderCodeBlock(language, lines) {
  const cleanLanguage = normalizeCodeLanguage(language);
  const classLanguage = slugify(cleanLanguage) || "text";
  const label = cleanLanguage === "text" ? "code" : cleanLanguage;
  const source = lines.join("\n");
  const lineCount = Math.max(lines.length, 1);
  const numbers = Array.from({ length: lineCount }, (_, index) => `<span class="line">${index + 1}</span>`).join("");
  let highlighted = "";

  try {
    const highlighter = await getCodeHighlighter();
    highlighted = codeHtmlInner(highlighter.codeToHtml(source, { lang: cleanLanguage, theme: codeTheme }));
  } catch (error) {
    try {
      const highlighter = await getCodeHighlighter();
      highlighted = codeHtmlInner(highlighter.codeToHtml(source, { lang: "text", theme: codeTheme }));
    } catch (fallbackError) {
      highlighted = escapeHtml(source);
    }
  }
  highlighted = highlighted.replaceAll('</span>\n<span class="line"', '</span><span class="line"');

  return `<figure class="code-block highlight ${escapeHtml(classLanguage)}" data-language="${escapeHtml(label)}"><table><tbody><tr><td class="gutter"><pre>${numbers}</pre></td><td class="code"><pre><code class="language-${escapeHtml(classLanguage)}">${highlighted}</code></pre></td></tr></tbody></table></figure>`;
}

function parseHeading(line) {
  let depth = 0;
  while (line[depth] === "#" && depth < 3) depth += 1;
  if (!depth || !isWhitespace(line[depth] || "")) return null;
  return {
    level: depth + 1,
    text: line.slice(depth).trim()
  };
}

function parseQuote(line) {
  if (!line.startsWith(">")) return null;
  return line[1] === " " ? line.slice(2) : line.slice(1);
}

function parseBullet(line) {
  const trimmed = line.trimStart();
  if ((trimmed.startsWith("- ") || trimmed.startsWith("* ")) && trimmed.length > 2) {
    return trimmed.slice(2);
  }
  return null;
}

async function markdownToHtml(source, post = {}) {
  const lines = splitLines(transformHexo(source, post));
  const html = [];
  let paragraph = [];
  let listOpen = false;
  let inCode = false;
  let codeLanguage = "";
  let codeLines = [];

  function flushParagraph() {
    if (!paragraph.length) return;
    html.push(`<p>${inlineMarkdown(paragraph.join(" "), post)}</p>`);
    paragraph = [];
  }

  function closeList() {
    if (!listOpen) return;
    html.push("</ul>");
    listOpen = false;
  }

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inCode) {
        html.push(await renderCodeBlock(codeLanguage, codeLines));
        inCode = false;
        codeLines = [];
        codeLanguage = "";
      } else {
        flushParagraph();
        closeList();
        inCode = true;
        codeLanguage = line.slice(3).trim();
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      closeList();
      continue;
    }

    if (line.startsWith("<")) {
      flushParagraph();
      closeList();
      html.push(line);
      continue;
    }

    const heading = parseHeading(line);
    if (heading) {
      flushParagraph();
      closeList();
      html.push(`<h${heading.level}>${inlineMarkdown(heading.text, post)}</h${heading.level}>`);
      continue;
    }

    const quote = parseQuote(line);
    if (quote) {
      flushParagraph();
      closeList();
      html.push(`<blockquote>${inlineMarkdown(quote, post)}</blockquote>`);
      continue;
    }

    const bullet = parseBullet(line);
    if (bullet) {
      flushParagraph();
      if (!listOpen) {
        html.push("<ul>");
        listOpen = true;
      }
      html.push(`<li>${inlineMarkdown(bullet, post)}</li>`);
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  closeList();
  return html.join("\n");
}

function defaultCover(slug) {
  return "";
}

async function getBlogTitleImages() {
  if (!existsSync(blogAssetDir)) return [];
  const images = [];

  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const file = join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(file);
        continue;
      }
      if (!entry.isFile() || !blogImageExtensions.has(extname(entry.name).toLowerCase())) continue;
      const folder = basename(dirname(file));
      const name = basename(file, extname(file));
      images.push({
        file,
        url: assetUrl(file),
        folder,
        name,
        base: basename(file),
        tokens: [...tokenize(folder), ...tokenize(name)]
      });
    }
  }

  await walk(blogAssetDir);
  return images.sort((a, b) => a.url.localeCompare(b.url));
}

function titleImageForPost(post, images) {
  const explicitImage = post.data.cover || post.data.image || "";
  const explicitBase = explicitImage ? basename(explicitImage) : "";
  const exactFolder = images.find((image) => slugify(image.folder) === post.slug);
  if (exactFolder) return exactFolder.url;

  const explicitMatch = explicitBase
    ? images.find((image) => image.base.toLowerCase() === explicitBase.toLowerCase())
    : null;
  if (explicitMatch) return explicitMatch.url;

  const postTokens = [...tokenize(post.slug), ...tokenize(post.title)];
  const tokenMatch = images.find((image) => {
    return image.tokens.some((imageToken) => postTokens.some((postToken) => tokenMatches(imageToken, postToken)));
  });
  if (tokenMatch) return tokenMatch.url;

  return explicitImage || defaultCover(post.slug);
}

function assetImagesForPost(post, images) {
  const explicitImage = post.data.cover || post.data.image || "";
  const explicitBase = explicitImage ? basename(explicitImage) : "";
  const postTokens = [...tokenize(post.slug), ...tokenize(post.title)];
  const folders = new Map();

  images.forEach((image) => {
    if (!folders.has(image.folder)) folders.set(image.folder, []);
    folders.get(image.folder).push(image);
  });

  const exactFolder = folders.get(post.slug);
  if (exactFolder) return exactFolder;

  const explicitMatch = explicitBase
    ? images.find((image) => image.base.toLowerCase() === explicitBase.toLowerCase())
    : null;
  if (explicitMatch) return folders.get(explicitMatch.folder) || [];

  let bestFolder = null;
  let bestScore = 0;
  folders.forEach((folderImages, folder) => {
    const folderTokens = tokenize(folder);
    const score = folderTokens.reduce((total, folderToken) => {
      return total + (postTokens.some((postToken) => tokenMatches(folderToken, postToken)) ? 1 : 0);
    }, 0);
    if (score > bestScore) {
      bestScore = score;
      bestFolder = folderImages;
    }
  });

  return bestFolder || [];
}

function pageShell({ title, description, body, pageClass = "blog-page", active = "blog", extraScripts = "" }) {
  const dinosaurMark = `<span class="brand-mark" aria-hidden="true"><img src="/favicon.ico" alt=""></span>`;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${escapeHtml(description || "Zhi Zheng's blog")}">
    <title>${escapeHtml(title)} | Zhi Zheng</title>
    <link rel="icon" href="/favicon.ico">
    <script>
      (function () {
        try {
          var stored = localStorage.getItem("siteTheme") || localStorage.getItem("blogTheme");
          var theme = stored || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
          document.documentElement.dataset.theme = theme;
          document.documentElement.style.colorScheme = theme;
        } catch (error) {}
      })();
    </script>
    <link rel="stylesheet" href="/styles/site.css">
    <script>
      window.MathJax = {
        tex: {
          inlineMath: [["$", "$"], ["\\\\(", "\\\\)"]],
          displayMath: [["$$", "$$"], ["\\\\[", "\\\\]"]],
          processEscapes: true
        }
      };
    </script>
    <script defer src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js"></script>
  </head>
  <body class="${pageClass}">
    <header class="site-header solid">
      <a class="brand" href="/" aria-label="Zhi Zheng home">${dinosaurMark}</a>
      <nav class="nav-links" aria-label="Primary navigation">
        <a${active === "home" ? ' class="is-active" aria-current="page"' : ""} href="/">Home</a>
        <a${active === "interactive" ? ' class="is-active" aria-current="page"' : ""} href="/portfolio">Interactive</a>
        <a${active === "projects" ? ' class="is-active" aria-current="page"' : ""} href="/projects/">Projects</a>
        <a${active === "blog" ? ' class="is-active" aria-current="page"' : ""} href="/blog/">Blog</a>
        <button class="theme-toggle" type="button" data-theme-toggle aria-label="Switch color theme">
          <span class="theme-icon" aria-hidden="true">&#9728;</span>
          <span class="theme-knob" aria-hidden="true"></span>
          <span class="theme-icon" aria-hidden="true">&#9790;</span>
        </button>
      </nav>
    </header>
    ${body}
    <footer class="site-footer">
      <span>&copy; 2026 Zhi Zheng</span>
    </footer>
    <script src="/scripts/theme.js" defer></script>
    ${extraScripts}
  </body>
</html>`;
}

async function getMarkdownFiles(folder) {
  const directory = join(root, folder);
  if (!existsSync(directory)) return [];
  const files = [];

  async function walk(currentDirectory) {
    const entries = await readdir(currentDirectory, { withFileTypes: true });
    for (const entry of entries) {
      const file = join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        await walk(file);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(".md") && entry.name.toLowerCase() !== "readme.md") {
        files.push(file);
      }
    }
  }

  await walk(directory);
  return files;
}

async function getProjectFiles() {
  if (!existsSync(projectSourceDir)) return [];
  const entries = await readdir(projectSourceDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(projectSourceDir, entry.name, "index.md"))
    .filter((file) => existsSync(file));
}

async function readPosts() {
  const files = (await Promise.all(postSources.map(getMarkdownFiles))).flat();
  const titleImages = await getBlogTitleImages();
  const posts = [];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    const [data, body] = parseFrontMatter(source);
    const slug = slugify(data.slug || basename(file));
    const title = data.title || titleFromSlug(slug);
    const tags = data.tags || data.categories || [];
    const description = data.description || "";
    const date = data.date ? new Date(data.date) : new Date(0);
    const post = {
      slug,
      title,
      description,
      tags,
      date: Number.isNaN(date.valueOf()) ? new Date(0) : date,
      data,
      body,
      math: String(data.mathjax).toLowerCase() === "true"
    };
    const assetImages = assetImagesForPost(post, titleImages);
    posts.push({
      ...post,
      assetImages,
      cover: titleImageForPost(post, titleImages)
    });
  }

  return posts.sort((a, b) => b.date - a.date);
}

function postCard(post) {
  const date = post.date.getFullYear() > 1970
    ? post.date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
    : "Undated";
  const tagKeys = post.tags.map(slugify).join(" ");
  return `<a class="blog-card" href="/blog/${post.slug}.html" data-tags="${escapeHtml(tagKeys)}">
    <span class="blog-card-image" style="background-image: url('${escapeHtml(post.cover)}')"></span>
    <span class="blog-card-body">
      <span class="date">${date}</span>
      <span class="blog-card-title">${escapeHtml(post.title)}</span>
      <span class="post-summary">${escapeHtml(post.description)}</span>
      <span class="tag-row">${post.tags.slice(0, 4).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</span>
    </span>
  </a>`;
}

function blogTagFilters(posts) {
  const tags = new Map();
  posts.forEach((post) => {
    post.tags.forEach((tag) => {
      const key = slugify(tag);
      if (!key) return;
      const current = tags.get(key);
      tags.set(key, {
        key,
        label: current?.label || tag,
        count: (current?.count || 0) + 1
      });
    });
  });

  const tagButtons = [...tags.values()]
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((tag) => `<button class="tag-filter-button" type="button" data-tag="${escapeHtml(tag.key)}" aria-pressed="false">${escapeHtml(tag.label)} <span>${tag.count}</span></button>`)
    .join("\n");

  if (!tagButtons) return "";

  return `<section class="tag-filter-panel" aria-label="Filter posts by tag">
      <div class="tag-filter-header">
        <p class="eyebrow">Filter</p>
        <p class="blog-filter-status" data-filter-status>Showing ${posts.length} posts</p>
      </div>
      <div class="tag-filter-list" data-tag-filters>
        ${tagButtons}
      </div>
    </section>`;
}

function projectCard(project) {
  const date = project.date.getFullYear() > 1970
    ? project.date.toLocaleDateString("en-US", { year: "numeric", month: "short" })
    : "Project";
  const image = project.cover
    ? `<span class="project-showcase-image" style="background-image: url('${escapeHtml(project.cover)}')"></span>`
    : `<span class="project-showcase-image is-empty"></span>`;
  return `<a class="project-showcase-card" href="/projects/${project.slug}/">
    ${image}
    <span class="project-showcase-body">
      <span class="date">${date}</span>
      <span class="project-showcase-title">${escapeHtml(project.title)}</span>
      <span class="post-summary">${escapeHtml(project.description || "Project notes and implementation details.")}</span>
    </span>
  </a>`;
}

async function readProjects() {
  const files = await getProjectFiles();
  const projects = [];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    const [data, body] = parseFrontMatter(source);
    const slug = slugify(data.slug || basename(dirname(file)));
    const title = data.title || titleFromSlug(slug);
    const description = data.description || "";
    const date = data.date ? new Date(data.date) : new Date(0);
    const cover = data.cover && existsSync(join(root, stripLeadingSlashes(data.cover))) ? data.cover : "";
    projects.push({
      slug,
      title,
      description,
      date: Number.isNaN(date.valueOf()) ? new Date(0) : date,
      cover,
      data,
      body
    });
  }

  return projects.sort((a, b) => b.date - a.date);
}

async function buildProjects(projects) {
  await mkdir(projectOutDir, { recursive: true });

  for (const project of projects) {
    const date = project.date.getFullYear() > 1970
      ? project.date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
      : "";
    const heroStyle = project.cover ? ` style="background-image: url('${escapeHtml(project.cover)}')"` : "";
    const body = `<main class="post-wrap project-detail-wrap">
      <section class="post-hero post-hero-image project-hero-image"${heroStyle}>
        <div class="post-title-box">
          <p class="eyebrow">Project</p>
          <h1>${escapeHtml(project.title)}</h1>
          <p class="post-meta">${date}</p>
        </div>
      </section>
      <article class="post-content project-content">
        ${await markdownToHtml(project.body, project)}
      </article>
    </main>`;
    const target = join(projectOutDir, project.slug);
    await mkdir(target, { recursive: true });
    await writeFile(join(target, "index.html"), pageShell({
      title: project.title,
      description: project.description,
      body,
      pageClass: "blog-page project-page",
      active: "projects"
    }));
  }

  const indexBody = `<main class="project-showcase-wrap">
    <section class="blog-hero project-showcase-hero">
      <p class="eyebrow">Projects</p>
      <h1>Project Showcase</h1>
      <p class="post-summary">A hidden project index for the island experience.</p>
    </section>
    <section class="project-showcase-grid" aria-label="Project showcase">
      ${projects.map(projectCard).join("\n")}
    </section>
  </main>`;

  await writeFile(join(projectOutDir, "index.html"), pageShell({
    title: "Projects",
    description: "Project showcase for Zhi Zheng.",
    body: indexBody,
    pageClass: "blog-page project-page",
    active: "projects"
  }));

  await writeFile(join(projectOutDir, "projects.json"), JSON.stringify(projects.map((project) => ({
    title: project.title,
    description: project.description,
    cover: project.cover,
    url: `/projects/${project.slug}/`,
    date: project.date.toISOString()
  })), null, 2));
}

async function copyStaticFiles() {
  await rm(publicDir, { recursive: true, force: true });
  await mkdir(publicDir, { recursive: true });

  for (const file of staticFiles) {
    const source = join(root, file);
    if (existsSync(source)) {
      await cp(source, join(publicDir, file));
    }
  }

  for (const folder of staticFolders) {
    const source = join(root, folder);
    if (!existsSync(source)) continue;

    await cp(source, join(publicDir, folder), {
      recursive: true,
      filter: (file) => {
        const projectPath = relative(root, file).split(sep).join("/");
        return !buildOnlyFiles.has(projectPath);
      }
    });
  }
}

async function build() {
  await copyStaticFiles();
  const posts = await readPosts();
  const projects = await readProjects();
  await mkdir(outDir, { recursive: true });
  await buildProjects(projects);

  for (const post of posts) {
    const date = post.date.getFullYear() > 1970
      ? post.date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
      : "";
    const body = `<main class="post-wrap">
      <section class="post-hero post-hero-image" style="background-image: url('${escapeHtml(post.cover)}')">
        <div class="post-title-box">
          <p class="eyebrow">Blog</p>
          <h1>${escapeHtml(post.title)}</h1>
          <p class="post-meta">${[date, post.tags.join(", ")].filter(Boolean).join(" &middot; ")}</p>
        </div>
      </section>
      <article class="post-content">
        ${await markdownToHtml(post.body, post)}
      </article>
    </main>`;
    await writeFile(join(outDir, `${post.slug}.html`), pageShell({
      title: post.title,
      description: post.description,
      body
    }));
  }

  const indexBody = `<main class="blog-wrap">
    <section class="blog-hero">
      <p class="eyebrow">Blog</p>
      <h1>Notes and derivations</h1>
      <p class="post-summary">Math, machine learning, graphics, game systems, and problem solving.</p>
    </section>
    ${blogTagFilters(posts)}
    <section class="blog-list" aria-label="Blog posts">
      ${posts.map(postCard).join("\n")}
    </section>
  </main>`;

  await writeFile(join(outDir, "index.html"), pageShell({
    title: "Blog",
    description: "Technical writing from Zhi Zheng.",
    body: indexBody,
    extraScripts: '<script src="/scripts/blog-filter.js" defer></script>'
  }));

  await writeFile(join(outDir, "posts.json"), JSON.stringify(posts.map((post) => ({
    title: post.title,
    description: post.description,
    tags: post.tags,
    cover: post.cover,
    url: `/blog/${post.slug}.html`,
    date: post.date.toISOString()
  })), null, 2));
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
