import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendDirectory = path.resolve(scriptDirectory, "../..");
const sourceDirectory = path.join(frontendDirectory, "src");
const outputDirectory = path.join(frontendDirectory, "dist");
const templateDirectory = path.join(sourceDirectory, "templates");
const siteConfig = JSON.parse(await readFile(path.join(sourceDirectory, "data", "site.json"), "utf8"));
function environmentBoolean(name, fallback) {
  const value = process.env[name];
  if (value == null || value === "") return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} harus bernilai true atau false.`);
}
const site = {
  ...siteConfig,
  siteUrl: (process.env.SITE_URL || siteConfig.siteUrl).trim().replace(/\/$/, ""),
  apiBaseUrl: (process.env.PUBLIC_API_BASE_URL || siteConfig.apiBaseUrl).trim(),
  indexable: environmentBoolean("SEO_INDEXABLE", siteConfig.indexable),
  contentReady: environmentBoolean("CONTENT_READY", siteConfig.contentReady),
};
if (!/^\d{8,15}$/.test(site.whatsappNumber || "")) {
  throw new Error("whatsappNumber harus memakai format internasional berupa angka saja.");
}
const whatsappLink = `https://wa.me/${site.whatsappNumber}?${new URLSearchParams({ text: "Halo Toqoku, saya ingin bertanya tentang produk." })}`;
const socialPlatforms = {
  facebook: { label: "Facebook", domain: "facebook.com", icon: "fa-facebook-f" },
  instagram: { label: "Instagram", domain: "instagram.com", icon: "fa-instagram" },
  tiktok: { label: "TikTok", domain: "tiktok.com", icon: "fa-tiktok" },
  youtube: { label: "YouTube", domain: "youtube.com", icon: "fa-youtube" },
};
const socialLinks = Object.entries(socialPlatforms).flatMap(([key, platform]) => {
  const value = site.socialLinks?.[key];
  if (!value) return [];
  let url;
  try { url = new URL(value); } catch { throw new Error(`URL ${platform.label} harus URL HTTPS yang valid.`); }
  if (url.protocol !== "https:" || !(url.hostname === platform.domain || url.hostname.endsWith(`.${platform.domain}`))) {
    throw new Error(`URL ${platform.label} harus berasal dari ${platform.domain}.`);
  }
  return [`<a href="${escapeHtml(url.href)}" aria-label="${platform.label} Toqoku" target="_blank" rel="noopener noreferrer"><i class="fa-brands ${platform.icon}" aria-hidden="true"></i></a>`];
}).join("");
const socialLinksMarkup = socialLinks ? `<nav class="footer-social" aria-label="Media sosial Toqoku">${socialLinks}</nav>` : "";
const catalogApiUrl = process.env.CATALOG_API_URL || "http://127.0.0.1:8787/api/catalog";
const apiBaseUrl = (site.apiBaseUrl || "http://127.0.0.1:8787").replace(/\/$/, "");
const parsedApiBaseUrl = new URL(apiBaseUrl);
if (!["http:", "https:"].includes(parsedApiBaseUrl.protocol)) throw new Error("apiBaseUrl harus memakai HTTP atau HTTPS.");
if (parsedApiBaseUrl.username || parsedApiBaseUrl.password || parsedApiBaseUrl.search || parsedApiBaseUrl.hash) {
  throw new Error("apiBaseUrl tidak boleh berisi kredensial, query, atau fragment.");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function replaceTokens(template, values) {
  const rendered = template.replace(/{{([A-Z_]+)}}/g, (_, key) => {
    if (!(key in values)) throw new Error(`Data template tidak tersedia: ${key}`);
    return values[key];
  });
  if (/{{[A-Z_]+}}/.test(rendered)) throw new Error("Masih ada token template yang belum terisi.");
  return rendered;
}

function rootPrefix(depth) {
  return "../".repeat(depth);
}

function absoluteUrl(pathname) {
  return `${site.siteUrl.replace(/\/$/, "")}/${pathname.replace(/^\//, "")}`;
}

function addSeo(html, { title, description, pathname, breadcrumbs, structuredData = [] }) {
  const robots = site.indexable ? "index,follow" : "noindex,nofollow";
  const tags = [`<meta name="robots" content="${robots}">`];
  if (site.indexable && site.siteUrl) {
    const canonical = absoluteUrl(pathname);
    tags.push(`<link rel="canonical" href="${escapeHtml(canonical)}">`);
    tags.push('<meta property="og:type" content="website">');
    tags.push(`<meta property="og:site_name" content="${escapeHtml(site.name)}">`);
    tags.push(`<meta property="og:title" content="${escapeHtml(title)}">`);
    tags.push(`<meta property="og:description" content="${escapeHtml(description)}">`);
    tags.push(`<meta property="og:url" content="${escapeHtml(canonical)}">`);
    tags.push(`<meta property="og:locale" content="${escapeHtml(site.language)}">`);
    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: breadcrumbs.map((item, index) => ({
        "@type": "ListItem", position: index + 1, name: item.name, item: absoluteUrl(item.path),
      })),
    };
    for (const schema of [breadcrumbSchema, ...structuredData]) {
      tags.push(`<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, "\\u003c")}</script>`);
    }
  }
  return html.replace("</head>", `    ${tags.join("\n    ")}\n  </head>`);
}

function addNoIndex(html) {
  return html.replace("</head>", '    <meta name="robots" content="noindex,nofollow">\n  </head>');
}

function formatPrice(amount) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function imageUrl(product) {
  if (!product.image_url) return null;
  try {
    const parsed = new URL(product.image_url);
    return parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

function displayFixedSize(value) {
  return String(value || "").replace(/\s*\(contoh\)\s*/gi, "").trim();
}

function productMedia(product, className = "") {
  const remoteImage = imageUrl(product);
  const fallbackImages = [
    "https://images.unsplash.com/photo-1747862934428-899f5beb821e?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1770394644126-4a17c000c122?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80",
  ];
  const imageIndex = [...String(product.slug || product.name || "")].reduce((sum, char) => sum + char.charCodeAt(0), 0) % fallbackImages.length;
  const image = remoteImage || fallbackImages[imageIndex];
  const imageAlt = remoteImage ? (product.image_alt || product.name) : `Foto ilustrasi Unsplash untuk ${product.name}; bukan foto produk Toqoku.`;
  const visualClass = product.category === "plang-nama" ? "visual-sand" : "visual-sage";
  const content = `<img class="product-photo" src="${escapeHtml(image)}" alt="${escapeHtml(imageAlt)}" width="800" height="600" loading="lazy">`;
  const accessibleName = "";
  return `<a class="product-visual ${visualClass} ${className}" href="${product.link}">
    ${content}
    <span class="product-tag">${escapeHtml(product.category_name)}</span>
    <span class="visual-caption">${escapeHtml(displayFixedSize(product.fixed_size) || "Detail produk")}</span>
    ${accessibleName}
  </a>`;
}

function productCard(product, prefix) {
  const link = `${prefix}produk/${escapeHtml(product.slug)}/`;
  const productForMedia = { ...product, link };
  return `<article class="product-card">
    ${productMedia(productForMedia)}
    <div class="product-info"><div><h3><a href="${link}">${escapeHtml(product.name)}</a></h3><p>${escapeHtml(product.customization || "Produk custom")} · ${formatPrice(product.price_amount)}</p></div><a class="round-link" href="${link}" aria-label="Lihat ${escapeHtml(product.name)}"><i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a></div>
  </article>`;
}

const featuredIdeas = [
  { title: "Nomor rumah", detail: "Angka sesuai pilihanmu", image: "https://images.unsplash.com/photo-1747862934428-899f5beb821e?auto=format&fit=crop&w=900&q=80" },
  { title: "Angka + huruf", detail: "Contoh: A01", image: "https://images.unsplash.com/photo-1770394644126-4a17c000c122?auto=format&fit=crop&w=900&q=80" },
  { title: "Nama area", detail: "Hingga 14 karakter", image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80" },
  { title: "Akrilik 3 mm", detail: "Potong laser CO₂", image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=80" },
  { title: "Tempel praktis", detail: "Pakai double tape", image: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=900&q=80" },
];

function featuredProductCard(idea, index) {
  const image = idea.image;
  const alt = `Foto inspirasi Unsplash untuk ${idea.title}; bukan foto produk Toqoku.`;
  return `<article class="featured-tile featured-tile-${index % 2 === 0 ? "green" : "orange"}">
    <a class="featured-tile-link" href="#produk" aria-label="Lihat katalog: ${escapeHtml(idea.title)}">
      <img class="featured-tile-photo" src="${escapeHtml(image)}" alt="${escapeHtml(alt)}" width="900" height="1100" loading="lazy">
      <span class="featured-tile-shade" aria-hidden="true"></span>
      <span class="featured-tile-copy"><span class="featured-tile-kicker">Inspirasi custom</span><strong>${escapeHtml(idea.title)}</strong><span class="featured-tile-detail">${escapeHtml(idea.detail)}</span></span>
      <span class="featured-tile-arrow" aria-hidden="true"><i class="fa-solid fa-arrow-right"></i></span>
    </a>
  </article>`;
}

function customizationFields(fields, productSlug) {
  let productFields = Array.isArray(fields) ? [...fields] : [];
  if (previewMode && /^nomor-rumah-/.test(productSlug || "")) {
    productFields = productFields.map((field) => field.key === "house_number"
      ? { ...field, label: "Nomor rumah", type: "text", required: true, max_length: 3, rules: { pattern: "[A-Za-z0-9]{1,3}", uppercase: true } }
      : field);
    if (!productFields.some((field) => field.key === "area_name")) {
      productFields.push({
        key: "area_name",
        label: "Nama area (opsional)",
        type: "text",
        required: false,
        max_length: 14,
        rules: { pattern: String.raw`[\p{L}\p{N} ./-]{1,14}` },
      });
    }
  }
  if (!productFields.length) return '<p class="form-hint">Tidak ada bagian custom untuk produk ini.</p>';
  return productFields.map((field) => {
    const key = escapeHtml(field.key);
    const label = escapeHtml(field.label);
    const length = Number.isInteger(field.max_length) && field.max_length > 0 ? ` maxlength="${field.max_length}"` : "";
    const required = field.required ? " required" : "";
    const numeric = field.type === "number";
    const inputMode = numeric ? ' inputmode="numeric" pattern="[0-9]*"' : "";
    const rules = field.rules && typeof field.rules === "object" ? field.rules : {};
    const pattern = typeof rules.pattern === "string" ? ` pattern="${escapeHtml(rules.pattern)}"` : "";
    const uppercase = rules.uppercase ? ' data-uppercase="true"' : "";
    return `<label class="form-field custom-field custom-field-${key}">${label}<input type="text" name="custom-${key}" data-custom-key="${key}" data-custom-label="${label}"${inputMode}${length}${pattern}${uppercase}${required}></label>`;
  }).join("\n");
}

async function copyAssetFiles(fromDirectory, toDirectory) {
  let entries;
  try {
    entries = await readdir(fromDirectory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }

  for (const entry of entries) {
    if (entry.name === ".gitkeep") continue;
    const sourcePath = path.join(fromDirectory, entry.name);
    const outputPath = path.join(toDirectory, entry.name);
    if (entry.isDirectory()) {
      await copyAssetFiles(sourcePath, outputPath);
    } else if (entry.isFile()) {
      await mkdir(toDirectory, { recursive: true });
      await copyFile(sourcePath, outputPath);
    }
  }
}

async function loadCatalog() {
  let response;
  try {
    response = await fetch(catalogApiUrl, { signal: AbortSignal.timeout(15000) });
  } catch (error) {
    throw new Error(`API katalog tidak dapat dijangkau (${catalogApiUrl}). Jalankan Worker lokal atau isi CATALOG_API_URL. ${error.message}`);
  }
  if (!response.ok) throw new Error(`API katalog mengembalikan HTTP ${response.status}.`);

  const payload = await response.json();
  const catalog = payload?.data;
  if (!Array.isArray(catalog?.categories) || !Array.isArray(catalog?.products)) {
    throw new Error("Format API katalog tidak valid; perlu data.categories dan data.products.");
  }

  const categorySlugs = new Set(catalog.categories.map((category) => category.slug));
  const categories = catalog.categories.map((category) => {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category.slug)) throw new Error(`Slug kategori tidak valid: ${category.slug}`);
    return category;
  });
  const products = catalog.products.map((product) => {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.slug)) throw new Error(`Slug produk tidak valid: ${product.slug}`);
    if (!categorySlugs.has(product.category)) throw new Error(`Kategori tidak ditemukan untuk produk ${product.slug}.`);
    if (!Number.isSafeInteger(product.price_amount) || product.price_amount < 0) throw new Error(`Harga tidak valid untuk produk ${product.slug}.`);
    if (product.currency !== "IDR") throw new Error(`Mata uang produk ${product.slug} bukan IDR.`);
    return product;
  });
  return { categories, products };
}

let parsedSiteUrl = null;
if (site.siteUrl) {
  try { parsedSiteUrl = new URL(site.siteUrl); } catch { throw new Error("siteUrl harus berupa URL HTTPS yang valid."); }
}
if (site.indexable && (!parsedSiteUrl || parsedSiteUrl.protocol !== "https:" || parsedSiteUrl.username || parsedSiteUrl.password || parsedSiteUrl.search || parsedSiteUrl.hash || !site.contentReady)) {
  throw new Error("SEO aktif memerlukan siteUrl HTTPS dan contentReady: true setelah data katalog final di src/data/site.json.");
}
if (site.contentReady && parsedApiBaseUrl.protocol !== "https:") {
  throw new Error("apiBaseUrl publik harus memakai HTTPS saat contentReady: true.");
}

const catalog = await loadCatalog();
if (site.contentReady && (!catalog.categories.length || !catalog.products.length)) {
  throw new Error("Katalog production harus memiliki minimal satu kategori dan satu produk sebelum contentReady diaktifkan.");
}
if (site.contentReady) {
  const productsWithoutPhotos = catalog.products.filter((product) => !imageUrl(product) || !String(product.image_alt || "").trim());
  if (productsWithoutPhotos.length) {
    throw new Error(`Setiap produk harus memiliki foto HTTPS dan teks alt sebelum contentReady diaktifkan: ${productsWithoutPhotos.map((product) => product.slug).join(", ")}`);
  }
  const productsWithInvalidOffers = catalog.products.filter((product) =>
    !Number.isSafeInteger(product.price_amount) || product.price_amount <= 0 || !/^[A-Z]{3}$/.test(product.currency || "")
  );
  if (productsWithInvalidOffers.length) {
    throw new Error(`Setiap produk harus memiliki harga positif dan kode mata uang ISO 4217: ${productsWithInvalidOffers.map((product) => product.slug).join(", ")}`);
  }
}
const homeTemplate = await readFile(path.join(templateDirectory, "home.html"), "utf8");
const categoryTemplate = await readFile(path.join(templateDirectory, "category.html"), "utf8");
const productTemplate = await readFile(path.join(templateDirectory, "product.html"), "utf8");
const cartTemplate = await readFile(path.join(templateDirectory, "cart.html"), "utf8");
const checkoutTemplate = await readFile(path.join(templateDirectory, "checkout.html"), "utf8");
const trackingTemplate = await readFile(path.join(templateDirectory, "lacak-pesanan.html"), "utf8");
const previewMode = !site.contentReady;
const previewBanner = previewMode ? '<p class="preview-banner">DEMO · Produk, harga, dan foto contoh</p>' : "";
const demoNote = previewMode ? '<p class="demo-note">Harga dan foto ilustrasi. Toko belum menerima pesanan.</p>' : "";
const footerCopy = `© ${new Date().getUTCFullYear()} ${escapeHtml(site.name)}`;
const homePrefix = "./";
const homeCategoryLinks = catalog.categories.map((category) =>
  `<a href="${homePrefix}kategori/${escapeHtml(category.slug)}/">${escapeHtml(category.name)}</a>`
).join("");
const previewProductIdeas = [
  { name: "Nomor Pintu Kamar", category: "Nomor rumah", detail: "Kos · Villa", image: "photo-1747862934428-899f5beb821e" },
  { name: "Nomor + Nama Area", category: "Nomor rumah", detail: "Custom nama", image: "photo-1600585154340-be6161a56a0c" },
  { name: "Nomor Rumah Modern", category: "Nomor rumah", detail: "Ide desain", image: "photo-1770394644126-4a17c000c122" },
  { name: "Plakat Akrilik", category: "Plakat", detail: "Inspirasi", image: "photo-1770482228588-270b08d2d376" },
  { name: "Gantungan Kunci Nama", category: "Gantungan kunci", detail: "Custom nama", image: "photo-1627368454968-10113f8ed23f" },
  { name: "Stand QRIS", category: "Stand QRIS", detail: "Untuk usaha", image: "photo-1677058054899-75c533d57048" },
  { name: "Plang Wi-Fi", category: "Plang kecil", detail: "Custom teks", image: "photo-1746021278356-66b31ca55dbb" },
  { name: "Plang CCTV", category: "Plang kecil", detail: "Custom teks", image: "photo-1666032186804-e14dfe920222" },
  { name: "Papan Petunjuk", category: "Papan petunjuk", detail: "Custom arah", image: "photo-1666032186804-e14dfe920222" },
  { name: "Nomor Rumah Akrilik", category: "Nomor rumah", detail: "Custom angka", image: "photo-1747862934428-899f5beb821e" },
  { name: "Plang Nama Rumah", category: "Plang kecil", detail: "Custom nama", image: "photo-1746021278356-66b31ca55dbb" },
  { name: "Nomor dan Nama Area", category: "Nomor rumah", detail: "Custom area", image: "photo-1600585154340-be6161a56a0c" },
  { name: "Gantungan Nomor Kamar", category: "Gantungan kunci", detail: "Kos · Villa", image: "photo-1627368454968-10113f8ed23f" },
  { name: "Stand QRIS Meja", category: "Stand QRIS", detail: "Untuk usaha", image: "photo-1677058054899-75c533d57048" },
  { name: "Plakat Penghargaan", category: "Plakat", detail: "Inspirasi", image: "photo-1770482228588-270b08d2d376" },
  { name: "Plang Toilet", category: "Plang kecil", detail: "Custom teks", image: "photo-1666032186804-e14dfe920222" },
  { name: "Papan Arah Rumah", category: "Papan petunjuk", detail: "Custom arah", image: "photo-1666032186804-e14dfe920222" },
];
function previewIdeaCard(idea, index) {
  const image = `https://images.unsplash.com/${idea.image}?auto=format&fit=crop&w=900&q=80`;
  return `<article class="product-card product-card-preview">
    <div class="product-visual ${index % 2 ? "visual-sand" : "visual-sage"}"><img class="product-photo" src="${image}" alt="Ide ${escapeHtml(idea.name)}. Foto Unsplash, bukan foto produk Toqoku." width="800" height="600" loading="lazy"><span class="product-tag">${escapeHtml(idea.category)}</span><span class="visual-caption">${escapeHtml(idea.detail)}</span></div>
    <div class="product-info"><div><h3>${escapeHtml(idea.name)}</h3><p>Ide produk</p></div></div>
  </article>`;
}
const homeCards = [
  ...catalog.products.map((product) => productCard(product, homePrefix)),
  ...(!site.contentReady ? previewProductIdeas.slice(0, Math.max(0, 20 - catalog.products.length)).map(previewIdeaCard) : []),
].join("\n") || '<p class="empty-catalog">Produk akan segera tersedia.</p>';
const categoryShowcase = [
  { slug: "nomor-rumah", name: "Nomor rumah", image: "photo-1747862934428-899f5beb821e" },
  { slug: "plakat-akrilik", name: "Plakat", image: "photo-1770482228588-270b08d2d376" },
  { slug: "gantungan-kunci", name: "Gantungan kunci", image: "photo-1627368454968-10113f8ed23f" },
  { slug: "stand-qris", name: "Stand QRIS", image: "photo-1677058054899-75c533d57048" },
  { slug: "plang-kecil", routeSlug: "plang-nama", name: "Plang kecil", image: "photo-1746021278356-66b31ca55dbb" },
  { slug: "papan-petunjuk", name: "Papan petunjuk", image: "photo-1666032186804-e14dfe920222" },
];
const availableCategorySlugs = new Set(catalog.categories.map((category) => category.slug));
const categoryTiles = categoryShowcase.map((category, index) => {
  const routeSlug = category.routeSlug || category.slug;
  const href = availableCategorySlugs.has(routeSlug) ? `./kategori/${escapeHtml(routeSlug)}/` : "#produk";
  const image = `https://images.unsplash.com/${category.image}?auto=format&fit=crop&w=900&q=80`;
  return `<a class="category-photo-tile category-photo-tile-${index % 3}" href="${href}" aria-label="Lihat katalog ${escapeHtml(category.name)}"><img class="category-photo" src="${image}" alt="Inspirasi ${escapeHtml(category.name)}. Foto Unsplash, bukan foto produk Toqoku." width="900" height="600" loading="lazy"><span class="category-photo-shade" aria-hidden="true"></span><strong>${escapeHtml(category.name)}</strong><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>`;
}).join("");
const homeHtml = replaceTokens(homeTemplate, {
  PREVIEW_BANNER: previewBanner,
  FEATURED_LAYOUT: catalog.products.length ? " offer-grid-scroll" : "",
  FEATURED_PRODUCTS: catalog.products.length ? featuredIdeas.map(featuredProductCard).join("\n") : '<p class="empty-catalog">Produk akan segera tersedia.</p>',
  CATEGORY_LINKS: homeCategoryLinks || '<span class="empty-catalog">Kategori akan segera tersedia.</span>',
  PRODUCT_CARDS: homeCards,
  CATEGORY_TILES: categoryTiles || '<p class="empty-catalog">Kategori akan segera tersedia.</p>',
  DEMO_NOTE: demoNote,
  FOOTER_COPY: footerCopy,
  WHATSAPP_LINK: escapeHtml(whatsappLink),
  SOCIAL_LINKS: socialLinksMarkup,
  API_BASE_URL: escapeHtml(apiBaseUrl),
});

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
const homeSeo = addSeo(homeHtml, {
  title: `Produk Custom untuk Rumah | ${site.name}`,
  description: "Lihat katalog produk custom untuk rumah. Temukan detail desain, ukuran, dan harga produk.",
  pathname: "/",
  breadcrumbs: [{ name: "Beranda", path: "/" }],
});
await writeFile(path.join(outputDirectory, "index.html"), homeSeo, "utf8");

for (const category of catalog.categories) {
  const categoryProducts = catalog.products.filter((product) => product.category === category.slug);
  if (categoryProducts.length === 0) continue;
  const prefix = rootPrefix(2);
  const categoryLinks = catalog.categories.map((item) =>
    `<a href="${prefix}kategori/${escapeHtml(item.slug)}/"${item.slug === category.slug ? ' aria-current="page"' : ""}>${escapeHtml(item.name)}</a>`
  ).join("");
  const html = replaceTokens(categoryTemplate, {
    ROOT_PREFIX: prefix,
    CATEGORY_NAME: escapeHtml(category.name),
    CATEGORY_DESCRIPTION: escapeHtml(category.description),
    CATEGORY_LINKS: categoryLinks,
    PRODUCT_CARDS: categoryProducts.map((product) => productCard(product, prefix)).join("\n"),
    PREVIEW_BANNER: previewBanner,
    DEMO_NOTE: demoNote,
    FOOTER_COPY: footerCopy,
    WHATSAPP_LINK: escapeHtml(whatsappLink),
    SOCIAL_LINKS: socialLinksMarkup,
    API_BASE_URL: escapeHtml(apiBaseUrl),
  });
  const seoHtml = addSeo(html, {
    title: `${category.name} Custom | ${site.name}`,
    description: category.description,
    pathname: `/kategori/${category.slug}/`,
    breadcrumbs: [
      { name: "Beranda", path: "/" },
      { name: category.name, path: `/kategori/${category.slug}/` },
    ],
  });
  const destination = path.join(outputDirectory, "kategori", category.slug);
  await mkdir(destination, { recursive: true });
  await writeFile(path.join(destination, "index.html"), seoHtml, "utf8");
}

for (const product of catalog.products) {
  const category = catalog.categories.find((item) => item.slug === product.category);
  const related = catalog.products.filter((item) => item.slug !== product.slug).slice(0, 3);
  const prefix = rootPrefix(2);
  const link = `${prefix}produk/${escapeHtml(product.slug)}/`;
  const catalogImage = imageUrl(product);
  const image = catalogImage || "https://images.unsplash.com/photo-1747862934428-899f5beb821e?auto=format&fit=crop&w=1200&q=85";
  const imageAlt = catalogImage
    ? (product.image_alt || product.name)
    : `Foto ilustrasi Unsplash untuk ${product.name}; bukan foto produk Toqoku.`;
  const media = image
    ? `<img class="detail-photo" src="${escapeHtml(image)}" alt="${escapeHtml(imageAlt)}" width="1000" height="750" fetchpriority="high">`
    : '<div class="detail-image-placeholder" role="img" aria-label="Foto produk belum tersedia"><span>Foto produk</span></div>';
  const html = replaceTokens(productTemplate, {
    ROOT_PREFIX: prefix,
    CATEGORY_SLUG: escapeHtml(category.slug),
    CATEGORY_NAME: escapeHtml(category.name),
    PRODUCT_NAME: escapeHtml(product.name),
    PRODUCT_SLUG: escapeHtml(product.slug),
    PRODUCT_PRICE_AMOUNT: String(product.price_amount),
    PRODUCT_DESCRIPTION: escapeHtml(product.description),
    PRODUCT_MEDIA: media,
    PRODUCT_MEDIA_CAPTION: '<figcaption>Foto ilustrasi Unsplash; bukan foto produk Toqoku.</figcaption>',
    PRODUCT_SIZE: escapeHtml(displayFixedSize(product.fixed_size) || "Belum ditentukan"),
    PRODUCT_CUSTOMIZATION: escapeHtml(product.customization || "Belum ditentukan"),
    CUSTOM_FIELDS: customizationFields(product.customization_fields, product.slug),
    PRODUCT_PRICE: formatPrice(product.price_amount),
    RELATED_PRODUCTS: [
      ...related.map((item) => productCard(item, prefix)),
      ...(!site.contentReady ? previewProductIdeas.slice(0, Math.max(0, 4 - related.length)).map(previewIdeaCard) : []),
    ].join("\n") || '<p class="empty-catalog">Belum ada produk terkait.</p>',
    PREVIEW_BANNER: previewBanner,
    DEMO_NOTE: previewMode ? '<p class="demo-note detail-notice">Informasi dan foto ini hanya contoh pratinjau.</p>' : "",
    FOOTER_COPY: footerCopy,
    WHATSAPP_LINK: escapeHtml(whatsappLink),
    SOCIAL_LINKS: socialLinksMarkup,
    API_BASE_URL: escapeHtml(apiBaseUrl),
    CUSTOM_PREVIEW_SCRIPT: `<script src="${prefix}assets/js/custom-preview.js" defer></script>`,
  });
  const seoHtml = addSeo(html, {
    title: `${product.name} Custom | ${site.name}`,
    description: product.description,
    pathname: `/produk/${product.slug}/`,
    breadcrumbs: [
      { name: "Beranda", path: "/" },
      { name: category.name, path: `/kategori/${category.slug}/` },
      { name: product.name, path: `/produk/${product.slug}/` },
    ],
    structuredData: site.indexable ? [{
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      description: product.description,
      image: [image],
      category: category.name,
      offers: {
        "@type": "Offer",
        url: absoluteUrl(`/produk/${product.slug}/`),
        priceCurrency: product.currency,
        price: product.price_amount,
      },
    }] : [],
  });
  const destination = path.join(outputDirectory, "produk", product.slug);
  await mkdir(destination, { recursive: true });
  await writeFile(path.join(destination, "index.html"), seoHtml, "utf8");
}

for (const [slug, template] of [["keranjang", cartTemplate], ["checkout", checkoutTemplate], ["lacak-pesanan", trackingTemplate]]) {
  const html = replaceTokens(template, {
    ROOT_PREFIX: "../",
    PREVIEW_BANNER: previewBanner,
    PREVIEW_CHECKOUT_NOTICE: previewMode ? '<p class="demo-note" id="checkout-preview-notice">Build lokal belum tersambung ke katalog produksi. Pesanan tidak dikirim.</p>' : "",
    PREVIEW_TRACKING_NOTICE: previewMode ? '<p class="demo-note">Build lokal tidak menampilkan pesanan. Pelacakan memakai data API produksi.</p>' : "",
    PREVIEW_MODE: String(previewMode),
    ORDER_SUCCESS_NOTE: previewMode
      ? '<p class="shipping-note">Pesanan belum dibuat.</p>'
      : `<section class="shipping-note"><h3>Transfer bank</h3><p>${escapeHtml(site.bankTransfer.bankName)}<br>a.n. ${escapeHtml(site.bankTransfer.accountName)}<br><strong>${escapeHtml(site.bankTransfer.accountNumber)}</strong></p><p>Transfer sesuai total pesanan dalam 24 jam, lalu unggah bukti. Pesanan diproses setelah pembayaran diverifikasi.</p></section>`,
    ORDER_TRACKING_LINK: previewMode
      ? '<p class="form-hint">Tidak ada pesanan pada build lokal.</p>'
      : '<a class="text-link" href="../lacak-pesanan/">Lacak perkembangan pesanan</a>',
    FOOTER_COPY: footerCopy,
    WHATSAPP_LINK: escapeHtml(whatsappLink),
    SOCIAL_LINKS: socialLinksMarkup,
    API_BASE_URL: escapeHtml(apiBaseUrl),
  });
  const destination = path.join(outputDirectory, slug);
  await mkdir(destination, { recursive: true });
  await writeFile(path.join(destination, "index.html"), addNoIndex(html), "utf8");
}

const publicPages = [
  { path: "/", priority: "1.0" },
  ...catalog.categories.filter((category) => catalog.products.some((product) => product.category === category.slug))
    .map((category) => ({ path: `/kategori/${category.slug}/`, priority: "0.8" })),
  ...catalog.products.map((product) => ({ path: `/produk/${product.slug}/`, priority: "0.7" })),
];
const robots = site.indexable
  ? `User-agent: *\nAllow: /\n\nSitemap: ${absoluteUrl("/sitemap.xml")}\n`
  : "User-agent: *\nAllow: /\n";
await writeFile(path.join(outputDirectory, "robots.txt"), robots, "utf8");
if (site.indexable) {
  const urls = publicPages.map(({ path: pagePath, priority }) =>
    `  <url><loc>${escapeHtml(absoluteUrl(pagePath))}</loc><priority>${priority}</priority></url>`
  ).join("\n");
  await writeFile(path.join(outputDirectory, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, "utf8");
}

await copyAssetFiles(path.join(sourceDirectory, "assets"), path.join(outputDirectory, "assets"));
console.log(`Situs statis dibuat dari API (${catalog.categories.length} kategori, ${catalog.products.length} produk).`);
