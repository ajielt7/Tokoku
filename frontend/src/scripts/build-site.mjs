import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendDirectory = path.resolve(scriptDirectory, "../..");
const sourceDirectory = path.join(frontendDirectory, "src");
const configuredOutputDirectory = process.env.SITE_BUILD_OUTPUT_DIR;
const outputDirectory = configuredOutputDirectory
  ? path.resolve(configuredOutputDirectory)
  : path.join(frontendDirectory, "dist");
const templateDirectory = path.join(sourceDirectory, "templates");
const homeStylesheet = await readFile(path.join(sourceDirectory, "assets", "css", "site.css"), "utf8");
const headerScript = await readFile(path.join(sourceDirectory, "assets", "js", "header-scroll.js"), "utf8");
const customPreviewScriptSource = await readFile(path.join(sourceDirectory, "assets", "js", "custom-preview.js"), "utf8");
const assetVersion = createHash("sha256").update(homeStylesheet).update(headerScript).update(customPreviewScriptSource).digest("hex").slice(0, 12);
const siteConfig = JSON.parse(await readFile(path.join(sourceDirectory, "data", "site.json"), "utf8"));
const localeDirectory = path.join(sourceDirectory, "data", "i18n");
const idLocale = JSON.parse(await readFile(path.join(localeDirectory, "id-ID.json"), "utf8"));
const enLocale = JSON.parse(await readFile(path.join(localeDirectory, "en.json"), "utf8"));
const marketConfig = JSON.parse(await readFile(path.join(sourceDirectory, "data", "markets.json"), "utf8"));
const idMessageKeys = Object.keys(idLocale.messages).sort();
const enMessageKeys = Object.keys(enLocale.messages).sort();
if (JSON.stringify(idMessageKeys) !== JSON.stringify(enMessageKeys)) {
  const missingEnglish = idMessageKeys.filter((key) => !(key in enLocale.messages));
  const missingIndonesian = enMessageKeys.filter((key) => !(key in idLocale.messages));
  throw new Error(`Key katalog bahasa harus sama. Hilang di en: ${missingEnglish.join(", ")}; hilang di id-ID: ${missingIndonesian.join(", ")}`);
}
for (const key of idMessageKeys) {
  const placeholders = (value) => [...String(value).matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((match) => match[1]).sort();
  if (JSON.stringify(placeholders(idLocale.messages[key])) !== JSON.stringify(placeholders(enLocale.messages[key]))) {
    throw new Error(`Placeholder katalog untuk ${key} harus sama pada id-ID dan en.`);
  }
}
if (idLocale.locale !== "id-ID" || idLocale.language !== "id" || enLocale.locale !== "en" || enLocale.language !== "en") {
  throw new Error("Konfigurasi locale harus berupa id-ID/id dan en/en.");
}
const internationalMarket = marketConfig.markets?.INTL;
const idrPerUsd = Number(internationalMarket?.priceDisplay?.idrPerUsd);
if (internationalMarket?.currency !== "USD" || !Number.isFinite(idrPerUsd) || idrPerUsd <= 0) {
  throw new Error("Konfigurasi pasar INTL harus memuat mata uang USD dan kurs IDR/USD yang valid.");
}
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
  apiFallbackUrl: (process.env.PUBLIC_API_FALLBACK_URL || siteConfig.apiFallbackUrl || "").trim(),
  indexable: environmentBoolean("SEO_INDEXABLE", siteConfig.indexable),
  contentReady: environmentBoolean("CONTENT_READY", siteConfig.contentReady),
};
const googleTagSnippet = `<script async src="https://www.googletagmanager.com/gtag/js?id=G-P788GBD1P8"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-P788GBD1P8');
    </script>`;
if (!/^\d{8,15}$/.test(site.whatsappNumber || "")) {
  throw new Error("whatsappNumber harus memakai format internasional berupa angka saja.");
}
const whatsappLink = `https://wa.me/${site.whatsappNumber}?${new URLSearchParams({ text: "Halo Toqoku, saya ingin bertanya tentang produk." })}`;
const socialPlatforms = {
  facebook: { label: "Facebook", domain: "facebook.com", icon: "facebook" },
  instagram: { label: "Instagram", domain: "instagram.com", icon: "instagram" },
  tiktok: { label: "TikTok", domain: "tiktok.com", icon: "tiktok" },
  youtube: { label: "YouTube", domain: "youtube.com", icon: "youtube" },
};
const socialLinks = Object.entries(socialPlatforms).flatMap(([key, platform]) => {
  const value = site.socialLinks?.[key];
  if (!value) return [];
  let url;
  try { url = new URL(value); } catch { throw new Error(`URL ${platform.label} harus URL HTTPS yang valid.`); }
  if (url.protocol !== "https:" || !(url.hostname === platform.domain || url.hostname.endsWith(`.${platform.domain}`))) {
    throw new Error(`URL ${platform.label} harus berasal dari ${platform.domain}.`);
  }
  return [`<a href="${escapeHtml(url.href)}" aria-label="${platform.label} Toqoku" target="_blank" rel="noopener noreferrer">${iconSvg(platform.icon)}</a>`];
}).join("");
const socialLinksMarkup = socialLinks ? `<nav class="footer-social" aria-label="Media sosial Toqoku">${socialLinks}</nav>` : "";
const apiBaseUrl = (site.apiBaseUrl || "http://127.0.0.1:8787").replace(/\/$/, "");
const parsedApiBaseUrl = new URL(apiBaseUrl);
if (!["http:", "https:"].includes(parsedApiBaseUrl.protocol)) throw new Error("apiBaseUrl harus memakai HTTP atau HTTPS.");
if (parsedApiBaseUrl.username || parsedApiBaseUrl.password || parsedApiBaseUrl.search || parsedApiBaseUrl.hash) {
  throw new Error("apiBaseUrl tidak boleh berisi kredensial, query, atau fragment.");
}
const apiFallbackUrl = (site.apiFallbackUrl || "").replace(/\/$/, "");
if (apiFallbackUrl) {
  const parsedApiFallbackUrl = new URL(apiFallbackUrl);
  if (!["http:", "https:"].includes(parsedApiFallbackUrl.protocol)
      || parsedApiFallbackUrl.username || parsedApiFallbackUrl.password
      || parsedApiFallbackUrl.search || parsedApiFallbackUrl.hash) {
    throw new Error("apiFallbackUrl harus berupa URL dasar HTTP(S) tanpa kredensial, query, atau fragment.");
  }
  if (apiFallbackUrl === apiBaseUrl) throw new Error("apiFallbackUrl harus berbeda dari apiBaseUrl utama.");
}
const catalogApiUrls = process.env.CATALOG_API_URL
  ? [process.env.CATALOG_API_URL]
  : [apiBaseUrl, apiFallbackUrl].filter(Boolean).map((baseUrl) => `${baseUrl}/api/catalog`);

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function iconSvg(name, extraClass = "") {
  const brandIcons = new Set(["whatsapp", "facebook", "instagram", "tiktok", "youtube"]);
  const family = brandIcons.has(name) ? "fa-brands" : "fa-solid";
  return `<i class="icon ${family} fa-${name}${extraClass ? ` ${extraClass}` : ""}" aria-hidden="true"></i>`;
}

const iconTokens = {
  ICON_ARROW_RIGHT: iconSvg("arrow-right"),
  ICON_ARROW_UP_RIGHT_FROM_SQUARE: iconSvg("arrow-up-right-from-square"),
  ICON_BAG_SHOPPING: iconSvg("bag-shopping"),
  ICON_MAGNIFYING_GLASS: iconSvg("magnifying-glass"),
  ICON_SEARCH_FIELD: iconSvg("magnifying-glass", "search-field-icon"),
  ICON_XMARK: iconSvg("xmark"),
  ICON_RULER_BENEFIT: iconSvg("ruler-combined", "benefit-icon"),
  ICON_EDIT_BENEFIT: iconSvg("pen-to-square", "benefit-icon"),
  ICON_INFO_BENEFIT: iconSvg("circle-info", "benefit-icon"),
  ICON_HOUSE: iconSvg("house"),
  ICON_WHATSAPP: iconSvg("whatsapp"),
};

const fontAwesomeStylesheet = '<link rel="preconnect" href="https://cdnjs.cloudflare.com" crossorigin>\n    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css" integrity="sha512-Evv84Mr4kqVGRNSgIGL/F/aIDqQb7xQ2vcrdIwxfjThSH8CSR7PBEakCr51Ck+w+/U6swU2Im1vVX0SVk9ABhg==" crossorigin="anonymous" referrerpolicy="no-referrer">';
const googleFontsStylesheet = '<link rel="preconnect" href="https://fonts.googleapis.com">\n    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n    <link href="https://fonts.googleapis.com/css2?family=Amarante&family=Dongle:wght@300;400;700&display=swap" rel="stylesheet">';

function replaceTokens(template, values) {
  const templateValues = { ...values, ASSET_VERSION: assetVersion };
  const renderedTemplate = template.replace(/{{([A-Z_]+)}}/g, (_, key) => {
    if (key in iconTokens) return iconTokens[key];
    if (!(key in templateValues)) throw new Error(`Data template tidak tersedia: ${key}`);
    return templateValues[key];
  });
  const cloudflareAnalyticsSnippet = "<!-- Cloudflare Web Analytics --><script type='module' src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{\"token\": \"5cca7485ee754628b5eacd5029f16afd\"}'></script><!-- End Cloudflare Web Analytics -->";
  const googleFontsStylesheet = '<link rel="preconnect" href="https://fonts.googleapis.com">\n    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n    <link href="https://fonts.googleapis.com/css2?family=Amarante&family=Dongle:wght@300;400;700&display=swap" rel="stylesheet">';
  const rendered = renderedTemplate.replace(/<head>/i, (openingHead) => `${openingHead}\n    ${googleTagSnippet}\n    ${googleFontsStylesheet}\n    ${cloudflareAnalyticsSnippet}`);
  const renderedWithFlags = rendered.replace("</head>", '    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/flag-icons/7.6.0/css/flag-icons.min.css">\n  </head>');
  if (/{{[A-Z_]+}}/.test(renderedWithFlags)) throw new Error("Masih ada token template yang belum terisi.");
  return renderedWithFlags;
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
    tags.push(`<link rel="ai-catalog" href="${escapeHtml(absoluteUrl("/.well-known/ai-catalog.json"))}">`);
    tags.push(`<link rel="ard" href="${escapeHtml(absoluteUrl("/.well-known/ard.json"))}">`);
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

function addTawkWidget(html) {
  const visitorTracking = `<script>
(() => {
  const apiBase = ${JSON.stringify(site.apiBaseUrl.replace(/\/$/, ""))};
  const recordVisit = () => {
    try {
      let visitorId = localStorage.getItem("ruma_visitor_id");
      if (!visitorId) {
        visitorId = crypto.randomUUID();
        localStorage.setItem("ruma_visitor_id", visitorId);
      }
      fetch(apiBase + "/api/analytics/visits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event_id: crypto.randomUUID(), visitor_id: visitorId }),
        keepalive: true,
        cache: "no-store",
        credentials: "omit",
      }).catch(() => {});
    } catch (_) {}
  };
  window.addEventListener("load", () => {
    if ("requestIdleCallback" in window) window.requestIdleCallback(recordVisit, { timeout: 1500 });
    else window.setTimeout(recordVisit, 1000);
  }, { once: true });
})();
</script>`;
  const widget = `<!--Start of Tawk.to Script-->
<script type="text/javascript">
var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();
(function(){
var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
s1.async=true;
s1.src='https://embed.tawk.to/6afc63a231f8653cc3bb52ac/1k7kuad8o';
s1.charset='UTF-8';
s1.setAttribute('crossorigin','*');
s0.parentNode.insertBefore(s1,s0);
})();
</script>
<!--End of Tawk.to Script-->`;
  if (!html.includes("</body>")) throw new Error("Tidak dapat memasang widget Tawk.to: tag </body> tidak ditemukan.");
  return html.replace("</body>", `${visitorTracking}\n${widget}\n  </body>`);
}

function addMobileNavigation(html) {
  if (html.includes('class="menu-toggle"')) return html;
  const nav = '<nav class="main-nav" aria-label="Navigasi utama">';
  const menuButton = `<button class="menu-toggle" type="button" aria-label="Buka menu" aria-controls="main-navigation" aria-expanded="false" onclick="event.stopImmediatePropagation(); const header=this.closest('.site-header'); const nav=header.querySelector('.main-nav'); const open=this.getAttribute('aria-expanded')!=='true'; const icon=this.querySelector('.menu-icon'); header.classList.toggle('menu-open',open); nav.hidden=!open; this.setAttribute('aria-expanded',String(open)); this.setAttribute('aria-label',open?'Tutup menu':'Buka menu'); icon.classList.toggle('fa-bars',!open); icon.classList.toggle('fa-xmark',open);"><i class="icon fa-solid fa-bars menu-icon" aria-hidden="true"></i></button>\n`;
  return html.replace(nav, `${menuButton}<nav id="main-navigation" class="main-nav" aria-label="Navigasi utama">`);
}

function formatPrice(amount) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatUsdEstimate(amount) {
  const dollars = Math.round((Number(amount) / idrPerUsd) * 100) / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(dollars);
}

function localizeHtml(html) {
  const translations = new Map();
  for (const [key, source] of Object.entries(idLocale.messages)) {
    const target = enLocale.messages[key];
    if (typeof source === "string" && typeof target === "string" && source !== target && !source.includes("{")) {
      translations.set(source, target);
    }
  }
  return [...translations.entries()]
    .sort(([left], [right]) => right.length - left.length)
    .reduce((result, [source, target]) => result.replaceAll(escapeHtml(source), escapeHtml(target)), html);
}

function addLanguageAlternates(html, idPath, englishPath) {
  if (!site.indexable) return html;
  const alternates = [
    `<link rel="alternate" hreflang="id-ID" href="${escapeHtml(absoluteUrl(idPath))}">`,
    `<link rel="alternate" hreflang="en" href="${escapeHtml(absoluteUrl(englishPath))}">`,
    `<link rel="alternate" hreflang="x-default" href="${escapeHtml(absoluteUrl(idPath))}">`,
  ].join("\n    ");
  return html.replace("</head>", `    ${alternates}\n  </head>`);
}

function addMarketSwitcher(html, href, label) {
  const isEnglish = label.startsWith("English");
  const countryCode = isEnglish ? "us" : "id";
  const link = '<a class="market-switch" href="' + escapeHtml(href) + '" lang="' + (isEnglish ? "en" : "id") + '" aria-label="' + escapeHtml(label) + '" title="' + escapeHtml(label) + '"><span class="fi fi-' + countryCode + '" aria-hidden="true"></span></a>';
  return html.replace(/(<div class="header-actions">[\s\S]*?)(<\/div>)/, `$1${link}$2`);
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

function productMedia(product, className = "", priority = false) {
  const isHouseNumberProduct = product.slug === "nomor-rumah-akrilik";
  const remoteImage = isHouseNumberProduct
    ? `${site.siteUrl}/assets/images/produk/nr1-hero.jpg`
    : imageUrl(product);
  const fallbackImages = [
    "https://images.unsplash.com/photo-1747862934428-899f5beb821e?auto=format&fit=crop&w=480&q=45",
    "https://images.unsplash.com/photo-1770394644126-4a17c000c122?auto=format&fit=crop&w=480&q=45",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=480&q=45",
  ];
  const imageIndex = [...String(product.slug || product.name || "")].reduce((sum, char) => sum + char.charCodeAt(0), 0) % fallbackImages.length;
  const image = remoteImage || fallbackImages[imageIndex];
  const imageAlt = isHouseNumberProduct
    ? "Nomor rumah custom akrilik hitam dengan angka stiker putih, contoh 179."
    : remoteImage ? (product.image_alt || product.name) : `Foto ilustrasi Unsplash untuk ${product.name}; bukan foto produk Toqoku.`;
  const visualClass = product.category === "plang-nama" ? "visual-sand" : "visual-sage";
  let src = image;
  let srcSet = "";
  try {
    const parsedImage = new URL(image);
    if (parsedImage.hostname === "images.unsplash.com") {
      const resized = (width, quality) => {
        const candidate = new URL(image);
        candidate.searchParams.delete("fm");
        candidate.searchParams.set("auto", "format");
        candidate.searchParams.set("fit", "crop");
        candidate.searchParams.set("w", String(width));
        candidate.searchParams.set("q", String(quality));
        return candidate.href;
      };
      src = resized(480, 45);
      srcSet = ` srcset="${escapeHtml(resized(320, 38))} 320w, ${escapeHtml(resized(480, 45))} 480w, ${escapeHtml(resized(640, 50))} 640w" sizes="(max-width: 520px) 50vw, (max-width: 720px) 33vw, (max-width: 950px) 25vw, 20vw"`;
    }
  } catch { /* Keep the original verified HTTPS image URL. */ }
  const loading = priority ? "eager" : "lazy";
  const fetchPriority = priority ? ' fetchpriority="high"' : "";
  const content = `<img class="product-photo" src="${escapeHtml(src)}"${srcSet} alt="${escapeHtml(imageAlt)}" width="480" height="360" loading="${loading}" decoding="async"${fetchPriority}>`;
  return `<a class="product-visual ${visualClass} ${className}" href="${product.link}">
    ${content}
    <span class="product-tag">${escapeHtml(product.category_name)}</span>
    <span class="visual-caption">${escapeHtml(displayFixedSize(product.fixed_size) || "Detail produk")}</span>
  </a>`;
}

function productCard(product, prefix, priority = false) {
  const link = `${prefix}produk/${escapeHtml(product.slug)}/`;
  const productForMedia = { ...product, link };
  return `<article class="product-card">
    ${productMedia(productForMedia, "", priority)}
    <div class="product-info"><div><h3><a href="${link}">${escapeHtml(product.name)}</a></h3><p>${escapeHtml(product.customization || "Produk custom")} · ${formatPrice(product.price_amount)}</p></div><a class="round-link" href="${link}" aria-label="Lihat ${escapeHtml(product.name)}">${iconSvg("arrow-up-right-from-square")}</a></div>
  </article>`;
}

const featuredIdeas = [
  { title: "Nomor rumah", detail: "Angka sesuai pilihanmu", image: "https://images.unsplash.com/photo-1747862934428-899f5beb821e?auto=format&fit=crop&w=640&q=60" },
  { title: "Angka + huruf", detail: "Contoh: A01", image: "https://images.unsplash.com/photo-1770394644126-4a17c000c122?auto=format&fit=crop&w=640&q=60" },
  { title: "Nama area", detail: "Hingga 14 karakter", image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=640&q=60" },
  { title: "Akrilik 3 mm", detail: "Potong laser CO₂", image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=640&q=60" },
  { title: "Tempel praktis", detail: "Pakai double tape", image: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=640&q=60" },
];

function featuredProductCard(idea, index) {
  const image = idea.image.replace(/w=640&q=60/, index === 0 ? "w=640&q=50" : "w=480&q=35");
  const alt = `Foto inspirasi Unsplash untuk ${idea.title}; bukan foto produk Toqoku.`;
  const loading = index === 0 ? "eager" : "lazy";
  const sourceSet = `${image.replace(/w=\d+&q=\d+/, "w=320&q=35")} 320w, ${image} ${index === 0 ? 640 : 480}w`;
  const priority = index === 0 ? ' fetchpriority="high"' : ' fetchpriority="low"';
  return `<article class="featured-tile featured-tile-${index % 2 === 0 ? "green" : "orange"}">
    <a class="featured-tile-link" href="#produk" aria-label="Lihat katalog: ${escapeHtml(idea.title)}">
      <img class="featured-tile-photo" src="${escapeHtml(image)}" srcset="${escapeHtml(sourceSet)}" sizes="(max-width: 620px) 82vw, 25vw" alt="${escapeHtml(alt)}" width="${index === 0 ? 640 : 480}" height="${index === 0 ? 782 : 587}" loading="${loading}" decoding="async"${priority}>
      <span class="featured-tile-shade" aria-hidden="true"></span>
      <span class="featured-tile-copy"><span class="featured-tile-kicker">Inspirasi custom</span><strong>${escapeHtml(idea.title)}</strong><span class="featured-tile-detail">${escapeHtml(idea.detail)}</span></span>
      <span class="featured-tile-arrow" aria-hidden="true">${iconSvg("arrow-right")}</span>
    </a>
  </article>`;
}

function customizationFields(fields, productSlug) {
  let productFields = Array.isArray(fields) ? [...fields] : [];
  if (/^nomor-rumah-/.test(productSlug || "")) {
    productFields = productFields
      .filter((field) => field.key === "house_number")
      .map((field) => ({
        ...field,
        label: "Nomor rumah",
        type: "text",
        required: true,
        max_length: 4,
        rules: { pattern: "[A-Za-z0-9]{1,4}", uppercase: true },
      }));
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
    return `<label class="form-field custom-field floating-field custom-field-${key}"><span>${label}</span><input type="text" name="custom-${key}" data-custom-key="${key}" data-custom-label="${label}" placeholder="D122"${inputMode}${length}${pattern}${uppercase}${required}></label>`;
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
  const errors = [];
  for (const url of catalogApiUrls) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const payload = await response.json();
      const catalog = payload?.data;
      if (!Array.isArray(catalog?.categories) || !Array.isArray(catalog?.products)) {
        throw new Error("format data katalog tidak valid");
      }
      return catalog;
    } catch (error) {
      errors.push(`${url}: ${error.message}`);
    }
  }

  throw new Error(`Semua API katalog gagal. Urutan dicoba: ${errors.join("; ")}`);
}

function validateCatalog(catalog) {

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

const catalog = validateCatalog(await loadCatalog());
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
const aboutTemplate = await readFile(path.join(templateDirectory, "about.html"), "utf8");
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
  const image = `https://images.unsplash.com/${idea.image}?auto=format&fit=crop&w=640&q=60`;
  return `<article class="product-card product-card-preview">
    <div class="product-visual ${index % 2 ? "visual-sand" : "visual-sage"}"><img class="product-photo" src="${image}" alt="Ide ${escapeHtml(idea.name)}. Foto Unsplash, bukan foto produk Toqoku." width="800" height="600" loading="lazy"><span class="product-tag">${escapeHtml(idea.category)}</span><span class="visual-caption">${escapeHtml(idea.detail)}</span></div>
    <div class="product-info"><div><h3>${escapeHtml(idea.name)}</h3><p>Ide produk</p></div></div>
  </article>`;
}
const homeCards = [
  ...catalog.products.map((product, index) => productCard(product, homePrefix, index === 0)),
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
  const image = (width, quality) => `https://images.unsplash.com/${category.image}?auto=format&fit=crop&w=${width}&q=${quality}`;
  const sourceSet = `${image(320, 30)} 320w, ${image(400, 35)} 400w, ${image(640, 40)} 640w`;
  return `<a class="category-photo-tile category-photo-tile-${index % 3}" href="${href}" aria-label="Lihat katalog ${escapeHtml(category.name)}"><img class="category-photo" src="${image(400, 35)}" srcset="${sourceSet}" sizes="(max-width: 420px) calc(100vw - 32px), (max-width: 720px) 50vw, (max-width: 1000px) 40vw, 33vw" alt="Inspirasi ${escapeHtml(category.name)}. Foto Unsplash, bukan foto produk Toqoku." width="400" height="267" loading="lazy" decoding="async"><span class="category-photo-shade" aria-hidden="true"></span><strong>${escapeHtml(category.name)}</strong>${iconSvg("arrow-right")}</a>`;
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
  API_FALLBACK_URL: escapeHtml(apiFallbackUrl),
});

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
const homeSeo = addSeo(homeHtml, {
  title: `Produk Custom untuk Rumah | ${site.name}`,
  description: "Lihat katalog produk custom untuk rumah. Temukan detail desain, ukuran, dan harga produk.",
  pathname: "/",
  breadcrumbs: [{ name: "Beranda", path: "/" }],
});
const homeStylesheetLink = `<link rel="stylesheet" href="./assets/css/site.css?v=${assetVersion}">`;
const homeWithInlineStyles = homeSeo.replace(homeStylesheetLink, `<style>${homeStylesheet}</style>`);
if (homeWithInlineStyles === homeSeo) throw new Error("Tautan stylesheet beranda tidak ditemukan untuk inline CSS.");
await writeFile(path.join(outputDirectory, "index.html"), addTawkWidget(addMobileNavigation(homeWithInlineStyles)), "utf8");

const aboutHtml = replaceTokens(aboutTemplate, {
  ROOT_PREFIX: "../",
  ABOUT_DESCRIPTION: "Toqoku by Ajielt7 menghadirkan nomor rumah akrilik dan produk custom. Lihat informasi toko dan lokasi kami di peta.",
  PREVIEW_BANNER: previewBanner,
  FOOTER_COPY: footerCopy,
  WHATSAPP_LINK: escapeHtml(whatsappLink),
  SOCIAL_LINKS: socialLinksMarkup,
  API_BASE_URL: escapeHtml(apiBaseUrl),
  API_FALLBACK_URL: escapeHtml(apiFallbackUrl),
});
const aboutSeo = addSeo(aboutHtml, {
  title: `Tentang Kami | ${site.name}`,
  description: "Kenali Toqoku by Ajielt7, jelajahi produk nomor rumah akrilik dan produk custom, serta temukan lokasi kami di peta.",
  pathname: "/tentang-kami/",
  breadcrumbs: [
    { name: "Beranda", path: "/" },
    { name: "Tentang Kami", path: "/tentang-kami/" },
  ],
});
const aboutDestination = path.join(outputDirectory, "tentang-kami");
await mkdir(aboutDestination, { recursive: true });
await writeFile(path.join(aboutDestination, "index.html"), addTawkWidget(addMobileNavigation(aboutSeo)), "utf8");

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
    API_FALLBACK_URL: escapeHtml(apiFallbackUrl),
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
  await writeFile(path.join(destination, "index.html"), addTawkWidget(addMobileNavigation(seoHtml)), "utf8");
}

for (const product of catalog.products) {
  const category = catalog.categories.find((item) => item.slug === product.category);
  const related = catalog.products.filter((item) => item.slug !== product.slug).slice(0, 3);
  const prefix = rootPrefix(2);
  const link = `${prefix}produk/${escapeHtml(product.slug)}/`;
  const isHouseNumberProduct = product.slug === "nomor-rumah-akrilik";
  const productDescription = isHouseNumberProduct
    ? idLocale.messages["catalog.products.nomor-rumah-akrilik.description"]
    : product.description;
  const productSize = isHouseNumberProduct ? "28 × 12 cm (landscape)" : (displayFixedSize(product.fixed_size) || "Belum ditentukan");
  const productImageBase = `${site.siteUrl}/assets/images/produk/`;
  const houseNumberImages = [
    { url: `${productImageBase}nr1-hero.jpg`, alt: "Nomor rumah akrilik hitam dengan angka stiker putih, tampak depan." },
    { url: `${productImageBase}nr1-dimensions.jpg`, alt: "Detail ukuran 28 × 12 cm dan bahan akrilik 3 mm." },
    { url: `${productImageBase}nr1-lifestyle-1.jpg`, alt: "Contoh nomor rumah akrilik terpasang pada dinding rumah." },
  ];
  const catalogImage = isHouseNumberProduct ? houseNumberImages[0].url : imageUrl(product);
  const image = catalogImage || "https://images.unsplash.com/photo-1747862934428-899f5beb821e?auto=format&fit=crop&w=1200&q=85";
  const isInspirationGallery = !isHouseNumberProduct && (!catalogImage || /^https:\/\/images\.unsplash\.com\//i.test(catalogImage));
  const imageAlt = isHouseNumberProduct
    ? houseNumberImages[0].alt
    : isInspirationGallery
      ? `Foto inspirasi untuk ${product.name}; bukan foto produk Toqoku.`
      : (product.image_alt || product.name);
  const inspirationImages = [
    { url: "https://images.unsplash.com/photo-1747862934428-899f5beb821e?auto=format&fit=crop&w=1200&q=85", alt: "Inspirasi nomor rumah pada fasad" },
    { url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=85", alt: "Inspirasi suasana rumah modern" },
    { url: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=85", alt: "Inspirasi ruang dan material rumah" },
    { url: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&q=85", alt: "Inspirasi interior rumah" },
  ];
  const galleryImages = isHouseNumberProduct
    ? houseNumberImages
    : isInspirationGallery
      ? [{ url: image, alt: imageAlt }, ...inspirationImages.filter((item) => item.url.split("?")[0] !== image.split("?")[0])].slice(0, 4)
      : [];
  const thumbnails = galleryImages.length > 1
    ? `<div class="detail-thumbnails" aria-label="Galeri foto produk">${galleryImages.map((item, index) => `<button class="detail-thumbnail${isHouseNumberProduct ? " detail-thumbnail--contain" : ""}${index === 0 ? " is-active" : ""}" type="button" data-gallery-thumb data-gallery-src="${escapeHtml(item.url)}" data-gallery-alt="${escapeHtml(item.alt)}" aria-label="Tampilkan gambar ${index + 1}" aria-pressed="${index === 0}"><img src="${escapeHtml(item.url)}" alt="" width="360" height="360" loading="lazy" decoding="async"></button>`).join("")}</div>`
    : "";
  const shortDescription = String(productDescription).trim().length > 125
    ? `${String(productDescription).trim().slice(0, 122).trimEnd()}...`
    : String(productDescription).trim();
  const relatedMarkup = [
    ...related.map((item) => productCard(item, prefix)),
    ...(!site.contentReady ? previewProductIdeas.slice(0, Math.max(0, 4 - related.length)).map(previewIdeaCard) : []),
  ].join("\n");
  const media = image
    ? `<img class="detail-photo" src="${escapeHtml(image)}" alt="${escapeHtml(imageAlt)}" width="1000" height="1000" fetchpriority="high">`
    : '<div class="detail-image-placeholder" role="img" aria-label="Foto produk belum tersedia"></div>';
  const html = replaceTokens(productTemplate, {
    ROOT_PREFIX: prefix,
    CATEGORY_SLUG: escapeHtml(category.slug),
    CATEGORY_NAME: escapeHtml(category.name),
    PRODUCT_NAME: escapeHtml(product.name),
    PRODUCT_SLUG: escapeHtml(product.slug),
    PRODUCT_PRICE_AMOUNT: String(product.price_amount),
    PRODUCT_DESCRIPTION: escapeHtml(productDescription),
    PRODUCT_SHORT_DESCRIPTION: escapeHtml(shortDescription),
    PRODUCT_MEDIA: media,
    PRODUCT_GALLERY_BADGE: isHouseNumberProduct ? "" : `<span class="gallery-badge">${isInspirationGallery ? "Inspirasi pilihan" : "Foto produk"}</span>`,
    PRODUCT_MEDIA_CAPTION: isInspirationGallery
      ? '<figcaption>Foto inspirasi; bukan foto produk Toqoku.</figcaption>'
      : "",
    PRODUCT_THUMBNAILS: thumbnails,
    PRODUCT_SIZE: escapeHtml(productSize),
    PRODUCT_CUSTOMIZATION: escapeHtml(product.customization || "Belum ditentukan"),
    CUSTOM_FIELDS: customizationFields(product.customization_fields, product.slug),
    PRODUCT_PRICE: formatPrice(product.price_amount),
    RELATED_SECTION: relatedMarkup
      ? `<section class="related-products detail-related" aria-labelledby="related-title"><div class="related-heading"><h2 id="related-title">Produk lainnya</h2><a class="text-link" href="${prefix}index.html#produk">Semua produk ${iconSvg("arrow-right")}</a></div><div class="product-grid">${relatedMarkup}</div></section>`
      : "",
    PREVIEW_BANNER: previewBanner,
    DEMO_NOTE: previewMode ? '<p class="demo-note detail-notice">Informasi dan foto ini hanya contoh pratinjau.</p>' : "",
    FOOTER_COPY: footerCopy,
    WHATSAPP_LINK: escapeHtml(whatsappLink),
    SOCIAL_LINKS: socialLinksMarkup,
    API_BASE_URL: escapeHtml(apiBaseUrl),
    API_FALLBACK_URL: escapeHtml(apiFallbackUrl),
    CUSTOM_PREVIEW_SCRIPT: `<script src="${prefix}assets/js/custom-preview.js?v=${assetVersion}" defer></script>`,
    PRODUCT_GALLERY_SCRIPT: `<script src="${prefix}assets/js/product-gallery.js?v=${assetVersion}" defer></script>`,
  });
  const seoHtml = addSeo(html, {
    title: `${product.name} Custom | ${site.name}`,
     description: productDescription,
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
      description: productDescription,
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
  await writeFile(path.join(destination, "index.html"), addTawkWidget(addMobileNavigation(seoHtml)), "utf8");
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
    API_FALLBACK_URL: escapeHtml(apiFallbackUrl),
  });
  const destination = path.join(outputDirectory, slug);
  await mkdir(destination, { recursive: true });
  await writeFile(path.join(destination, "index.html"), addTawkWidget(addMobileNavigation(addNoIndex(html))), "utf8");
}

const publicPages = [
  { path: "/", priority: "1.0" },
  { path: "/tentang-kami/", priority: "0.6" },
  ...catalog.categories.filter((category) => catalog.products.some((product) => product.category === category.slug))
    .map((category) => ({ path: `/kategori/${category.slug}/`, priority: "0.8" })),
  ...catalog.products.map((product) => ({ path: `/produk/${product.slug}/`, priority: "0.7" })),
];

const marketLabelId = idLocale.messages["market.switchToInternational"];
const marketLabelEn = enLocale.messages["market.switchToIndonesia"];
const usdDisclaimer = `${enLocale.messages["market.usdEstimate"]} ${enLocale.messages["market.rateReference"] || "Reference rate"}: ${internationalMarket.priceDisplay.rateSource} (${internationalMarket.priceDisplay.rateDate}).`;
const categoryOverrides = enLocale.messages;
const englishWords = {
  nomor: "Number", rumah: "House", akrilik: "Acrylic", plakat: "Plaque", gantungan: "Keychain",
  kunci: "Key", stand: "Stand", plang: "Sign", nama: "Name", papan: "Board", petunjuk: "Guide",
  qris: "QRIS", kecil: "Small", wifi: "Wi-Fi", toilet: "Restroom", arah: "Directional",
};
const englishSlugPhrases = {
  "nomor-rumah": "House numbers",
  "nomor-rumah-akrilik": "Acrylic House Number",
  "plang-nama": "Custom Signs",
  "plakat-akrilik": "Acrylic Plaques",
  "gantungan-kunci": "Keychains",
  "stand-qris": "QRIS Stands",
  "papan-petunjuk": "Wayfinding Signs",
};
function englishSlug(slug) {
  return englishSlugPhrases[slug] || String(slug).split("-").map((word) => englishWords[word.toLowerCase()] || word[0]?.toUpperCase() + word.slice(1)).join(" ");
}
function englishCatalogValue(type, slug, field, fallback) {
  const key = `catalog.${type}.${slug}.${field}`;
  const translated = categoryOverrides[key];
  if (typeof translated === "string" && translated.trim()) return translated;
  const sourceCatalog = type === "categories" ? catalog.categories : catalog.products;
  const sourceItem = sourceCatalog.find((item) => item.slug === slug);
  const sourceField = field === "category" ? "category" : field;
  const sourceValue = sourceItem?.[sourceField];
  console.warn(`Terjemahan ${key} belum ada; memakai teks Indonesia pada halaman Inggris.`);
  return typeof sourceValue === "string" && sourceValue.trim() ? sourceValue : fallback;
}
function localizedText(locale, key, values = {}) {
  const template = locale.messages[key];
  if (typeof template !== "string") throw new Error(`Pesan locale tidak ditemukan: ${key}`);
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, name) => String(values[name] ?? `{${name}}`));
}
function englishRoute(idPath) {
  if (idPath === "/") return "/en/";
  if (idPath === "/tentang-kami/") return "/en/about/";
  if (idPath.startsWith("/kategori/")) return idPath.replace(/^\/kategori\//, "/en/categories/");
  if (idPath.startsWith("/produk/")) return idPath.replace(/^\/produk\//, "/en/products/");
  return `/en${idPath}`;
}
function pageFile(pathname) {
  return pathname === "/"
    ? path.join(outputDirectory, "index.html")
    : path.join(outputDirectory, pathname.replace(/^\//, ""), "index.html");
}
function translateCatalogContent(html, pagePath) {
  let result = html;
  const category = catalog.categories.find((item) => pagePath === `/kategori/${item.slug}/`);
  const product = catalog.products.find((item) => pagePath === `/produk/${item.slug}/`);
  const replaceValue = (source, target) => {
    if (source != null && target != null && String(source) !== String(target)) {
      result = result.replaceAll(escapeHtml(source), escapeHtml(target));
    }
  };
  for (const item of catalog.categories) {
    const name = englishCatalogValue("categories", item.slug, "name", englishSlug(item.slug));
    const description = englishCatalogValue("categories", item.slug, "description", `Explore our ${name.toLowerCase()} collection and contact us to confirm product details, pricing, and international shipping.`);
    replaceValue(item.name, name);
    replaceValue(item.description, description);
  }
  for (const item of catalog.products) {
    const name = englishCatalogValue("products", item.slug, "name", englishSlug(item.slug));
    const description = englishCatalogValue("products", item.slug, "description", `Custom-made ${name.toLowerCase()}. Contact us to confirm specifications, final pricing, and international shipping.`);
    const customization = englishCatalogValue("products", item.slug, "customization", "Custom options available");
    const sourceDescription = item.slug === "nomor-rumah-akrilik"
      ? idLocale.messages["catalog.products.nomor-rumah-akrilik.description"]
      : item.description;
    replaceValue(item.name, name);
    replaceValue(sourceDescription, description);
    replaceValue(item.customization || "Produk custom", customization);
    const priceIdr = formatPrice(item.price_amount);
    result = result.replaceAll(escapeHtml(priceIdr), escapeHtml(formatUsdEstimate(item.price_amount)));
    const oldAlt = item.image_alt || item.name;
    const sourceImageIsInspiration = !imageUrl(item) || /^https:\/\/images\.unsplash\.com\//i.test(imageUrl(item));
    replaceValue(oldAlt, sourceImageIsInspiration
      ? localizedText(enLocale, "product.photo.inspirationAlt", { name })
      : localizedText(enLocale, "product.photo.productAlt", { name }));
    if (item.slug === product?.slug) {
      const oldShort = String(item.description).trim().length > 125
        ? `${String(item.description).trim().slice(0, 122).trimEnd()}...`
        : String(item.description).trim();
      const newShort = description.length > 125 ? `${description.slice(0, 122).trimEnd()}...` : description;
      replaceValue(oldShort, newShort);
      replaceValue(`Foto inspirasi untuk ${item.name}; bukan foto produk Toqoku.`, localizedText(enLocale, "product.photo.inspirationAlt", { name }));
      replaceValue(`Foto ilustrasi Unsplash untuk ${item.name}; bukan foto produk Toqoku.`, localizedText(enLocale, "product.photo.inspirationAlt", { name }));
      result = result.replace(/(<label class="form-field custom-field floating-field custom-field-house_number"><span>)[\s\S]*?(<\/span><input)/, `$1${escapeHtml(enLocale.messages["catalog.fields.house_number"] || "House number")}$2`);
      result = result.replace(/(<label class="form-field custom-field custom-field-area_name">)[\s\S]*?(<input)/, `$1${escapeHtml(enLocale.messages["catalog.fields.area_name"] || "Area name (optional)")}$2`);
      result = result.replace(/data-custom-label="[^"]*"/g, (match) => {
        const source = match.slice('data-custom-label="'.length, -1);
        const translated = source === idLocale.messages["catalog.fields.house_number"]
          ? enLocale.messages["catalog.fields.house_number"]
          : source === idLocale.messages["catalog.fields.area_name"]
            ? enLocale.messages["catalog.fields.area_name"]
            : source;
        return `data-custom-label="${escapeHtml(translated)}"`;
      });
      result = result.replace(/<form class="cart-add-form" data-product-form[^>]*>/,
        `<section class="cart-add-form international-quote" data-intl-quote data-whatsapp="${escapeHtml(site.whatsappNumber)}" data-product-name="${escapeHtml(name)}" data-display-price="${escapeHtml(formatUsdEstimate(item.price_amount))}" data-quote-template="${escapeHtml(enLocale.messages["market.contactMessage"])}" data-details-template="${escapeHtml(enLocale.messages["market.quoteDetailsLabel"])}" data-quantity-label="${escapeHtml(enLocale.messages["market.quoteQuantityLabel"])}" data-price-template="${escapeHtml(enLocale.messages["market.quotePriceLine"])}" data-price-label="${escapeHtml(enLocale.messages["product.quote.priceLabel"])}">`);
      result = result.replace(/<legend>[^<]*<\/legend>/, `<legend>${escapeHtml(enLocale.messages["product.custom.legend"])}</legend>`);
      result = result.replace(/(<legend>[^<]*<\/legend>)/, `$1<p class="form-hint international-quote-body">${escapeHtml(enLocale.messages["product.quote.body"])}</p>`);
      result = result.replace(/<div class="detail-actions">[\s\S]*?<\/div>\s*<p class="form-message" data-form-message[^>]*><\/p>/,
        `<div class="detail-actions"><a class="button button-primary" data-quote-link href="https://wa.me/${site.whatsappNumber}">${escapeHtml(enLocale.messages["product.quote.button"])}</a></div><p class="form-hint international-quote-note">${escapeHtml(enLocale.messages["product.quote.note"])}</p>`);
      result = result.replace(/<\/form>/, "</section>");
      result = result.replace('<p class="detail-price"><strong>', `<p class="detail-price"><span>${escapeHtml(enLocale.messages["product.quote.priceLabel"])}</span><strong>`);
      result = result.replace(/<script[^>]+cart\.js[^>]*><\/script>/g, "");
      result = result.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (match, raw) => {
        try {
          const schema = JSON.parse(raw);
          return schema["@type"] === "Product" ? "" : match;
        } catch { return match; }
      });
      result = result.replace(/<a class="footer-contact" href="[^"]*"([^>]*)>/, `<a class="footer-contact" href="https://wa.me/${site.whatsappNumber}?text=${encodeURIComponent(enLocale.messages["market.generalContactMessage"])}"$1>`);
    }
  }
  if (category) {
    const categoryName = englishCatalogValue("categories", category.slug, "name", englishSlug(category.slug));
    const categoryDescription = englishCatalogValue("categories", category.slug, "description", `Explore our ${categoryName.toLowerCase()} collection and contact us to confirm product details, pricing, and international shipping.`);
    replaceValue(category.name, categoryName);
    replaceValue(category.description, categoryDescription);
    result = result.replaceAll(`aria-label="Lihat katalog ${escapeHtml(category.name)}"`, `aria-label="${escapeHtml(localizedText(enLocale, "products.browseCategoryLabel", { name: categoryName }))}"`);
    result = result.replaceAll(`alt="Inspirasi ${escapeHtml(category.name)}. Foto Unsplash, bukan foto produk Toqoku."`, `alt="${escapeHtml(localizedText(enLocale, "product.photo.inspirationAlt", { name: categoryName }))}"`);
  }
  result = result.replace(/aria-label="Tampilkan inspirasi (\d+)"/g, (_, number) => `aria-label="${escapeHtml(localizedText(enLocale, "product.gallery.showLabel", { number }))}"`);
  result = result.replace(/aria-label="Lihat katalog: ([^"]+)"/g, (_, name) => `aria-label="${escapeHtml(localizedText(enLocale, "products.browseCategoryLabel", { name }))}"`);
  result = result.replace(/Foto inspirasi Unsplash untuk ([^;]+); bukan foto produk Toqoku\./g, (_, name) => localizedText(enLocale, "product.photo.inspirationAlt", { name }));
  result = result.replace(/<iframe([^>]*?)title="[^"]*"/g, '<iframe$1title="' + escapeHtml(enLocale.messages["about.location.mapTitle"]) + '"');
  result = result.replace('aria-label="Galeri foto produk"', `aria-label="${escapeHtml(enLocale.messages["product.gallery.label"])}"`);
  result = result.replace('aria-label="Foto inspirasi lainnya"', `aria-label="${escapeHtml(enLocale.messages["product.gallery.moreLabel"])}"`);
  result = result.replace('aria-label="Pratinjau personalisasi produk"', `aria-label="${escapeHtml(enLocale.messages["product.preview.accessibleLabel"])}"`);
  result = result.replace('alt="Inspirasi nomor rumah pada fasad. Foto Unsplash, bukan foto produk Toqoku."', `alt="${escapeHtml(enLocale.messages["home.hero.imageAlt"])}"`);
  return result;
}

for (const { path: idPath } of publicPages) {
  const englishPath = englishRoute(idPath);
  const idFile = pageFile(idPath);
  const englishFile = path.join(outputDirectory, englishPath === "/en/" ? "en/index.html" : `${englishPath.replace(/^\//, "")}index.html`);
  await mkdir(path.dirname(englishFile), { recursive: true });
  let html = await readFile(idFile, "utf8");
  html = translateCatalogContent(html, idPath);
  html = localizeHtml(html);
  html = html.replace('<html lang="id">', '<html lang="en">');
  for (const page of [...publicPages].sort((left, right) => right.path.length - left.path.length)) {
    html = html.replaceAll(`${absoluteUrl(page.path)}"`, `${absoluteUrl(englishRoute(page.path))}"`);
  }
  html = html.replaceAll('content="id-ID"', 'content="en_US"');
  html = html.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${escapeHtml(idPath === "/"
    ? enLocale.messages["seo.home.description"]
    : idPath === "/tentang-kami/"
      ? enLocale.messages["seo.about.description"]
      : idPath.startsWith("/kategori/")
        ? (englishCatalogValue("categories", idPath.split("/")[2], "description", "Browse our custom product collection. Contact us to confirm product details, pricing, and international shipping."))
        : englishCatalogValue("products", idPath.split("/")[2], "description", "Custom-made product. Contact us to confirm specifications, final pricing, and international shipping."))}">`);
  if (idPath === "/") {
    html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(enLocale.messages["seo.home.title"])} | ${escapeHtml(site.name)}</title>`);
  }
  if (idPath === "/tentang-kami/") {
    html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(localizedText(enLocale, "seo.about.title", { store: site.name }))}</title>`);
  }
  if (idPath.startsWith("/kategori/")) {
    const category = catalog.categories.find((item) => item.slug === idPath.split("/")[2]);
    const name = category && englishCatalogValue("categories", category.slug, "name", englishSlug(category.slug));
    if (name) html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(localizedText(enLocale, "seo.category.title", { name, store: site.name }))}</title>`);
  }
  if (idPath.startsWith("/produk/")) {
    const product = catalog.products.find((item) => item.slug === idPath.split("/")[2]);
    const name = product && englishCatalogValue("products", product.slug, "name", englishSlug(product.slug));
    if (name) html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(localizedText(enLocale, "seo.product.title", { name, store: site.name }))}</title>`);
  }
  html = html.replaceAll("tentang-kami/", "about/").replaceAll("kategori/", "categories/").replaceAll("produk/", "products/");
  html = html.replace(/((?:\.\.\/)*)(?:\.\/)?assets\//g, (_, prefix) => `${prefix}../assets/`);
  html = html.replace(/<a class="header-cart"[^>]*>[\s\S]*?<\/a>/g, "");
  html = html.replace(/<a href="[^"]*lacak-pesanan[^"]*">[\s\S]*?<\/a>/g, "");
  html = html.replace(/<script[^>]+cart\.js[^>]*><\/script>/g, "");
  html = html.replace(/<form[^>]*data-product-search[^>]*>/, (openingTag) => `${openingTag.slice(0, -1)} data-result-template="${escapeHtml(enLocale.messages["search.results"])}" data-empty-template="${escapeHtml(enLocale.messages["search.noResults"])}" data-order-code-message="${escapeHtml(enLocale.messages["search.internationalTracking"])}">`);
  for (const key of ["search.quick.houseNumber", "search.quick.plaque", "search.quick.keychain", "search.quick.qris"]) {
    const source = idLocale.messages[key];
    html = html.replaceAll(`data-search-term="${escapeHtml(source)}"`, `data-search-term="${escapeHtml(enLocale.messages[key])}"`);
  }
  html = html.replace(/(<input[^>]*data-custom-key="house_number"[^>]*)(?:maxlength="[^"]*")?/, '$1maxlength="6"');
  if (site.indexable) {
    html = html.replace("</head>", `    <link rel="alternate" hreflang="id-ID" href="${escapeHtml(absoluteUrl(idPath))}">\n    <link rel="alternate" hreflang="en" href="${escapeHtml(absoluteUrl(englishPath))}">\n    <link rel="alternate" hreflang="x-default" href="${escapeHtml(absoluteUrl(idPath))}">\n  </head>`);
  }
  html = html.replace(/<a class="market-switch"[^>]*>[\s\S]*?<\/a>/g, "");
  html = addMarketSwitcher(html, idPath, marketLabelEn);
  html = html.replace("</header>", `</header>\n    <aside class="market-estimate-note" aria-label="${escapeHtml(enLocale.messages["market.internationalPricingLabel"])}">${escapeHtml(usdDisclaimer)}</aside>`);
  const assetPrefix = rootPrefix(englishPath.split("/").filter(Boolean).length);
  if (idPath.startsWith("/produk/")) {
    html = html.replace("</body>", `<script src="${assetPrefix}assets/js/international-quote.js" defer></script>\n  </body>`);
  }
  await writeFile(englishFile, addMobileNavigation(html), "utf8");

  let idHtml = await readFile(idFile, "utf8");
  idHtml = addLanguageAlternates(idHtml, idPath, englishPath);
  idHtml = addMarketSwitcher(idHtml, englishPath, marketLabelId);
  await writeFile(idFile, idHtml, "utf8");
}

const robots = site.indexable
  ? `User-agent: *\nAllow: /\n\nSitemap: ${absoluteUrl("/sitemap.xml")}\n`
  : "User-agent: *\nAllow: /\n";
await writeFile(path.join(outputDirectory, "robots.txt"), robots, "utf8");
if (site.indexable) {
  const urls = [...publicPages, ...publicPages.map(({ path: pagePath, priority }) => ({ path: englishRoute(pagePath), priority }))].map(({ path: pagePath, priority }) =>
    `  <url><loc>${escapeHtml(absoluteUrl(pagePath))}</loc><priority>${priority}</priority></url>`
  ).join("\n");
  await writeFile(path.join(outputDirectory, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, "utf8");
}

await copyAssetFiles(path.join(sourceDirectory, "assets"), path.join(outputDirectory, "assets"));
await copyAssetFiles(path.join(sourceDirectory, "static"), outputDirectory);
console.log(`Situs statis dibuat dari API (${catalog.categories.length} kategori, ${catalog.products.length} produk).`);

