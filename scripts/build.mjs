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

function isRemoteAsset(url = "") {
  return url.startsWith("https://") || url.startsWith("http://");
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

const assetVersion = Date.now().toString(36);
const threeVersion = "0.184.0";
const threeCdn = `https://cdn.jsdelivr.net/npm/three@${threeVersion}`;
const fontsUrl = "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..600;1,9..144,400..600&family=Inter:wght@400..700&family=JetBrains+Mono:wght@400;500&display=swap";
const contact = {
  email: "zhizheng835@gmail.com",
  github: "https://github.com/LepronlineR",
  linkedin: "https://www.linkedin.com/in/zhizheng1/",
  youtube: "https://www.youtube.com/@zhizheng2913",
  resume: "/resume/Zhi_Zheng_Resume.pdf"
};
const navItems = [
  { id: "home", label: "Home", href: "/" },
  { id: "interactive", label: "Interactive", href: "/portfolio/" },
  { id: "projects", label: "Projects", href: "/projects/" },
  { id: "blog", label: "Blog", href: "/blog/" },
  { id: "resume", label: "R&eacute;sum&eacute;", href: "/resume/" }
];

const themeBootScript = `<script>
      (function () {
        try {
          var stored = localStorage.getItem("siteTheme") || localStorage.getItem("blogTheme");
          var theme = stored || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
          document.documentElement.dataset.theme = theme;
        } catch (error) {}
      })();
    </script>`;

// Shared <head> tags. Pages that are always dark skip the theme boot script.
function headPartial({ themed = true } = {}) {
  return `<link rel="icon" href="/favicon.ico">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="${fontsUrl}">
    ${themed ? themeBootScript : ""}
    <link rel="stylesheet" href="/styles/site.css?v=${assetVersion}">`;
}

function threePartial() {
  const importMap = JSON.stringify({
    imports: {
      three: `${threeCdn}/build/three.module.min.js`,
      "three/addons/": `${threeCdn}/examples/jsm/`
    }
  });
  return `<script type="importmap">${importMap}</script>`;
}

function headerPartial(active = "", { toggle = true } = {}) {
  const links = navItems.map((item) => {
    const current = item.id === active ? ' class="is-active" aria-current="page"' : "";
    return `<a${current} href="${item.href}">${item.label}</a>`;
  }).join("\n          ");
  const themeToggle = toggle
    ? `<button class="theme-toggle" type="button" data-theme-toggle aria-label="Switch color theme">
          <svg class="icon-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
          <svg class="icon-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z"/></svg>
        </button>`
    : "";
  return `<a class="skip-link" href="#main">Skip to content</a>
    <header class="site-header">
      <div class="header-inner">
        <a class="brand" href="/" aria-label="Zhi Zheng, home">
          <span class="brand-mark" aria-hidden="true"><img src="/favicon.ico" alt="" width="22" height="22"></span>
          <span class="brand-name">Zhi Zheng</span>
        </a>
        <nav class="nav-links" aria-label="Primary">
          ${links}
        </nav>
        ${themeToggle}
      </div>
    </header>`;
}

function footerPartial() {
  return `<footer class="site-footer" id="contact">
      <div class="footer-inner">
        <div class="footer-cta">
          <p class="eyebrow">Contact</p>
          <a class="footer-email" href="mailto:${contact.email}">${contact.email}</a>
        </div>
        <ul class="footer-links">
          <li><a href="${contact.github}" target="_blank" rel="noopener noreferrer">GitHub</a></li>
          <li><a href="${contact.linkedin}" target="_blank" rel="noopener noreferrer">LinkedIn</a></li>
          <li><a href="${contact.youtube}" target="_blank" rel="noopener noreferrer">YouTube</a></li>
          <li><a href="/resume/">R&eacute;sum&eacute;</a></li>
        </ul>
        <p class="footer-fine">
          <span>&copy; ${new Date().getFullYear()} Zhi Zheng</span>
        </p>
      </div>
    </footer>
    <script src="/scripts/theme.js" defer></script>
    <script type="module" src="/scripts/main.js"></script>`;
}

function hasMath(html = "") {
  return html.includes("$") || html.includes("\\(") || html.includes("\\[");
}

function pageShell({ title, description, body, pageClass = "blog-page", active = "blog", extraScripts = "" }) {
  const mathScripts = hasMath(body)
    ? `<script>
      window.MathJax = {
        tex: {
          inlineMath: [["$", "$"], ["\\\\(", "\\\\)"]],
          displayMath: [["$$", "$$"], ["\\\\[", "\\\\]"]],
          processEscapes: true
        }
      };
    </script>
    <script defer src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js"></script>`
    : "";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${escapeHtml(description || "Zhi Zheng's blog")}">
    <title>${escapeHtml(title)} | Zhi Zheng</title>
    ${headPartial()}
    ${mathScripts}
  </head>
  <body class="${pageClass}">
    ${headerPartial(active)}
    ${body}
    ${footerPartial()}
    ${extraScripts}
  </body>
</html>`;
}

function formatDate(date, options) {
  return date.getFullYear() > 1970 ? date.toLocaleDateString("en-US", options) : "";
}

function tagRow(tags = [], limit = 4) {
  const items = tags.slice(0, limit).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
  return items ? `<span class="tag-row">${items}</span>` : "";
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

function postCard(post, index = 99) {
  const date = formatDate(post.date, { year: "numeric", month: "short", day: "numeric" }) || "Undated";
  const tagKeys = post.tags.map(slugify).join(" ");
  return `<a class="media-card blog-card" href="/blog/${post.slug}.html" data-tags="${escapeHtml(tagKeys)}">
    <span class="media-card-image"><img src="${escapeHtml(post.cover)}" alt="" loading="${index < 3 ? "eager" : "lazy"}" decoding="async"></span>
    <span class="media-card-body">
      <span class="date">${date}</span>
      <span class="media-card-title">${escapeHtml(post.title)}</span>
      <span class="post-summary">${escapeHtml(post.description)}</span>
      ${tagRow(post.tags)}
    </span>
  </a>`;
}

function postRow(post) {
  const date = formatDate(post.date, { year: "numeric", month: "short" }) || "Undated";
  return `<a class="note-row" href="/blog/${post.slug}.html">
            <time datetime="${post.date.toISOString().slice(0, 10)}">${date}</time>
            <span>
              <span class="note-title">${escapeHtml(post.title)}</span>
              <span class="note-desc">${escapeHtml(post.description || post.tags.join(", "))}</span>
            </span>
            <span class="arrow" aria-hidden="true">&rarr;</span>
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

function projectCard(project, index = 99) {
  const date = formatDate(project.date, { year: "numeric", month: "short" }) || "Project";
  const image = project.cover
    ? `<span class="media-card-image"><img src="${escapeHtml(project.cover)}" alt="" loading="${index < 3 ? "eager" : "lazy"}" decoding="async"></span>`
    : `<span class="media-card-image is-empty"></span>`;
  return `<a class="media-card" href="/projects/${project.slug}/">
    ${image}
    <span class="media-card-body">
      <span class="date">${date}</span>
      <span class="media-card-title">${escapeHtml(project.title)}</span>
      <span class="post-summary">${escapeHtml(project.description || "Project notes and implementation details.")}</span>
      ${tagRow(project.tags)}
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
    const cover = data.cover && (isRemoteAsset(data.cover) || existsSync(join(root, stripLeadingSlashes(data.cover))))
      ? data.cover
      : "";
    const featured = Number(data.featured || 0);
    projects.push({
      slug,
      title,
      description,
      date: Number.isNaN(date.valueOf()) ? new Date(0) : date,
      cover,
      featured,
      tags: data.tags || [],
      data,
      body
    });
  }

  return projects.sort((a, b) => b.featured - a.featured || b.date - a.date);
}

function articlePage({ kind, backHref, backLabel, title, description, meta, tags, content }) {
  const summary = description ? `<p class="post-summary">${escapeHtml(description)}</p>` : "";
  const metaRow = meta || tags.length
    ? `<div class="post-meta">${meta ? `<span>${meta}</span>` : ""}${tagRow(tags, 8)}</div>`
    : "";
  return `<main id="main" class="post-wrap">
      <header class="post-header">
        <a class="back-link" href="${backHref}"><span class="arrow" aria-hidden="true">&larr;</span> ${backLabel}</a>
        <p class="eyebrow">${kind}</p>
        <h1>${escapeHtml(title)}</h1>
        ${summary}
        ${metaRow}
      </header>
      <article class="post-content">
        ${content}
      </article>
      <nav class="post-end" aria-label="More">
        <a class="text-link" href="${backHref}"><span class="arrow" aria-hidden="true">&larr;</span> ${backLabel}</a>
        <a class="text-link" href="#contact">Get in touch <span class="arrow" aria-hidden="true">&rarr;</span></a>
      </nav>
    </main>`;
}

async function buildProjects(projects) {
  await mkdir(projectOutDir, { recursive: true });

  for (const project of projects) {
    const body = articlePage({
      kind: "Project",
      backHref: "/projects/",
      backLabel: "All projects",
      title: project.title,
      description: project.description,
      meta: formatDate(project.date, { year: "numeric", month: "long" }),
      tags: project.tags,
      content: await markdownToHtml(project.body, project)
    });
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

  const indexBody = `<main id="main" class="index-wrap">
    <section class="index-hero">
      <h1>Projects</h1>
    </section>
    <section class="card-grid" aria-label="Projects">
      ${projects.map(projectCard).join("\n")}
    </section>
  </main>`;

  await writeFile(join(projectOutDir, "index.html"), pageShell({
    title: "Projects",
    description: "Projects by Zhi Zheng: simulation, graphics, tools, and games.",
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

// Inlines the @import lines of styles/site.css so the browser fetches one stylesheet.
async function bundleStyles() {
  const stylesDir = join(root, "styles");
  const manifest = await readFile(join(stylesDir, "site.css"), "utf8");
  const parts = [];

  for (const line of splitLines(manifest)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("@import")) continue;
    const start = trimmed.indexOf('"');
    const end = trimmed.indexOf('"', start + 1);
    if (start === -1 || end === -1) continue;
    const file = join(stylesDir, trimmed.slice(start + 1, end));
    let css = await readFile(file, "utf8");
    if (css.charCodeAt(0) === 0xfeff) css = css.slice(1);
    parts.push(css.trim());
  }

  if (parts.length) {
    await writeFile(join(publicDir, "styles", "site.css"), parts.join("\n\n") + "\n");
  }
}

// Replaces <!-- include:name args --> comments in a copied static page.
async function applyIncludes(file, includes) {
  const target = join(publicDir, file);
  if (!existsSync(target)) return;
  const source = await readFile(target, "utf8");
  const open = "<!-- include:";
  const close = "-->";
  let output = "";
  let cursor = 0;

  while (cursor < source.length) {
    const start = source.indexOf(open, cursor);
    if (start === -1) break;
    const end = source.indexOf(close, start);
    if (end === -1) break;
    const [name, ...args] = splitWords(source.slice(start + open.length, end));
    const render = includes[name];
    output += source.slice(cursor, start);
    output += render ? render(args) : source.slice(start, end + close.length);
    cursor = end + close.length;
  }

  await writeFile(target, output + source.slice(cursor));
}

async function build() {
  await copyStaticFiles();
  await bundleStyles();
  const posts = await readPosts();
  const projects = await readProjects();
  await mkdir(outDir, { recursive: true });
  await buildProjects(projects);

  for (const post of posts) {
    const body = articlePage({
      kind: "Blog",
      backHref: "/blog/",
      backLabel: "All posts",
      title: post.title,
      description: post.description,
      meta: formatDate(post.date, { year: "numeric", month: "long", day: "numeric" }),
      tags: post.tags,
      content: await markdownToHtml(post.body, post)
    });
    await writeFile(join(outDir, `${post.slug}.html`), pageShell({
      title: post.title,
      description: post.description,
      body
    }));
  }

  const indexBody = `<main id="main" class="index-wrap">
    <section class="index-hero">
      <h1>Blog</h1>
    </section>
    ${blogTagFilters(posts)}
    <section class="card-grid" aria-label="Blog posts">
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

  const includes = {
    head: () => headPartial(),
    "head-static": () => headPartial({ themed: false }),
    three: () => threePartial(),
    header: ([active = "", option = ""]) => headerPartial(active, { toggle: option !== "no-toggle" }),
    footer: () => footerPartial(),
    "latest-posts": () => posts.slice(0, 4).map(postRow).join("\n          ")
  };
  await applyIncludes("index.html", includes);
  await applyIncludes(join("portfolio", "index.html"), includes);
  await applyIncludes(join("resume", "index.html"), includes);
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
