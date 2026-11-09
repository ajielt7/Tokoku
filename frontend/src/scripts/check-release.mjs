import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendDirectory = path.resolve(scriptDirectory, "../..");
const outputDirectory = path.join(frontendDirectory, "dist");
const siteConfig = JSON.parse(await readFile(path.join(frontendDirectory, "src/data/site.json"), "utf8"));
const siteUrl = (process.env.SITE_URL || siteConfig.siteUrl || "").trim().replace(/\/$/, "");
const apiBaseUrl = (process.env.PUBLIC_API_BASE_URL || siteConfig.apiBaseUrl || "").trim().replace(/\/$/, "");
const indexable = process.env.SEO_INDEXABLE === "true" || (process.env.SEO_INDEXABLE == null && siteConfig.indexable === true);
const contentReady = process.env.CONTENT_READY === "true" || (process.env.CONTENT_READY == null && siteConfig.contentReady === true);
const previewMode = process.argv.includes("--preview");
const errors = [];

function fail(message) { errors.push(message); }
function attr(tag, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return tag.match(new RegExp(`\\b${escaped}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1] ?? "";
}

async function walk(directory, relative = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path.join(directory, entry.name), child));
    else if (entry.isFile()) files.push(child);
  }
  return files;
}

if (!previewMode) {
  let parsedSiteUrl = null;
  let parsedApiUrl = null;
  try { parsedSiteUrl = new URL(siteUrl); } catch { fail("SITE_URL belum diisi dengan URL publik."); }
  try { parsedApiUrl = new URL(apiBaseUrl); } catch { fail("PUBLIC_API_BASE_URL belum diisi dengan URL Worker."); }
  if (parsedSiteUrl && (parsedSiteUrl.protocol !== "https:" || parsedSiteUrl.username || parsedSiteUrl.password || parsedSiteUrl.search || parsedSiteUrl.hash)) {
    fail("SITE_URL harus HTTPS dan tidak boleh berisi kredensial, query, atau fragment.");
  }
  if (parsedApiUrl && (parsedApiUrl.protocol !== "https:" || parsedApiUrl.username || parsedApiUrl.password || parsedApiUrl.search || parsedApiUrl.hash)) {
    fail("PUBLIC_API_BASE_URL harus HTTPS dan tidak boleh berisi kredensial, query, atau fragment.");
  }
  if (!indexable) fail("SEO_INDEXABLE harus true setelah konten siap ditayangkan.");
  if (!contentReady) fail("CONTENT_READY harus true setelah katalog dan informasi toko ditinjau.");
} else if (indexable) {
  fail("Mode --preview hanya untuk keluaran yang belum diizinkan indeks.");
}

let files = [];
try { files = await walk(outputDirectory); } catch { fail("frontend/dist belum ada; jalankan build-site.mjs terlebih dahulu."); }
const htmlFiles = files.filter((file) => file.endsWith(".html"));
if (!htmlFiles.includes("index.html")) fail("Halaman beranda dist/index.html tidak ditemukan.");
if (htmlFiles.length === 0) fail("Tidak ada halaman HTML yang dibangun.");

const siteBase = siteUrl || "https://ruma.invalid";
let baseUrl;
try { baseUrl = new URL(`${siteBase.replace(/\/$/, "")}/`); } catch { baseUrl = new URL("https://ruma.invalid/"); }
const sitePath = baseUrl.pathname.replace(/\/$/, "");
const publicPages = [];
const pageData = new Map();

for (const file of htmlFiles) {
  const html = await readFile(path.join(outputDirectory, file), "utf8");
  const route = file === "index.html" ? "/" : `/${path.posix.dirname(file).replace(/\\/g, "/")}/`;
  const isPrivate = /^\/(keranjang|checkout|lacak-pesanan)\/$/.test(route);
  const robots = html.match(/<meta\s+name=["']robots["']\s+content=["']([^"']+)["'][^>]*>/i)?.[1] ?? "";
  const titleCount = (html.match(/<title\b/gi) || []).length;
  const h1Count = (html.match(/<h1\b/gi) || []).length;
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "";
  const description = html.match(/<meta\s+name=["']description["'][^>]*>/i)?.[0] ?? "";

  if (/{{[A-Z_]+}}/.test(html)) fail(`${file}: masih ada token template.`);
  if (titleCount !== 1 || !title) fail(`${file}: harus memiliki tepat satu title yang tidak kosong.`);
  if (!description || !attr(description, "content")) fail(`${file}: meta description tidak ada atau kosong.`);
  if (h1Count !== 1) fail(`${file}: harus memiliki tepat satu h1.`);
  if (isPrivate && !/noindex/i.test(robots)) fail(`${file}: halaman privat wajib noindex.`);
  if (!isPrivate && !previewMode && !/(^|,)\s*index\b/i.test(robots)) fail(`${file}: halaman publik belum diizinkan untuk indeks.`);
  if (!isPrivate && previewMode && !/noindex/i.test(robots)) fail(`${file}: halaman preview harus noindex.`);
  if (!isPrivate) {
    publicPages.push(route);
    if (!previewMode) {
      const canonical = html.match(/<link\s+rel=["']canonical["'][^>]*>/i)?.[0] ?? "";
      const expectedCanonical = `${siteUrl.replace(/\/$/, "")}${route}`;
      if (!canonical || attr(canonical, "href") !== expectedCanonical) fail(`${file}: canonical harus mengarah ke ${expectedCanonical}.`);
    }
  }
  pageData.set(file, { html, route, isPrivate });
}

if (!previewMode) {
  if (!publicPages.some((route) => route.startsWith("/kategori/"))) fail("Rilis publik harus memiliki minimal satu halaman kategori.");
  if (!publicPages.some((route) => route.startsWith("/produk/"))) fail("Rilis publik harus memiliki minimal satu halaman produk.");
}

for (const [file, { html, route }] of pageData) {
  const pageUrl = new URL(`${sitePath}${route}`.replace(/\/{2,}/g, "/"), baseUrl);
  const tags = html.match(/<(?:a|link|img|script|source)\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const reference = attr(tag, tag.startsWith("<img") || tag.startsWith("<script") || tag.startsWith("<source") ? "src" : "href");
    if (!reference || /^(?:https?:|mailto:|tel:|data:|javascript:)/i.test(reference)) continue;
    let target;
    try { target = new URL(reference, pageUrl); } catch { fail(`${file}: URL lokal tidak valid (${reference}).`); continue; }
    if (target.origin !== baseUrl.origin) continue;
    if (sitePath && target.pathname !== sitePath && !target.pathname.startsWith(`${sitePath}/`)) {
      fail(`${file}: tautan keluar dari subpath situs (${reference}).`);
      continue;
    }
    let localPath = sitePath ? target.pathname.slice(sitePath.length) : target.pathname;
    if (!localPath || localPath === "/") localPath = "/index.html";
    const localSegments = decodeURIComponent(localPath).split("/").filter(Boolean);
    let targetFile = path.join(outputDirectory, ...localSegments);
    if (!localSegments.length) targetFile = path.join(outputDirectory, "index.html");
    else if (localPath.endsWith("/")) targetFile = path.join(targetFile, "index.html");
    if (!files.includes(path.relative(outputDirectory, targetFile).replace(/\\/g, "/"))) {
      fail(`${file}: file lokal tidak ditemukan (${reference}).`);
    }
  }
  const images = html.match(/<img\b[^>]*>/gi) || [];
  for (const image of images) if (!/\balt\s*=\s*["'][^"']*["']/i.test(image)) fail(`${file}: gambar tanpa atribut alt.`);
  const jsonLdBlocks = [...html.matchAll(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const [, block] of jsonLdBlocks) {
    try { JSON.parse(block); } catch { fail(`${file}: structured data JSON-LD tidak valid.`); }
  }
  if (!previewMode && /localhost|127\.0\.0\.1|REPLACE_WITH|pratinjau katalog|data lokal|\(contoh\)/i.test(html)) {
    fail(`${file}: masih memuat URL lokal atau konten contoh.`);
  }
}

let robotsText = "";
try { robotsText = await readFile(path.join(outputDirectory, "robots.txt"), "utf8"); } catch { fail("robots.txt tidak ditemukan."); }
if (!/^User-agent:\s*\*/m.test(robotsText) || !/^Allow:\s*\//m.test(robotsText)) fail("robots.txt harus mengizinkan crawler membaca situs.");

const sitemapPath = path.join(outputDirectory, "sitemap.xml");
if (indexable && !previewMode) {
  let sitemap = "";
  try { sitemap = await readFile(sitemapPath, "utf8"); } catch { fail("sitemap.xml tidak ditemukan untuk situs yang dapat diindeks."); }
  const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  const expectedUrls = publicPages.map((route) => `${siteUrl.replace(/\/$/, "")}${route}`);
  if (sitemapUrls.length !== publicPages.length) fail("Jumlah URL sitemap tidak cocok dengan halaman publik yang dibuat.");
  if (new Set(sitemapUrls).size !== sitemapUrls.length) fail("Sitemap mengandung URL duplikat.");
  for (const url of expectedUrls) if (!sitemapUrls.includes(url)) fail(`Sitemap tidak memuat halaman publik: ${url}`);
  for (const url of sitemapUrls) {
    let parsed;
    try { parsed = new URL(url); } catch { fail(`URL sitemap tidak valid: ${url}`); continue; }
    if (parsed.protocol !== "https:" || parsed.origin !== baseUrl.origin || !parsed.pathname.startsWith(`${sitePath}/`)) fail(`URL sitemap keluar dari situs HTTPS: ${url}`);
    if (/\/(keranjang|checkout|lacak-pesanan)\//.test(parsed.pathname)) fail(`Sitemap memasukkan halaman nonpublik: ${url}`);
  }
  if (!robotsText.includes("Sitemap:")) fail("robots.txt belum mengumumkan sitemap.");
} else {
  if (/Sitemap:/i.test(robotsText)) fail("robots.txt preview tidak boleh menunjuk sitemap publik.");
  try { await readFile(sitemapPath, "utf8"); fail("Preview noindex tidak boleh menyisakan sitemap lama."); } catch (error) { if (error.code !== "ENOENT") throw error; }
}

if (errors.length) {
  for (const error of errors) console.error(`GAGAL: ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Pemeriksaan ${previewMode ? "preview" : "rilis"} berhasil: ${htmlFiles.length} halaman HTML, ${publicPages.length} halaman publik.`);
}
