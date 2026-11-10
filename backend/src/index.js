import { createDxf, parsePlateSize } from "./dxf.js";

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
};
const maxOrderBodyBytes = 16 * 1024;
const orderCodeAlphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const rajaOngkirBaseUrl = "https://rajaongkir.komerce.id/api/v1";
const rajaOngkirCouriers = "jne:sicepat:ide:sap:ninja:jnt:tiki:wahana:pos:sentral:lion:rex:spx";
const maxPaymentProofBytes = 5 * 1024 * 1024;
const storeCoordinates = { latitude: -6.929830025113192, longitude: 107.74308140067622 };
const osrmBaseUrl = "https://router.project-osrm.org/route/v1/driving";
const valhallaRouteUrl = "https://valhalla1.openstreetmap.de/route";
const localCourierMaxDistanceKm = 30;
const fcmTokenUrl = "https://oauth2.googleapis.com/token";
const fcmMessagingScope = "https://www.googleapis.com/auth/firebase.messaging";
let cachedFcmAccessToken = "";
let cachedFcmTokenExpiresAt = 0;

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...jsonHeaders, ...extraHeaders },
  });
}

function corsHeaders(origin) {
  if (!origin) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "Content-Type, Idempotency-Key, Authorization",
    "access-control-max-age": "600",
    vary: "Origin",
  };
}

function getAllowedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return null;
  const allowed = (env.ALLOWED_ORIGINS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  return allowed.includes(origin) ? origin : false;
}

function parseLimit(url) {
  const rawLimit = Number.parseInt(url.searchParams.get("limit") ?? "24", 10);
  if (!Number.isFinite(rawLimit)) return 24;
  return Math.min(Math.max(rawLimit, 1), 100);
}

async function requestRajaOngkir(path, init, apiKey) {
  const response = await fetch(`${rajaOngkirBaseUrl}${path}`, {
    ...init,
    headers: { key: apiKey, ...(init?.headers ?? {}) },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.meta?.status === "error") {
    const error = new Error(`RajaOngkir returned HTTP ${response.status}`);
    error.status = 502;
    throw error;
  }
  return payload;
}

function cleanRajaRates(payload) {
  const rates = Array.isArray(payload?.data) ? payload.data : [];
  return rates.map((rate) => ({
    code: String(rate.code ?? "").toLowerCase(),
    name: String(rate.name ?? rate.code ?? ""),
    service: String(rate.service ?? ""),
    description: String(rate.description ?? ""),
    cost: Number(rate.cost),
    etd: String(rate.etd ?? ""),
  })).filter((rate) => rate.code && rate.service && Number.isSafeInteger(rate.cost) && rate.cost >= 0);
}

function validCoordinates(latitude, longitude) {
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
    && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

async function getRouteDistance(latitude, longitude) {
  const coordinates = `${storeCoordinates.longitude},${storeCoordinates.latitude};${longitude},${latitude}`;
  try {
    const response = await fetch(`${osrmBaseUrl}/${coordinates}?overview=false&steps=false`);
    const payload = await response.json().catch(() => null);
    const meters = Number(payload?.routes?.[0]?.distance);
    if (response.ok && payload?.code === "Ok" && Number.isFinite(meters) && meters > 0) {
      return { distanceMeters: meters, distanceKm: Math.round(meters / 10) / 100, provider: "OSRM" };
    }
  } catch (error) {
    logOperationalError("osrm_route", error);
  }
  try {
    const response = await fetch(valhallaRouteUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        locations: [storeCoordinates, { latitude, longitude }].map(({ latitude: lat, longitude: lon }) => ({ lat, lon })),
        costing: "auto",
        units: "kilometers",
      }),
    });
    const payload = await response.json().catch(() => null);
    const distanceKm = Number(payload?.trip?.summary?.length);
    if (response.ok && Number.isFinite(distanceKm) && distanceKm > 0) {
      return { distanceMeters: distanceKm * 1000, distanceKm: Math.round(distanceKm * 100) / 100, provider: "Valhalla" };
    }
  } catch (error) {
    logOperationalError("valhalla_route", error);
  }
  return null;
}

function calculateLocalShipping(distanceMeters) {
  const distanceKm = distanceMeters / 1000;
  return distanceKm <= 4 ? 10000 : 10000 + Math.ceil(distanceKm - 4) * 2500;
}

function localCourierRate(route) {
  if (!route || route.distanceKm >= localCourierMaxDistanceKm) return null;
  return {
    code: "gojek",
    name: "Gojek",
    service: "Same Day",
    description: `${route.distanceKm} km · 4 km pertama Rp10.000, selanjutnya Rp2.500/km`,
    cost: calculateLocalShipping(route.distanceMeters),
    etd: "Hari yang sama",
    route_distance_km: route.distanceKm,
  };
}

async function getShippingWeight(env, cart) {
  const slugs = [...new Set(cart.map((item) => item.slug))];
  const placeholders = slugs.map(() => "?").join(", ");
  const { results } = await env.DB.prepare(
    `SELECT p.slug, p.shipping_weight_grams
     FROM products AS p JOIN product_categories AS c ON c.id = p.category_id
     WHERE p.slug IN (${placeholders}) AND p.is_active = 1 AND c.is_active = 1`,
  ).bind(...slugs).all();
  const weights = new Map(results.map((row) => [row.slug, Number(row.shipping_weight_grams)]));
  let total = 0;
  for (const item of cart) {
    const weight = weights.get(item.slug);
    if (!Number.isSafeInteger(weight) || weight < 1) throw inputError("Berat produk belum tersedia untuk menghitung ongkir.");
    total += weight * item.quantity;
    if (!Number.isSafeInteger(total) || total > 100000) throw inputError("Berat paket melebihi batas perhitungan ongkir.");
  }
  return total;
}

async function calculateShippingRates(env, destinationId, cart) {
  if (env.APP_ENV === "test") {
    return { weight: await getShippingWeight(env, cart), rates: [{ code: "jne", name: "JNE", service: "REG", description: "Layanan simulasi lokal", cost: 10000, etd: "1-2 hari" }] };
  }
  if (!env.RAJAONGKIR_API_KEY) {
    const error = new Error("API ongkir belum dikonfigurasi.");
    error.status = 503;
    throw error;
  }
  const origin = String(env.RAJAONGKIR_ORIGIN_ID || "5052");
  const weight = await getShippingWeight(env, cart);
  const form = new URLSearchParams({
    origin,
    destination: destinationId,
    weight: String(weight),
    courier: rajaOngkirCouriers,
    price: "lowest",
  });
  const result = await requestRajaOngkir("/calculate/domestic-cost", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form,
  }, env.RAJAONGKIR_API_KEY);
  return { weight, rates: cleanRajaRates(result) };
}

async function searchShippingDestinations(request, env, headers) {
  if (env.APP_ENV === "test") {
    const search = new URL(request.url).searchParams.get("search")?.trim() ?? "";
    if (search.length < 3 || search.length > 80) return jsonResponse({ error: "invalid_search", message: "Ketik minimal 3 karakter nama kecamatan atau kelurahan." }, 400, headers);
    return jsonResponse({ data: [{ id: "101", label: "Kelurahan Uji, Kecamatan Uji, Kota Bandung" }] }, 200, headers);
  }
  if (!env.RAJAONGKIR_API_KEY) return jsonResponse({ error: "shipping_not_configured", message: "Pencarian tujuan belum dikonfigurasi." }, 503, headers);
  const search = new URL(request.url).searchParams.get("search")?.trim() ?? "";
  if (search.length < 3 || search.length > 80) return jsonResponse({ error: "invalid_search", message: "Ketik minimal 3 karakter nama kecamatan atau kelurahan." }, 400, headers);
  try {
    const cache = globalThis.caches?.default;
    const cacheKey = new Request(`https://ruma-shipping-cache.invalid/destination/${encodeURIComponent(search.toLocaleLowerCase("id-ID"))}`);
    const cached = cache ? await cache.match(cacheKey) : null;
    if (cached) {
      const body = await cached.json();
      return jsonResponse(body, 200, { ...headers, "cache-control": "public, max-age=300" });
    }
    const query = new URLSearchParams({ search, limit: "10", offset: "0" });
    const result = await requestRajaOngkir(`/destination/domestic-destination?${query}`, {}, env.RAJAONGKIR_API_KEY);
    const data = (Array.isArray(result.data) ? result.data : []).map((item) => ({
      id: String(item.id ?? ""),
      label: String(item.label ?? item.subdistrict_name ?? item.name ?? ""),
    })).filter((item) => /^\d{1,12}$/.test(item.id) && item.label);
    const body = { data };
    if (data.length && cache) {
      try {
        await cache.put(cacheKey, new Response(JSON.stringify(body), {
          headers: { "content-type": "application/json", "cache-control": "public, max-age=2592000" },
        }));
      } catch {
        // Cache is an optimization; a successful RajaOngkir response still serves checkout.
      }
    }
    return jsonResponse(body, 200, { ...headers, "cache-control": data.length ? "public, max-age=300" : "no-store" });
  } catch (error) {
    logOperationalError("rajaongkir_destination_search", error);
    return jsonResponse({ error: "shipping_provider_error", message: "Pencarian tujuan belum berhasil. Coba lagi." }, 502, headers);
  }
}

async function quoteShipping(request, env, headers) {
  if (!env.RAJAONGKIR_API_KEY && env.APP_ENV !== "test") return jsonResponse({ error: "shipping_not_configured", message: "Ongkir belum dikonfigurasi." }, 503, headers);
  try {
    const body = await readBoundedJson(request);
    const destinationId = String(body?.destination_id ?? "");
    if (!/^\d{1,12}$/.test(destinationId)) throw inputError("Pilih tujuan dari hasil pencarian.");
    const cart = validateCartInput(body.items);
    const { weight, rates } = await calculateShippingRates(env, destinationId, cart);
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    let route = null;
    if (validCoordinates(latitude, longitude)) {
      route = await getRouteDistance(latitude, longitude);
      const localRate = localCourierRate(route);
      if (localRate) rates.push(localRate);
    }
    return jsonResponse({
      data: rates,
      weight_grams: weight,
      route_distance_km: route?.distanceKm ?? null,
      local_courier_available: Boolean(localCourierRate(route)),
      currency: "IDR",
    }, 200, headers);
  } catch (error) {
    if (error.status === 400) return jsonResponse({ error: "validation_error", message: error.message }, 400, headers);
    if (error.status === 503) return jsonResponse({ error: "shipping_not_configured", message: error.message }, 503, headers);
    logOperationalError("rajaongkir_shipping_quote", error);
    return jsonResponse({ error: "shipping_provider_error", message: "Tarif ongkir belum berhasil dimuat. Coba lagi." }, 502, headers);
  }
}

function hasSupportedImageSignature(bytes, contentType) {
  if (contentType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === "image/png") return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte);
  if (contentType === "image/webp") {
    return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}

async function uploadPrivatePaymentProof(file, paymentId, env) {
  if (env.APP_ENV === "test" && env.TEST_PAYMENT_PROOF_STORAGE === "memory") {
    const fileId = `test-${crypto.randomUUID()}`;
    const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
    return { fileId, filePath: `/test/payment-proofs/${fileId}.${extension}` };
  }
  if (!env.IMAGEKIT_PRIVATE_KEY && !(env.APP_ENV === "test" && env.TEST_PAYMENT_PROOF_STORAGE === "memory")) {
    const error = new Error("Penyimpanan bukti pembayaran belum dikonfigurasi.");
    error.status = 503;
    throw error;
  }
  const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
  const form = new FormData();
  form.set("file", file, `proof-${paymentId}.${extension}`);
  form.set("fileName", `proof-${paymentId}-${crypto.randomUUID()}.${extension}`);
  form.set("folder", "/ruma/payment-proofs");
  form.set("isPrivateFile", "true");
  form.set("useUniqueFileName", "true");
  form.set("tags", "ruma-payment-proof");
  let response;
  try {
    response = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
      method: "POST",
      headers: { authorization: `Basic ${btoa(`${env.IMAGEKIT_PRIVATE_KEY}:`)}` },
      body: form,
    });
  } catch (error) {
    logOperationalError("imagekit_upload", error);
    const upstreamError = new Error("ImageKit belum dapat menerima bukti. Coba lagi nanti.");
    upstreamError.status = 502;
    throw upstreamError;
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.fileId || !payload?.filePath) {
    console.error("ImageKit rejected payment proof", JSON.stringify({ status: response.status, requestId: response.headers.get("x-ik-requestId") }));
    const upstreamError = new Error("Bukti belum berhasil disimpan. Periksa file lalu coba lagi.");
    upstreamError.status = 502;
    throw upstreamError;
  }
  return { fileId: String(payload.fileId), filePath: String(payload.filePath) };
}

async function submitPaymentProof(request, env, headers) {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxPaymentProofBytes + 16 * 1024) {
    return jsonResponse({ error: "file_too_large", message: "Ukuran bukti maksimal 5 MB." }, 413, headers);
  }
  if (!env.IMAGEKIT_PRIVATE_KEY && !(env.APP_ENV === "test" && env.TEST_PAYMENT_PROOF_STORAGE === "memory")) {
    return jsonResponse({ error: "proof_storage_not_configured", message: "Penyimpanan bukti belum dikonfigurasi." }, 503, headers);
  }

  try {
    const form = await request.formData();
    const paymentReference = boundedText(form.get("payment_reference"), "Kode pembayaran", 4, 64);
    const phone = boundedText(form.get("phone"), "Nomor telepon", 8, 24);
    const proof = form.get("proof");
    if (!(proof instanceof File) || proof.size < 1 || proof.size > maxPaymentProofBytes) {
      return jsonResponse({ error: "invalid_file", message: "Pilih bukti gambar maksimal 5 MB." }, 400, headers);
    }
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!allowedTypes.has(proof.type)) return jsonResponse({ error: "invalid_file_type", message: "Format bukti harus JPG, PNG, atau WebP." }, 400, headers);

    const payment = await env.DB.prepare(
      `SELECT p.id AS payment_id, p.payment_status, p.proof_file_id,
              o.id AS order_id, o.customer_phone, o.payment_expires_at
       FROM payments AS p JOIN orders AS o ON o.id = p.order_id
       WHERE p.payment_reference = ?1 LIMIT 1`,
    ).bind(paymentReference).first();
    const phoneDigits = phone.replace(/\D/g, "");
    const savedPhoneDigits = String(payment?.customer_phone ?? "").replace(/\D/g, "");
    if (!payment || !phoneDigits || phoneDigits !== savedPhoneDigits) {
      return jsonResponse({ error: "order_not_found", message: "Pesanan tidak ditemukan. Periksa kode dan nomor telepon." }, 404, headers);
    }
    if (payment.payment_status !== "pending") {
      return jsonResponse({ error: "payment_not_pending", message: "Pesanan ini tidak sedang menunggu pembayaran." }, 409, headers);
    }
    if (!payment.payment_expires_at || Date.parse(payment.payment_expires_at) <= Date.now()) {
      return jsonResponse({ error: "payment_expired", message: "Pembayaran telah kedaluwarsa. Silakan buat pesanan baru." }, 410, headers);
    }
    if (payment.proof_file_id) {
      return jsonResponse({ error: "proof_already_uploaded", message: "Bukti untuk pesanan ini sudah diterima." }, 409, headers);
    }

    const bytes = new Uint8Array(await proof.arrayBuffer());
    if (!hasSupportedImageSignature(bytes, proof.type)) {
      return jsonResponse({ error: "invalid_image", message: "Isi file tidak cocok dengan format gambar yang dipilih." }, 400, headers);
    }
    const storedFile = await uploadPrivatePaymentProof(new File([bytes], proof.name, { type: proof.type }), payment.payment_id, env);
    const uploadedAt = new Date().toISOString();
    const update = await env.DB.batch([
      env.DB.prepare(
      `UPDATE payments SET proof_file_id = ?1, proof_file_path = ?2,
         proof_uploaded_at = ?3, updated_at = ?3
       WHERE id = ?4 AND proof_file_id IS NULL AND payment_status = 'pending'
         AND EXISTS (SELECT 1 FROM orders WHERE id = ?5 AND payment_expires_at > ?3)`,
      ).bind(storedFile.fileId, storedFile.filePath, uploadedAt, payment.payment_id, payment.order_id),
      env.DB.prepare(
        `INSERT INTO order_status_history (
           id, order_id, status_type, previous_status, new_status, actor_type, note
         ) SELECT ?1, ?2, 'payment', 'pending', 'pending', 'customer', 'Bukti transfer diterima untuk pemeriksaan admin'
           WHERE EXISTS (SELECT 1 FROM payments WHERE id = ?3 AND proof_file_id = ?4 AND updated_at = ?5)`,
      ).bind(crypto.randomUUID(), payment.order_id, payment.payment_id, storedFile.fileId, uploadedAt),
    ]);
    if (update[0]?.meta?.changes !== 1 || update[1]?.meta?.changes !== 1) {
      await deleteImageKitFile(storedFile.fileId, env);
      return jsonResponse({ error: "proof_conflict", message: "Status pesanan berubah. Hubungi admin untuk memastikan bukti diterima." }, 409, headers);
    }
    return jsonResponse({ data: { payment_reference: paymentReference, payment_status: "pending", proof_received: true }, message: "Bukti transfer tersimpan. Admin akan memeriksanya." }, 201, headers);
  } catch (error) {
    if (error.status === 400) return jsonResponse({ error: "validation_error", message: error.message }, 400, headers);
    if (error.status === 503) return jsonResponse({ error: "proof_storage_not_configured", message: error.message }, 503, headers);
    if (error.status === 502) return jsonResponse({ error: "imagekit_error", message: error.message }, 502, headers);
    logDatabaseError("submit_payment_proof", error);
    return jsonResponse({ error: "internal_server_error", message: "Bukti belum berhasil dikirim. Coba lagi." }, 500, headers);
  }
}

function constantTimeEquals(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

function adminAuthError(request, env, headers) {
  if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 32) {
    return jsonResponse({ error: "admin_auth_not_configured", message: "Akses admin belum dikonfigurasi." }, 503, headers);
  }
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!constantTimeEquals(token, env.ADMIN_TOKEN)) {
    return jsonResponse({ error: "unauthorized", message: "Akses admin diperlukan." }, 401, headers);
  }
  return null;
}

function rateLimitPolicy(pathname, method) {
  if (pathname.startsWith("/api/admin/")) return "ADMIN_RATE_LIMITER";
  if ((pathname === "/api/orders" || pathname === "/api/orders/proof") && method === "POST") return "ORDER_RATE_LIMITER";
  if ((pathname === "/api/orders/status" || pathname === "/api/orders/cancellation") && method === "POST") return "STATUS_RATE_LIMITER";
  if ((pathname === "/api/shipping/destinations" && method === "GET")
      || (pathname === "/api/shipping/quotes" && method === "POST")) return "SHIPPING_RATE_LIMITER";
  return null;
}

async function enforceRateLimit(request, env, pathname) {
  const bindingName = rateLimitPolicy(pathname, request.method);
  if (!bindingName) return null;
  const limiter = env[bindingName];
  const ipAddress = request.headers.get("cf-connecting-ip");
  if (!limiter || !ipAddress) {
    if (env.APP_ENV === "production") {
      return jsonResponse({ error: "rate_limit_not_configured", message: "Perlindungan request belum tersedia." }, 503);
    }
    return null;
  }
  try {
    const { success } = await limiter.limit({ key: `${ipAddress}:${pathname}` });
    if (!success) {
      return jsonResponse({ error: "rate_limited", message: "Terlalu banyak permintaan. Coba lagi sebentar." }, 429, { "retry-after": "60" });
    }
  } catch (error) {
    logOperationalError("rate_limit_check", error);
    if (env.APP_ENV === "production") {
      return jsonResponse({ error: "rate_limit_unavailable", message: "Layanan sementara tidak tersedia." }, 503);
    }
  }
  return null;
}

function validPaymentReference(value) {
  return typeof value === "string" && /^RUMA-[A-Z0-9]{16}$/.test(value);
}

async function listAdminPayments(request, env, headers) {
  const authError = adminAuthError(request, env, headers);
  if (authError) return authError;
  const status = new URL(request.url).searchParams.get("status") ?? "pending";
  if (!["pending", "paid", "failed", "refunded"].includes(status)) {
    return jsonResponse({ error: "invalid_status", message: "Status pembayaran tidak valid." }, 400, headers);
  }
  try {
    const { results } = await env.DB.prepare(
      `SELECT o.public_code AS order_code, p.payment_reference, p.payment_status,
              p.amount, p.currency, p.proof_uploaded_at, o.customer_name,
              o.customer_phone, o.subtotal_amount, o.shipping_amount,
              o.shipping_courier_name, o.shipping_service, o.shipping_distance_km,
              o.payment_expires_at,
              o.created_at
       FROM payments AS p JOIN orders AS o ON o.id = p.order_id
       WHERE p.payment_status = ?1
       ORDER BY CASE WHEN p.proof_file_id IS NOT NULL THEN 0 ELSE 1 END,
                p.proof_uploaded_at ASC, p.created_at ASC LIMIT 100`,
    ).bind(status).all();
    return jsonResponse({ data: results.map((row) => ({
      ...row,
      has_proof: Boolean(row.proof_uploaded_at),
    })) }, 200, { ...headers, "cache-control": "no-store" });
  } catch (error) {
    logDatabaseError("list_admin_payments", error);
    return jsonResponse({ error: "internal_server_error" }, 500, headers);
  }
}

async function requestOrderRefund(request, env, headers) {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return jsonResponse({ error: "content_type_required", message: "Kirim data sebagai JSON." }, 415, headers);
  }
  try {
    const body = await readBoundedJson(request);
    const orderCode = boundedText(body?.order_code, "Kode pesanan", 21, 21).toUpperCase();
    const phone = boundedText(body?.phone, "Nomor telepon", 8, 24).replace(/\D/g, "");
    const note = boundedText(body?.note ?? "", "Catatan", 0, 300, false);
    if (!validOrderCode(orderCode) || phone.length < 8) throw inputError("Kode pesanan atau nomor telepon tidak valid.");
    const order = await env.DB.prepare(
      `SELECT o.id, o.customer_phone, o.order_status, o.production_status,
              p.payment_status,
              r.id AS refund_id, r.status AS refund_status
       FROM orders AS o
       LEFT JOIN payments AS p ON p.id = (
         SELECT p2.id FROM payments AS p2 WHERE p2.order_id = o.id ORDER BY p2.created_at DESC LIMIT 1
       )
       LEFT JOIN refund_requests AS r ON r.order_id = o.id
       WHERE o.public_code = ?1 LIMIT 1`,
    ).bind(orderCode).first();
    if (!order || !constantTimeEquals(phone, String(order.customer_phone ?? "").replace(/\D/g, ""))) {
      return jsonResponse({ error: "order_not_found", message: "Pesanan tidak ditemukan. Periksa kode dan nomor telepon." }, 404, headers);
    }
    if (order.production_status !== "pending") {
      return jsonResponse({ error: "refund_unavailable", message: "Produksi sudah dimulai. Hubungi admin melalui chat untuk koordinasi." }, 409, headers);
    }
    if (order.payment_status !== "paid" || !["new", "accepted"].includes(order.order_status)) {
      return jsonResponse({ error: "refund_unavailable", message: "Permintaan refund hanya tersedia untuk pesanan lunas yang belum mulai diproduksi." }, 409, headers);
    }
    if (order.refund_id) {
      return jsonResponse({ data: { status: order.refund_status }, message: "Permintaan pembatalan/refund sudah tercatat." }, 200, { ...headers, "cache-control": "no-store" });
    }
    const now = new Date().toISOString();
    const refundId = crypto.randomUUID();
    const result = await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO refund_requests (id, order_id, status, customer_note, requested_at, created_at, updated_at)
         SELECT ?1, ?2, 'requested', ?3, ?4, ?4, ?4
         WHERE EXISTS (
           SELECT 1 FROM orders o JOIN payments p ON p.order_id = o.id
           WHERE o.id = ?2 AND o.order_status IN ('new', 'accepted')
             AND o.production_status = 'pending' AND p.payment_status = 'paid'
         )`,
      ).bind(refundId, order.id, note, now),
      env.DB.prepare(
        `INSERT INTO order_status_history (id, order_id, status_type, previous_status, new_status, actor_type, note)
         SELECT ?1, ?2, 'payment', 'paid', 'refund_requested', 'customer', 'Pelanggan meminta pembatalan dan refund'
         WHERE EXISTS (SELECT 1 FROM refund_requests WHERE id = ?3 AND status = 'requested')`,
      ).bind(crypto.randomUUID(), order.id, refundId),
    ]);
    if (result[0]?.meta?.changes !== 1 || result[1]?.meta?.changes !== 1) {
      return jsonResponse({ error: "refund_request_conflict", message: "Status pesanan berubah. Muat ulang status pesanan." }, 409, headers);
    }
    return jsonResponse({ data: { status: "requested" }, message: "Permintaan refund diterima dan dikirim ke admin." }, 201, { ...headers, "cache-control": "no-store" });
  } catch (error) {
    if (error.status === 400) return jsonResponse({ error: "validation_error", message: error.message }, 400, headers);
    logDatabaseError("request_order_refund", error);
    return jsonResponse({ error: "internal_server_error", message: "Permintaan belum berhasil. Coba lagi." }, 500, headers);
  }
}

async function listAdminRefunds(request, env, headers) {
  const authError = adminAuthError(request, env, headers);
  if (authError) return authError;
  const status = new URL(request.url).searchParams.get("status") ?? "requested";
  if (!["requested", "approved", "processed"].includes(status)) {
    return jsonResponse({ error: "invalid_status", message: "Status refund tidak valid." }, 400, headers);
  }
  try {
    const { results } = await env.DB.prepare(
      `SELECT r.id AS refund_id, r.status AS refund_status, r.customer_note,
              r.admin_note, r.requested_at, r.approved_at, r.refund_due_at, r.processed_at,
              o.public_code AS order_code, o.customer_name, o.customer_phone,
              o.order_status, o.production_status, p.amount, p.currency, p.payment_status
       FROM refund_requests r
       JOIN orders o ON o.id = r.order_id
       JOIN payments p ON p.order_id = o.id
       WHERE r.status = ?1 ORDER BY r.requested_at ASC LIMIT 100`,
    ).bind(status).all();
    return jsonResponse({ data: results }, 200, { ...headers, "cache-control": "no-store" });
  } catch (error) {
    logDatabaseError("list_admin_refunds", error);
    return jsonResponse({ error: "internal_server_error" }, 500, headers);
  }
}

async function updateAdminRefund(request, env, headers, refundId, action) {
  const authError = adminAuthError(request, env, headers);
  if (authError) return authError;
  if (!/^[0-9a-f-]{36}$/i.test(refundId)) return jsonResponse({ error: "not_found" }, 404, headers);
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return jsonResponse({ error: "content_type_required", message: "Kirim data sebagai JSON." }, 415, headers);
  }
  try {
    const body = await readBoundedJson(request);
    const note = boundedText(body?.note ?? "", "Catatan admin", 0, 300, false);
    if (action === "process" && body?.transfer_confirmed !== true) {
      return jsonResponse({ error: "refund_transfer_not_confirmed", message: "Konfirmasikan bahwa transfer ke rekening asal sudah dilakukan sebelum menandai refund selesai." }, 400, headers);
    }
    const current = await env.DB.prepare(
      `SELECT r.id, r.order_id, r.status, o.public_code, o.order_status, o.production_status,
              p.id AS payment_id, p.payment_status
       FROM refund_requests r JOIN orders o ON o.id = r.order_id
       JOIN payments p ON p.order_id = o.id
       WHERE r.id = ?1 LIMIT 1`,
    ).bind(refundId).first();
    if (!current) return jsonResponse({ error: "not_found" }, 404, headers);
    if (current.production_status !== "pending") {
      return jsonResponse({ error: "production_started", message: "Produksi sudah dimulai; koordinasikan melalui chat." }, 409, headers);
    }
    const now = new Date().toISOString();
    if (action === "approve") {
      if (current.status !== "requested" || current.payment_status !== "paid") {
        return jsonResponse({ error: "refund_not_approvable", message: "Permintaan refund tidak lagi menunggu persetujuan." }, 409, headers);
      }
      const dueAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
      const result = await env.DB.batch([
        env.DB.prepare(
          `UPDATE refund_requests SET status = 'approved', admin_note = ?1,
             approved_at = ?2, refund_due_at = ?3, updated_at = ?2
           WHERE id = ?4 AND status = 'requested'
             AND EXISTS (SELECT 1 FROM orders WHERE id = ?5 AND production_status = 'pending')`,
        ).bind(note, now, dueAt, refundId, current.order_id),
        env.DB.prepare(
          `INSERT INTO order_status_history (id, order_id, status_type, previous_status, new_status, actor_type, note)
           SELECT ?1, ?2, 'payment', 'refund_requested', 'refund_approved', 'admin', ?3
           WHERE EXISTS (SELECT 1 FROM refund_requests WHERE id = ?4 AND status = 'approved' AND approved_at = ?5)`,
        ).bind(crypto.randomUUID(), current.order_id, note || "Refund disetujui; target penyelesaian 72 jam", refundId, now),
      ]);
      if (result[0]?.meta?.changes !== 1 || result[1]?.meta?.changes !== 1) {
        return jsonResponse({ error: "refund_changed", message: "Permintaan refund berubah. Muat ulang daftar." }, 409, headers);
      }
      return jsonResponse({ data: { refund_id: refundId, status: "approved", refund_due_at: dueAt }, message: "Refund disetujui. Kirim dana ke rekening asal paling lambat dalam 72 jam, lalu tandai selesai." }, 200, { ...headers, "cache-control": "no-store" });
    }
    if (action !== "process" || current.status !== "approved" || current.payment_status !== "paid") {
      return jsonResponse({ error: "refund_not_processable", message: "Refund harus disetujui sebelum ditandai selesai." }, 409, headers);
    }
    const result = await env.DB.batch([
      env.DB.prepare(
        `UPDATE refund_requests SET status = 'processed', admin_note = ?1,
           processed_at = ?2, updated_at = ?2
         WHERE id = ?3 AND status = 'approved'
           AND EXISTS (
             SELECT 1 FROM orders o JOIN payments p ON p.order_id = o.id
             WHERE o.id = ?4 AND o.production_status = 'pending'
               AND o.order_status IN ('new', 'accepted') AND p.payment_status = 'paid'
           )`,
      ).bind(note || "Admin mengonfirmasi transfer refund ke rekening asal", now, refundId, current.order_id),
      env.DB.prepare(
        `UPDATE payments SET payment_status = 'refunded', updated_at = ?1
         WHERE id = ?2 AND payment_status = 'paid'
           AND EXISTS (SELECT 1 FROM refund_requests WHERE id = ?3 AND status = 'processed' AND processed_at = ?1)`,
      ).bind(now, current.payment_id, refundId),
      env.DB.prepare(
        `UPDATE orders SET order_status = 'cancelled', updated_at = ?1
         WHERE id = ?2 AND order_status IN ('new', 'accepted') AND production_status = 'pending'
           AND EXISTS (SELECT 1 FROM refund_requests WHERE id = ?3 AND status = 'processed' AND processed_at = ?1)`,
      ).bind(now, current.order_id, refundId),
      env.DB.prepare(
        `INSERT INTO order_status_history (id, order_id, status_type, previous_status, new_status, actor_type, note)
         SELECT ?1, ?2, 'payment', 'paid', 'refunded', 'admin', ?3
         WHERE EXISTS (SELECT 1 FROM payments WHERE id = ?4 AND payment_status = 'refunded' AND updated_at = ?5)`,
      ).bind(crypto.randomUUID(), current.order_id, note || "Refund dikirim ke rekening asal", current.payment_id, now),
      env.DB.prepare(
        `INSERT INTO order_status_history (id, order_id, status_type, previous_status, new_status, actor_type, note)
         SELECT ?1, ?2, 'order', ?3, 'cancelled', 'admin', 'Pembatalan selesai setelah refund dikirim'
         WHERE EXISTS (SELECT 1 FROM orders WHERE id = ?2 AND order_status = 'cancelled' AND updated_at = ?4)`,
      ).bind(crypto.randomUUID(), current.order_id, current.order_status, now),
    ]);
    if (result.some((entry) => entry?.meta?.changes !== 1)) {
      return jsonResponse({ error: "refund_changed", message: "Status berubah saat refund diproses. Periksa ulang pesanan dan mutasi bank." }, 409, headers);
    }
    return jsonResponse({ data: { refund_id: refundId, status: "processed", order_status: "cancelled", payment_status: "refunded" }, message: "Refund dicatat selesai dan status pesanan diperbarui." }, 200, { ...headers, "cache-control": "no-store" });
  } catch (error) {
    if (error.status === 400) return jsonResponse({ error: "validation_error", message: error.message }, 400, headers);
    logDatabaseError("update_admin_refund", error);
    return jsonResponse({ error: "internal_server_error" }, 500, headers);
  }
}

function validOrderCode(value) {
  return typeof value === "string" && /^RUMA-[A-Z0-9]{16}$/.test(value);
}

async function listAdminOrders(request, env, headers) {
  const authError = adminAuthError(request, env, headers);
  if (authError) return authError;
  const url = new URL(request.url);
  const orderStatus = url.searchParams.get("order_status") ?? "";
  const paymentStatus = url.searchParams.get("payment_status") ?? "";
  const query = url.searchParams.get("q")?.trim() ?? "";
  if (orderStatus && !["new", "accepted", "completed", "cancelled"].includes(orderStatus)) {
    return jsonResponse({ error: "invalid_order_status", message: "Filter status pesanan tidak valid." }, 400, headers);
  }
  if (paymentStatus && !["pending", "paid", "failed", "refunded"].includes(paymentStatus)) {
    return jsonResponse({ error: "invalid_payment_status", message: "Filter status pembayaran tidak valid." }, 400, headers);
  }
  if (query.length > 80) return jsonResponse({ error: "invalid_query", message: "Pencarian maksimal 80 karakter." }, 400, headers);
  const clauses = [];
  const bindings = [];
  if (orderStatus) { bindings.push(orderStatus); clauses.push(`o.order_status = ?${bindings.length}`); }
  if (paymentStatus) { bindings.push(paymentStatus); clauses.push(`p.payment_status = ?${bindings.length}`); }
  if (query) {
    bindings.push(`%${query}%`);
    clauses.push(`(o.public_code LIKE ?${bindings.length} OR o.customer_name LIKE ?${bindings.length})`);
  }
  bindings.push(parseLimit(url));
  try {
    const { results } = await env.DB.prepare(
      `SELECT o.public_code AS order_code, o.customer_name, o.total_amount, o.currency,
              o.order_status, o.production_status, o.created_at, o.payment_expires_at,
              p.payment_reference, p.payment_status, p.proof_uploaded_at,
              CASE WHEN p.proof_file_id IS NULL THEN 0 ELSE 1 END AS has_payment_proof
       FROM orders AS o
       LEFT JOIN payments AS p ON p.id = (
         SELECT p2.id FROM payments AS p2 WHERE p2.order_id = o.id ORDER BY p2.created_at DESC LIMIT 1
       )
       ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
       ORDER BY CASE WHEN p.payment_status = 'pending' AND p.proof_file_id IS NOT NULL THEN 0 ELSE 1 END,
                CASE WHEN p.payment_status = 'pending' AND p.proof_file_id IS NOT NULL THEN p.proof_uploaded_at END ASC,
                o.created_at DESC LIMIT ?${bindings.length}`,
    ).bind(...bindings).all();
    return jsonResponse({ data: results.map((row) => ({ ...row, has_payment_proof: Boolean(row.has_payment_proof) })) }, 200, { ...headers, "cache-control": "no-store" });
  } catch (error) {
    logDatabaseError("list_admin_orders", error);
    return jsonResponse({ error: "internal_server_error" }, 500, headers);
  }
}

async function getAdminOrder(request, env, headers, orderCode) {
  const authError = adminAuthError(request, env, headers);
  if (authError) return authError;
  if (!validOrderCode(orderCode)) return jsonResponse({ error: "not_found" }, 404, headers);
  try {
    const order = await env.DB.prepare(
      `SELECT o.id, o.public_code AS order_code, o.customer_name, o.customer_phone,
              o.customer_email, o.shipping_address, o.customer_note,
              o.subtotal_amount, o.shipping_amount, o.total_amount, o.currency,
              o.order_status, o.production_status, o.shipping_destination_label,
              o.shipping_courier_name, o.shipping_service, o.shipping_distance_km, o.created_at,
              o.payment_expires_at,
              p.payment_reference, p.payment_status, p.amount AS payment_amount,
              p.proof_uploaded_at,
              CASE WHEN p.proof_file_id IS NULL THEN 0 ELSE 1 END AS has_payment_proof,
              s.carrier, s.tracking_number, s.tracking_url, s.shipment_status,
              s.shipped_at, s.delivered_at
       FROM orders AS o
       LEFT JOIN payments AS p ON p.id = (
         SELECT p2.id FROM payments AS p2 WHERE p2.order_id = o.id ORDER BY p2.created_at DESC LIMIT 1
       )
       LEFT JOIN shipments AS s ON s.id = (
         SELECT s2.id FROM shipments AS s2 WHERE s2.order_id = o.id ORDER BY s2.created_at DESC LIMIT 1
       )
       WHERE o.public_code = ?1 LIMIT 1`,
    ).bind(orderCode).first();
    if (!order) return jsonResponse({ error: "not_found" }, 404, headers);
    const [itemResult, historyResult, productionFileResult] = await Promise.all([
      env.DB.prepare(
        `SELECT oi.id, oi.product_name_snapshot AS name, oi.product_slug_snapshot AS slug,
                oi.unit_price_amount, oi.quantity, oi.line_total_amount,
                oi.fixed_size_snapshot, oc.values_json AS customization_json,
                oc.template_version_snapshot, oc.field_snapshot_json
         FROM order_items AS oi
         LEFT JOIN order_customizations AS oc ON oc.order_item_id = oi.id
         WHERE oi.order_id = ?1 ORDER BY oi.created_at ASC`,
      ).bind(order.id).all(),
      env.DB.prepare(
        `SELECT status_type, previous_status, new_status, actor_type, note, created_at
         FROM order_status_history WHERE order_id = ?1 ORDER BY created_at DESC LIMIT 100`,
      ).bind(order.id).all(),
      env.DB.prepare(
        `SELECT id, order_item_id, version, format, file_name, mime_type,
                template_version_snapshot, created_at
         FROM order_production_files WHERE order_id = ?1 ORDER BY created_at DESC LIMIT 100`,
      ).bind(order.id).all(),
    ]);
    const items = itemResult.results.map((item) => {
      let customization = {};
      try { customization = JSON.parse(item.customization_json || "{}"); } catch { /* Keep a valid empty view. */ }
      let fieldSnapshot = [];
      try { fieldSnapshot = JSON.parse(item.field_snapshot_json || "[]"); } catch { /* Keep a valid empty view. */ }
      const { customization_json, field_snapshot_json, ...safeItem } = item;
      return {
        ...safeItem,
        customization,
        field_snapshot: fieldSnapshot,
        production_files: productionFileResult.results.filter((file) => file.order_item_id === item.id),
      };
    });
    const { id, ...safeOrder } = order;
    return jsonResponse({ data: { ...safeOrder, has_payment_proof: Boolean(order.has_payment_proof), items, history: historyResult.results } }, 200, { ...headers, "cache-control": "no-store" });
  } catch (error) {
    logDatabaseError("get_admin_order", error);
    return jsonResponse({ error: "internal_server_error" }, 500, headers);
  }
}

async function createAdminProductionFile(request, env, headers, orderCode, itemId) {
  const authError = adminAuthError(request, env, headers);
  if (authError) return authError;
  if (!validOrderCode(orderCode) || !/^[0-9a-f-]{36}$/i.test(itemId)) return jsonResponse({ error: "not_found" }, 404, headers);
  try {
    const item = await env.DB.prepare(
      `SELECT o.id AS order_id, o.order_status, p.payment_status,
              oi.id AS item_id, oi.product_name_snapshot, oi.product_slug_snapshot,
              oi.fixed_size_snapshot, oc.template_version_snapshot,
              oc.values_json, oc.field_snapshot_json
       FROM orders AS o JOIN order_items AS oi ON oi.order_id = o.id
       LEFT JOIN payments AS p ON p.id = (
         SELECT p2.id FROM payments AS p2 WHERE p2.order_id = o.id ORDER BY p2.created_at DESC LIMIT 1
       )
       LEFT JOIN order_customizations AS oc ON oc.order_item_id = oi.id
       WHERE o.public_code = ?1 AND oi.id = ?2 LIMIT 1`,
    ).bind(orderCode, itemId).first();
    if (!item) return jsonResponse({ error: "not_found" }, 404, headers);
    if (item.payment_status !== "paid" || item.order_status !== "accepted") {
      return jsonResponse({ error: "order_not_ready_for_production_file", message: "File desain tersedia setelah pembayaran lunas dan pesanan diterima." }, 409, headers);
    }
    const dimensions = parsePlateSize(item.fixed_size_snapshot);
    const values = JSON.parse(item.values_json || "{}");
    const fieldSnapshot = JSON.parse(item.field_snapshot_json || "[]");
    const content = createDxf({ ...dimensions, productName: item.product_name_snapshot, values, fieldSnapshot });
    if (content.length > 262144) throw inputError("File DXF melebihi batas ukuran.");
    const fileId = crypto.randomUUID();
    const insert = await env.DB.prepare(
      `INSERT INTO order_production_files (
         id, order_id, order_item_id, version, format, file_name, mime_type,
         content_text, template_version_snapshot, customization_snapshot_json
       ) SELECT ?1, o.id, oi.id,
                COALESCE((SELECT MAX(version) FROM order_production_files WHERE order_item_id = oi.id), 0) + 1,
                'dxf',
                oi.product_slug_snapshot || '-' || lower(o.public_code) || '-v' ||
                  (COALESCE((SELECT MAX(version) FROM order_production_files WHERE order_item_id = oi.id), 0) + 1) || '.dxf',
                'application/dxf', ?2, oc.template_version_snapshot, COALESCE(oc.values_json, '{}')
         FROM orders AS o JOIN order_items AS oi ON oi.order_id = o.id
         LEFT JOIN order_customizations AS oc ON oc.order_item_id = oi.id
         JOIN payments AS p ON p.order_id = o.id
         WHERE o.id = ?3 AND o.public_code = ?4 AND oi.id = ?5
           AND o.order_status = 'accepted' AND p.payment_status = 'paid'`,
    ).bind(fileId, content, item.order_id, orderCode, itemId).run();
    if (insert.meta?.changes !== 1) return jsonResponse({ error: "order_changed", message: "Status pesanan berubah; muat ulang sebelum membuat DXF." }, 409, headers);
    const file = await env.DB.prepare(
      `SELECT id, order_item_id, version, format, file_name, mime_type,
              template_version_snapshot, created_at
       FROM order_production_files WHERE id = ?1 LIMIT 1`,
    ).bind(fileId).first();
    return jsonResponse({ data: { ...file, content }, message: "Gambar DXF dibuat dan ditautkan ke item pesanan." }, 201, { ...headers, "cache-control": "no-store" });
  } catch (error) {
    if (error.status === 400) return jsonResponse({ error: "validation_error", message: error.message }, 400, headers);
    if (error.message?.startsWith("Ukuran")) return jsonResponse({ error: "unsupported_product_size", message: error.message }, 409, headers);
    logDatabaseError("create_admin_production_file", error);
    return jsonResponse({ error: "internal_server_error", message: "File produksi belum dapat dibuat." }, 500, headers);
  }
}

async function getAdminProductionFile(request, env, headers, orderCode, fileId) {
  const authError = adminAuthError(request, env, headers);
  if (authError) return authError;
  if (!validOrderCode(orderCode) || !/^[0-9a-f-]{36}$/i.test(fileId)) return jsonResponse({ error: "not_found" }, 404, headers);
  try {
    const file = await env.DB.prepare(
      `SELECT f.file_name, f.mime_type, f.content_text
       FROM order_production_files AS f JOIN orders AS o ON o.id = f.order_id
       WHERE o.public_code = ?1 AND f.id = ?2 LIMIT 1`,
    ).bind(orderCode, fileId).first();
    if (!file) return jsonResponse({ error: "not_found" }, 404, headers);
    return new Response(file.content_text, { status: 200, headers: {
      ...headers,
      "content-type": `${file.mime_type}; charset=utf-8`,
      "content-disposition": `attachment; filename="${file.file_name}"`,
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
      "x-frame-options": "DENY",
      "x-content-type-options": "nosniff",
    } });
  } catch (error) {
    logDatabaseError("get_admin_production_file", error);
    return jsonResponse({ error: "internal_server_error" }, 500, headers);
  }
}

async function updateAdminShipment(request, env, headers, orderCode) {
  const authError = adminAuthError(request, env, headers);
  if (authError) return authError;
  if (!validOrderCode(orderCode)) return jsonResponse({ error: "not_found" }, 404, headers);
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return jsonResponse({ error: "content_type_required", message: "Kirim data sebagai JSON." }, 415, headers);
  }
  try {
    const body = await readBoundedJson(request);
    const carrier = boundedText(body?.carrier, "Nama kurir", 2, 60);
    const trackingNumber = boundedText(body?.tracking_number, "Nomor resi", 4, 100);
    const trackingUrl = boundedText(body?.tracking_url ?? "", "URL tracking", 0, 500, false);
    const nextStatus = boundedText(body?.status, "Status pengiriman", 1, 24);
    const note = boundedText(body?.note ?? "", "Catatan", 0, 300, false);
    if (trackingUrl) {
      let parsed;
      try { parsed = new URL(trackingUrl); } catch { throw inputError("URL tracking tidak valid."); }
      if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw inputError("URL tracking harus memakai HTTPS.");
    }
    if (!["shipped", "delivered", "failed", "returned"].includes(nextStatus)) throw inputError("Status pengiriman tidak valid.");

    const order = await env.DB.prepare(
      `SELECT o.id, o.order_status, o.production_status, p.payment_status
       FROM orders AS o LEFT JOIN payments AS p ON p.id = (
         SELECT p2.id FROM payments AS p2 WHERE p2.order_id = o.id ORDER BY p2.created_at DESC LIMIT 1
       ) WHERE o.public_code = ?1 LIMIT 1`,
    ).bind(orderCode).first();
    if (!order) return jsonResponse({ error: "not_found" }, 404, headers);
    if (order.payment_status !== "paid" || order.order_status !== "accepted" || order.production_status !== "completed") {
      return jsonResponse({ error: "order_not_ready_to_ship", message: "Pesanan harus lunas, diterima, dan produksinya selesai sebelum dikirim." }, 409, headers);
    }

    const existing = await env.DB.prepare(
      `SELECT id, shipment_status FROM shipments WHERE order_id = ?1 ORDER BY created_at DESC LIMIT 1`,
    ).bind(order.id).first();
    const transitionMap = {
      pending: ["shipped"],
      shipped: ["delivered", "failed", "returned"],
      failed: ["shipped"],
      returned: ["shipped"],
      delivered: [],
    };
    const previousStatus = existing?.shipment_status ?? "pending";
    if (!transitionMap[previousStatus]?.includes(nextStatus)) {
      return jsonResponse({ error: "invalid_shipment_transition", message: `Status ${previousStatus} tidak dapat diubah menjadi ${nextStatus}.` }, 409, headers);
    }

    const changedAt = new Date().toISOString();
    const shipmentId = existing?.id ?? crypto.randomUUID();
    const shipmentStatement = existing
      ? env.DB.prepare(
        `UPDATE shipments SET carrier = ?1, tracking_number = ?2, tracking_url = ?3,
           shipment_status = ?4,
           shipped_at = CASE WHEN ?4 = 'shipped' THEN ?5 ELSE shipped_at END,
           delivered_at = CASE WHEN ?4 = 'delivered' THEN ?5 ELSE delivered_at END,
           updated_at = ?5
         WHERE id = ?6 AND shipment_status = ?7`,
      ).bind(carrier, trackingNumber, trackingUrl, nextStatus, changedAt, shipmentId, previousStatus)
      : env.DB.prepare(
        `INSERT INTO shipments (id, order_id, carrier, tracking_number, tracking_url, shipment_status, shipped_at, delivered_at, created_at, updated_at)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?7, ?7
         WHERE NOT EXISTS (SELECT 1 FROM shipments WHERE order_id = ?2)`,
      ).bind(shipmentId, order.id, carrier, trackingNumber, trackingUrl, nextStatus, changedAt, nextStatus === "delivered" ? changedAt : null);
    const historyStatement = env.DB.prepare(
      `INSERT INTO order_status_history (
         id, order_id, status_type, previous_status, new_status, actor_type, note
       ) SELECT ?1, ?2, 'shipment', ?3, ?4, 'admin', ?5
         WHERE EXISTS (SELECT 1 FROM shipments WHERE id = ?6 AND shipment_status = ?4 AND updated_at = ?7)`,
    ).bind(
      crypto.randomUUID(), order.id, previousStatus, nextStatus,
      note || `${carrier} · resi ${trackingNumber}`, shipmentId, changedAt,
    );
    const result = await env.DB.batch([shipmentStatement, historyStatement]);
    if (result[0]?.meta?.changes !== 1 || result[1]?.meta?.changes !== 1) {
      return jsonResponse({ error: "shipment_changed", message: "Data pengiriman berubah. Muat ulang pesanan." }, 409, headers);
    }
    return jsonResponse({ data: { order_code: orderCode, shipment_status: nextStatus }, message: "Data pengiriman diperbarui." }, 200, { ...headers, "cache-control": "no-store" });
  } catch (error) {
    if (error.status === 400) return jsonResponse({ error: "validation_error", message: error.message }, 400, headers);
    logDatabaseError("update_admin_shipment", error);
    return jsonResponse({ error: "internal_server_error" }, 500, headers);
  }
}

async function getPublicOrderStatus(request, env, headers) {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return jsonResponse({ error: "content_type_required", message: "Kirim data sebagai JSON." }, 415, headers);
  }
  try {
    const body = await readBoundedJson(request);
    const orderCode = boundedText(body?.order_code, "Kode pesanan", 21, 21).toUpperCase();
    const phone = boundedText(body?.phone, "Nomor telepon", 8, 24).replace(/\D/g, "");
    if (!validOrderCode(orderCode) || phone.length < 8) throw inputError("Kode pesanan atau nomor telepon tidak valid.");
    const order = await env.DB.prepare(
      `SELECT o.id, o.public_code, o.customer_phone, o.order_status, o.production_status,
              o.payment_expires_at, p.payment_status, p.proof_uploaded_at,
              r.status AS refund_status, r.requested_at AS refund_requested_at,
              r.approved_at AS refund_approved_at, r.refund_due_at,
              r.processed_at AS refund_processed_at,
              s.carrier, s.tracking_number, s.tracking_url, s.shipment_status,
              s.shipped_at, s.delivered_at
       FROM orders AS o
       LEFT JOIN payments AS p ON p.id = (
         SELECT p2.id FROM payments AS p2 WHERE p2.order_id = o.id ORDER BY p2.created_at DESC LIMIT 1
       )
       LEFT JOIN refund_requests AS r ON r.order_id = o.id
       LEFT JOIN shipments AS s ON s.id = (
         SELECT s2.id FROM shipments AS s2 WHERE s2.order_id = o.id ORDER BY s2.created_at DESC LIMIT 1
       )
       WHERE o.public_code = ?1 LIMIT 1`,
    ).bind(orderCode).first();
    const savedPhone = String(order?.customer_phone ?? "").replace(/\D/g, "");
    if (!order || !constantTimeEquals(phone, savedPhone)) {
      return jsonResponse({ error: "order_not_found", message: "Pesanan tidak ditemukan. Periksa kode dan nomor telepon." }, 404, headers);
    }
    const history = await env.DB.prepare(
      `SELECT status_type, new_status, created_at FROM order_status_history
       WHERE order_id = ?1 AND status_type IN ('order', 'payment', 'production', 'shipment')
       ORDER BY created_at ASC LIMIT 50`,
    ).bind(order.id).all();
    const { id, customer_phone, ...safeOrder } = order;
    const paymentExpired = order.payment_status === "pending"
      && !order.proof_uploaded_at
      && (!order.payment_expires_at || Date.parse(order.payment_expires_at) <= Date.now());
    const canRequestRefund = order.payment_status === "paid"
      && order.production_status === "pending"
      && ["new", "accepted"].includes(order.order_status)
      && !order.refund_status;
    return jsonResponse({ data: {
      ...safeOrder,
      has_payment_proof: Boolean(order.proof_uploaded_at),
      payment_expired: paymentExpired,
      refund_status: order.refund_status ?? null,
      can_request_refund: canRequestRefund,
      history: history.results,
    } }, 200, { ...headers, "cache-control": "no-store", "referrer-policy": "no-referrer" });
  } catch (error) {
    if (error.status === 400) return jsonResponse({ error: "validation_error", message: error.message }, 400, headers);
    logDatabaseError("get_public_order_status", error);
    return jsonResponse({ error: "internal_server_error", message: "Status belum dapat dimuat. Coba lagi." }, 500, headers);
  }
}

async function registerAdminDevice(request, env, headers, remove = false) {
  const authError = adminAuthError(request, env, headers);
  if (authError) return authError;
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return jsonResponse({ error: "content_type_required", message: "Kirim data sebagai JSON." }, 415, headers);
  }
  try {
    const body = await readBoundedJson(request);
    const token = boundedText(body?.registration_token, "Token perangkat", 20, 4096);
    if (!/^[A-Za-z0-9_:\-.]+$/.test(token)) throw inputError("Token perangkat tidak valid.");
    if (remove) {
      await env.DB.prepare(`DELETE FROM admin_devices WHERE registration_token = ?1`).bind(token).run();
    } else {
      const now = new Date().toISOString();
      const label = boundedText(body?.label ?? "Ruma Admin", "Nama perangkat", 1, 60);
      await env.DB.prepare(
        `INSERT INTO admin_devices (id, registration_token, label, created_at, updated_at, last_seen_at)
         VALUES (?1, ?2, ?3, ?4, ?4, ?4)
         ON CONFLICT(registration_token) DO UPDATE SET label = excluded.label, updated_at = excluded.updated_at, last_seen_at = excluded.last_seen_at`,
      ).bind(crypto.randomUUID(), token, label, now).run();
    }
    return jsonResponse({ data: { registered: !remove }, message: remove ? "Perangkat notifikasi dilepas." : "Perangkat notifikasi terdaftar." }, 200, { ...headers, "cache-control": "no-store" });
  } catch (error) {
    if (error.status === 400) return jsonResponse({ error: "validation_error", message: error.message }, 400, headers);
    logDatabaseError(remove ? "remove_admin_device" : "register_admin_device", error);
    return jsonResponse({ error: "internal_server_error" }, 500, headers);
  }
}

function base64Url(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function getFcmAccessToken(env) {
  if (cachedFcmAccessToken && Date.now() < cachedFcmTokenExpiresAt - 60_000) return cachedFcmAccessToken;
  const email = env.FCM_SERVICE_ACCOUNT_EMAIL;
  const privateKeyPem = env.FCM_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !privateKeyPem) throw new Error("FCM credentials are missing");
  const keyBytes = Uint8Array.from(atob(privateKeyPem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "")), (char) => char.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", keyBytes, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const now = Math.floor(Date.now() / 1000);
  const claim = { iss: email, scope: fcmMessagingScope, aud: fcmTokenUrl, iat: now, exp: now + 3600 };
  const unsigned = `${base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64Url(JSON.stringify(claim))}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const assertion = `${unsigned}.${base64Url(new Uint8Array(signature))}`;
  const response = await fetch(fcmTokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    signal: AbortSignal.timeout(10_000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || typeof result?.access_token !== "string") throw new Error(`FCM OAuth failed (${response.status})`);
  cachedFcmAccessToken = result.access_token;
  cachedFcmTokenExpiresAt = Date.now() + Math.min(Number(result.expires_in) || 3600, 3600) * 1000;
  return cachedFcmAccessToken;
}

async function sendAdminNewOrderNotification(env, order) {
  if (!env.FCM_PROJECT_ID || !env.FCM_SERVICE_ACCOUNT_EMAIL || !env.FCM_PRIVATE_KEY) return;
  try {
    const { results } = await env.DB.prepare(`SELECT registration_token FROM admin_devices ORDER BY last_seen_at DESC LIMIT 100`).all();
    if (!results.length) return;
    const accessToken = await getFcmAccessToken(env);
    await Promise.all(results.map(async ({ registration_token: token }) => {
      const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(env.FCM_PROJECT_ID)}/messages:send`, {
        method: "POST",
        headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
        body: JSON.stringify({ message: {
          token,
          notification: { title: "Pesanan baru", body: `${order.public_code} · ${new Intl.NumberFormat("id-ID").format(order.total_amount)} rupiah` },
          data: { order_code: order.public_code },
          android: { priority: "high", notification: { channel_id: "ruma_orders" } },
        } }),
        signal: AbortSignal.timeout(10_000),
      });
      if (response.status === 404 || response.status === 410) {
        await env.DB.prepare(`DELETE FROM admin_devices WHERE registration_token = ?1`).bind(token).run();
      } else if (!response.ok) {
        console.warn("FCM send failed", response.status);
      }
    }));
  } catch (error) {
    logOperationalError("admin_order_notification", error);
  }
}

async function updateAdminOrderStatus(request, env, headers, orderCode) {
  const authError = adminAuthError(request, env, headers);
  if (authError) return authError;
  if (!validOrderCode(orderCode)) return jsonResponse({ error: "not_found" }, 404, headers);
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return jsonResponse({ error: "content_type_required", message: "Kirim data sebagai JSON." }, 415, headers);
  }
  try {
    const body = await readBoundedJson(request);
    const statusType = body?.status_type;
    const nextStatus = boundedText(body?.status, "Status", 1, 24);
    const note = boundedText(body?.note ?? "", "Catatan", 0, 300, false);
    if (!["order", "production"].includes(statusType)) throw inputError("Pilih jenis status pesanan atau produksi.");
    const current = await env.DB.prepare(
      `SELECT o.id, o.order_status, o.production_status, p.payment_status,
              s.shipment_status, r.status AS refund_status
       FROM orders AS o LEFT JOIN payments AS p ON p.id = (
         SELECT p2.id FROM payments AS p2 WHERE p2.order_id = o.id ORDER BY p2.created_at DESC LIMIT 1
       ) LEFT JOIN shipments AS s ON s.id = (
         SELECT s2.id FROM shipments AS s2 WHERE s2.order_id = o.id ORDER BY s2.created_at DESC LIMIT 1
       ) LEFT JOIN refund_requests AS r ON r.order_id = o.id
       WHERE o.public_code = ?1 LIMIT 1`,
    ).bind(orderCode).first();
    if (!current) return jsonResponse({ error: "not_found" }, 404, headers);

    const transitionMap = statusType === "order"
      ? { new: ["accepted", "cancelled"], accepted: ["completed", "cancelled"], completed: [], cancelled: [] }
      : { pending: ["in_progress", "cancelled"], in_progress: ["completed", "cancelled"], completed: [], cancelled: [] };
    const currentStatus = statusType === "order" ? current.order_status : current.production_status;
    if (!transitionMap[currentStatus]?.includes(nextStatus)) {
      return jsonResponse({ error: "invalid_status_transition", message: `Status ${currentStatus} tidak dapat diubah menjadi ${nextStatus}.` }, 409, headers);
    }
    if (statusType === "order" && nextStatus === "accepted" && current.payment_status !== "paid") {
      return jsonResponse({ error: "payment_not_paid", message: "Pesanan hanya dapat diterima setelah pembayaran disetujui." }, 409, headers);
    }
    if (statusType === "order" && nextStatus === "cancelled" && current.payment_status === "paid") {
      return jsonResponse({ error: "refund_policy_required", message: "Pembayaran sudah lunas. Selesaikan kebijakan refund sebelum membatalkan pesanan." }, 409, headers);
    }
    if (statusType === "order" && nextStatus === "completed" && current.production_status !== "completed") {
      return jsonResponse({ error: "production_not_completed", message: "Produksi harus selesai sebelum pesanan dituntaskan." }, 409, headers);
    }
    if (statusType === "order" && nextStatus === "completed" && current.shipment_status !== "delivered") {
      return jsonResponse({ error: "shipment_not_delivered", message: "Pesanan baru dapat dituntaskan setelah pengiriman diterima pelanggan." }, 409, headers);
    }
    if (statusType === "production" && nextStatus === "in_progress" && (current.order_status !== "accepted" || current.payment_status !== "paid")) {
      return jsonResponse({ error: "order_not_ready", message: "Produksi dapat dimulai setelah pesanan diterima dan pembayaran lunas." }, 409, headers);
    }
    if (statusType === "production" && nextStatus === "in_progress" && ["requested", "approved"].includes(current.refund_status)) {
      return jsonResponse({ error: "refund_in_progress", message: "Permintaan refund sedang ditangani. Selesaikan atau koordinasikan sebelum memulai produksi." }, 409, headers);
    }
    if (statusType === "production" && nextStatus === "cancelled" && current.payment_status === "paid") {
      return jsonResponse({ error: "refund_policy_required", message: "Pesanan lunas tidak dapat dibatalkan langsung. Gunakan alur refund jika produksi belum dimulai." }, 409, headers);
    }
    if (statusType === "production" && nextStatus === "completed" && (current.order_status !== "accepted" || current.payment_status !== "paid")) {
      return jsonResponse({ error: "order_not_ready", message: "Produksi hanya dapat dituntaskan untuk pesanan diterima dan lunas." }, 409, headers);
    }
    if (nextStatus === "cancelled" && !note) throw inputError("Tulis alasan pembatalan pada catatan.");

    const changedAt = new Date().toISOString();
    const updateStatement = statusType === "order"
      ? env.DB.prepare(`UPDATE orders SET order_status = ?1, updated_at = ?2 WHERE id = ?3 AND order_status = ?4`).bind(nextStatus, changedAt, current.id, currentStatus)
      : env.DB.prepare(`UPDATE orders SET production_status = ?1, updated_at = ?2 WHERE id = ?3 AND production_status = ?4`).bind(nextStatus, changedAt, current.id, currentStatus);
    const result = await env.DB.batch([
      updateStatement,
      env.DB.prepare(
        `INSERT INTO order_status_history (
           id, order_id, status_type, previous_status, new_status, actor_type, note
         ) SELECT ?1, ?2, ?3, ?4, ?5, 'admin', ?6
           WHERE EXISTS (SELECT 1 FROM orders WHERE id = ?2 AND updated_at = ?7)`,
      ).bind(crypto.randomUUID(), current.id, statusType, currentStatus, nextStatus, note || `Admin memperbarui status ${statusType}`, changedAt),
    ]);
    if (result[0]?.meta?.changes !== 1 || result[1]?.meta?.changes !== 1) {
      return jsonResponse({ error: "order_changed", message: "Status pesanan berubah. Muat ulang detail." }, 409, headers);
    }
    return jsonResponse({ data: { order_code: orderCode, status_type: statusType, previous_status: currentStatus, status: nextStatus }, message: "Status pesanan diperbarui." }, 200, { ...headers, "cache-control": "no-store" });
  } catch (error) {
    if (error.status === 400) return jsonResponse({ error: "validation_error", message: error.message }, 400, headers);
    logDatabaseError("update_admin_order_status", error);
    return jsonResponse({ error: "internal_server_error" }, 500, headers);
  }
}

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function buildImageKitSignedUrl(filePath, env) {
  if (!env.IMAGEKIT_PRIVATE_KEY || !env.IMAGEKIT_URL_ENDPOINT) return null;
  const endpoint = env.IMAGEKIT_URL_ENDPOINT.replace(/\/+$/, "");
  const encodedPath = filePath.split("/").map((part) => encodeURIComponent(part)).join("/");
  const relativePath = encodedPath.startsWith("/") ? encodedPath.slice(1) : encodedPath;
  const imageUrl = `${endpoint}/${relativePath}`;
  const expiresAt = Math.floor(Date.now() / 1000) + 300;
  const signingValue = `${relativePath}${expiresAt}`;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(env.IMAGEKIT_PRIVATE_KEY),
    { name: "HMAC", hash: "SHA-1" }, false, ["sign"],
  );
  const signature = bytesToHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingValue)));
  return { url: `${imageUrl}?ik-t=${expiresAt}&ik-s=${signature}`, expires_at: expiresAt };
}

async function getAdminPaymentProof(request, env, headers, paymentReference) {
  const authError = adminAuthError(request, env, headers);
  if (authError) return authError;
  if (!validPaymentReference(paymentReference)) return jsonResponse({ error: "not_found" }, 404, headers);
  try {
    const payment = await env.DB.prepare(
      `SELECT p.payment_reference, p.payment_status, p.proof_file_path,
              p.proof_uploaded_at, p.amount, p.currency, o.public_code AS order_code
       FROM payments AS p JOIN orders AS o ON o.id = p.order_id
       WHERE p.payment_reference = ?1 LIMIT 1`,
    ).bind(paymentReference).first();
    if (!payment || !payment.proof_file_path) return jsonResponse({ error: "proof_not_found" }, 404, headers);
    const signed = await buildImageKitSignedUrl(payment.proof_file_path, env);
    if (!signed) return jsonResponse({ error: "imagekit_delivery_not_configured", message: "URL aman ImageKit belum dikonfigurasi." }, 503, headers);
    return jsonResponse({ data: { ...payment, proof_url: signed.url, proof_url_expires_at: signed.expires_at } }, 200, { ...headers, "cache-control": "no-store" });
  } catch (error) {
    logDatabaseError("get_admin_payment_proof", error);
    return jsonResponse({ error: "internal_server_error" }, 500, headers);
  }
}

async function deleteImageKitFile(fileId, env) {
  if (env.APP_ENV === "test" && env.TEST_PAYMENT_PROOF_STORAGE === "memory") return;
  if (!env.IMAGEKIT_PRIVATE_KEY || !fileId) return;
  try {
    const response = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}`, {
      method: "DELETE",
      headers: { authorization: `Basic ${btoa(`${env.IMAGEKIT_PRIVATE_KEY}:`)}` },
    });
    if (!response.ok) console.warn("ImageKit cleanup failed", response.status);
  } catch (error) {
    logOperationalError("imagekit_cleanup", error);
  }
}

async function expireUnpaidOrders(env, now = new Date()) {
  const expiredAt = now.toISOString();
  const predicate = `SELECT o.id FROM orders AS o
    WHERE o.payment_expires_at IS NOT NULL AND o.payment_expires_at <= ?1
      AND EXISTS (
        SELECT 1 FROM payments AS p WHERE p.order_id = o.id
          AND p.payment_status = 'pending' AND p.proof_file_id IS NULL
      )`;
  const expired = await env.DB.prepare(`SELECT COUNT(*) AS total FROM (${predicate}) AS expired`).bind(expiredAt).first();
  const count = Number(expired?.total ?? 0);
  if (!count) return 0;

  const orderIds = `(${predicate})`;
  const statements = [
    env.DB.prepare(`DELETE FROM order_customizations WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id IN ${orderIds})`).bind(expiredAt),
    env.DB.prepare(`DELETE FROM order_production_files WHERE order_id IN ${orderIds}`).bind(expiredAt),
    env.DB.prepare(`DELETE FROM order_files WHERE order_id IN ${orderIds}`).bind(expiredAt),
    env.DB.prepare(`DELETE FROM order_items WHERE order_id IN ${orderIds}`).bind(expiredAt),
    env.DB.prepare(`DELETE FROM payments WHERE order_id IN ${orderIds} AND payment_status = 'pending' AND proof_file_id IS NULL`).bind(expiredAt),
    env.DB.prepare(`DELETE FROM shipments WHERE order_id IN ${orderIds}`).bind(expiredAt),
    env.DB.prepare(`DELETE FROM order_status_history WHERE order_id IN ${orderIds}`).bind(expiredAt),
    env.DB.prepare(`DELETE FROM orders WHERE id IN ${orderIds}`).bind(expiredAt),
  ];
  await env.DB.batch(statements);
  return count;
}

async function reviewAdminPayment(request, env, headers, paymentReference) {
  const authError = adminAuthError(request, env, headers);
  if (authError) return authError;
  if (!validPaymentReference(paymentReference)) return jsonResponse({ error: "not_found" }, 404, headers);
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return jsonResponse({ error: "content_type_required", message: "Kirim data sebagai JSON." }, 415, headers);
  }
  try {
    const body = await readBoundedJson(request);
    const decision = body?.decision;
    if (!["approve", "reject"].includes(decision)) throw inputError("Pilih approve atau reject.");
    const note = boundedText(body?.note ?? "", "Catatan admin", 0, 300, false);
    const payment = await env.DB.prepare(
      `SELECT p.id, p.order_id, p.payment_status, p.proof_file_id
       FROM payments AS p WHERE p.payment_reference = ?1 LIMIT 1`,
    ).bind(paymentReference).first();
    if (!payment) return jsonResponse({ error: "not_found" }, 404, headers);
    if (payment.payment_status !== "pending" || !payment.proof_file_id) {
      return jsonResponse({ error: "payment_not_reviewable", message: "Pembayaran tidak menunggu pemeriksaan dengan bukti aktif." }, 409, headers);
    }

    const reviewedAt = new Date().toISOString();
    const actionNote = decision === "approve"
      ? `Transfer dicocokkan admin${note ? `: ${note}` : ""}`
      : `Bukti ditolak; silakan hubungi admin melalui chat${note ? `: ${note}` : ""}`;
    const updateStatement = decision === "approve"
      ? env.DB.prepare(
        `UPDATE payments SET payment_status = 'paid', verified_at = ?1, updated_at = ?1
         WHERE id = ?2 AND payment_status = 'pending' AND proof_file_id IS NOT NULL`,
      ).bind(reviewedAt, payment.id)
      : env.DB.prepare(
        `UPDATE payments SET payment_status = 'failed', proof_file_id = NULL, proof_file_path = NULL,
           proof_uploaded_at = NULL, updated_at = ?1
         WHERE id = ?2 AND payment_status = 'pending' AND proof_file_id = ?3`,
      ).bind(reviewedAt, payment.id, payment.proof_file_id);
    const update = await env.DB.batch([
      updateStatement,
      env.DB.prepare(
      `INSERT INTO order_status_history (
         id, order_id, status_type, previous_status, new_status, actor_type, note
       ) SELECT ?1, ?2, 'payment', 'pending', ?3, 'admin', ?4
         WHERE EXISTS (SELECT 1 FROM payments WHERE id = ?5 AND updated_at = ?6)`,
      ).bind(crypto.randomUUID(), payment.order_id, decision === "approve" ? "paid" : "failed", actionNote, payment.id, reviewedAt),
    ]);
    if (update[0]?.meta?.changes !== 1 || update[1]?.meta?.changes !== 1) return jsonResponse({ error: "payment_changed", message: "Status pembayaran berubah. Muat ulang antrean." }, 409, headers);
    if (decision === "reject") await deleteImageKitFile(payment.proof_file_id, env);
    return jsonResponse({
      data: { payment_reference: paymentReference, payment_status: decision === "approve" ? "paid" : "failed", proof_received: decision !== "reject" },
      message: decision === "approve" ? "Pembayaran disetujui." : "Bukti ditolak. Silakan hubungi admin melalui chat.",
    }, 200, { ...headers, "cache-control": "no-store" });
  } catch (error) {
    if (error.status === 400) return jsonResponse({ error: "validation_error", message: error.message }, 400, headers);
    logDatabaseError("review_admin_payment", error);
    return jsonResponse({ error: "internal_server_error" }, 500, headers);
  }
}

function logDatabaseError(operation, error) {
  logOperationalError(operation, error, "Database operation failed");
}

function logOperationalError(operation, error, message = "Operation failed") {
  console.error(JSON.stringify({
    message,
    operation,
    error_type: error instanceof Error ? error.name : "UnknownError",
  }));
}

function inputError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

async function readBoundedJson(request) {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxOrderBodyBytes) {
    throw inputError("Data pesanan terlalu besar.");
  }
  if (!request.body) throw inputError("Isi pesanan tidak ditemukan.");

  const reader = request.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxOrderBodyBytes) {
      await reader.cancel();
      throw inputError("Data pesanan terlalu besar.");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw inputError("Format data pesanan tidak valid.");
  }
}

function boundedText(value, label, minLength, maxLength, required = true) {
  if (value == null && !required) return null;
  if (typeof value !== "string") throw inputError(`${label} tidak valid.`);
  const normalized = value.trim();
  if (required && normalized.length < minLength) throw inputError(`${label} minimal ${minLength} karakter.`);
  if (normalized.length > maxLength) throw inputError(`${label} maksimal ${maxLength} karakter.`);
  return normalized || (required ? null : null);
}

function validateCustomer(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw inputError("Data pesanan tidak valid.");
  const customerName = boundedText(body.customer?.name, "Nama", 2, 100);
  const customerPhone = boundedText(body.customer?.phone, "Nomor telepon", 8, 24);
  if (!/^[+0-9][0-9 +().-]{7,23}$/.test(customerPhone) || !/\d/.test(customerPhone)) {
    throw inputError("Format nomor telepon tidak valid.");
  }
  const customerEmail = boundedText(body.customer?.email ?? "", "Email", 0, 254, false);
  if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    throw inputError("Format email tidak valid.");
  }
  const shippingAddress = boundedText(body.customer?.address, "Alamat", 10, 500);
  const customerNote = boundedText(body.customer?.note ?? "", "Catatan", 0, 500, false);
  return { customerName, customerPhone, customerEmail, shippingAddress, customerNote };
}

function validateCartInput(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 20) {
    throw inputError("Keranjang harus berisi 1 sampai 20 jenis produk.");
  }
  return items.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw inputError("Item keranjang tidak valid.");
    if (typeof item.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug)) {
      throw inputError("Produk pada keranjang tidak valid.");
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10) {
      throw inputError("Jumlah tiap produk harus antara 1 dan 10.");
    }
    const customization = item.customization ?? {};
    if (!customization || typeof customization !== "object" || Array.isArray(customization)) {
      throw inputError("Data custom produk tidak valid.");
    }
    return { slug: item.slug, quantity: item.quantity, customization };
  });
}

function validateCustomization(fields, values) {
  const fieldMap = new Map(fields.map((field) => [field.field_key, field]));
  for (const key of Object.keys(values)) {
    if (!fieldMap.has(key)) throw inputError("Ada bagian custom yang tidak tersedia untuk produk ini.");
  }

  const normalized = {};
  for (const field of fields) {
    const rawValue = values[field.field_key];
    if (rawValue == null || rawValue === "") {
      if (field.is_required) throw inputError(`${field.label} wajib diisi.`);
      continue;
    }
    if (typeof rawValue !== "string" && typeof rawValue !== "number") {
      throw inputError(`${field.label} tidak valid.`);
    }
    const value = String(rawValue).trim();
    if (!value) {
      if (field.is_required) throw inputError(`${field.label} wajib diisi.`);
      continue;
    }
    if (field.max_length && value.length > field.max_length) {
      throw inputError(`${field.label} maksimal ${field.max_length} karakter.`);
    }
    const rules = JSON.parse(field.validation_rules_json || "{}");
    if (field.input_type === "number") {
      if (!/^\d+$/.test(value)) throw inputError(`${field.label} hanya boleh berisi angka.`);
      const numericValue = Number(value);
      if (Number.isFinite(rules.min) && numericValue < rules.min) throw inputError(`${field.label} terlalu kecil.`);
      if (Number.isFinite(rules.max) && numericValue > rules.max) throw inputError(`${field.label} terlalu besar.`);
    }
    if (rules.pattern && !new RegExp(rules.pattern, rules.unicode ? "u" : "").test(value)) {
      throw inputError(`${field.label} tidak sesuai format.`);
    }
    normalized[field.field_key] = rules.uppercase ? value.toLocaleUpperCase("id-ID") : value;
  }
  return normalized;
}

function generateOrderCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const suffix = [...bytes].map((byte) => orderCodeAlphabet[byte & 31]).join("");
  return `RUMA-${suffix}`;
}

function orderResult(order, status = 201, headers = {}) {
  return jsonResponse({
    data: {
      order_code: order.public_code,
      order_status: order.order_status,
      item_subtotal_amount: order.subtotal_amount ?? order.total_amount,
      shipping_amount: order.shipping_amount ?? 0,
      total_amount: order.total_amount,
      shipping_destination: order.shipping_destination_label ?? null,
      shipping_courier: order.shipping_courier_name ?? null,
      shipping_service: order.shipping_service ?? null,
      shipping_distance_km: order.shipping_distance_km ?? null,
      payment_expires_at: order.payment_expires_at ?? null,
      payment_method: "transfer_bank_manual",
      payment_reference: order.payment_reference ?? order.public_code,
      payment_status: order.payment_status ?? "pending",
      currency: order.currency,
    },
    message: "Pesanan tercatat. Simpan kode pembayaran dan tunggu konfirmasi detail transfer dari admin.",
  }, status, headers);
}

async function findOrderByIdempotencyKey(env, key) {
  return env.DB.prepare(
    `SELECT o.public_code, o.order_status, o.subtotal_amount, o.shipping_amount,
            o.total_amount, o.shipping_destination_label, o.shipping_courier_name,
            o.shipping_distance_km, o.payment_expires_at,
            o.shipping_service, o.currency, p.payment_reference, p.payment_status
     FROM orders AS o LEFT JOIN payments AS p ON p.order_id = o.id
     WHERE o.idempotency_key = ?1 LIMIT 1`,
  ).bind(key).first();
}

async function createOrder(request, env, origin, executionContext) {
  const headers = corsHeaders(origin);
  if (!origin || origin === false) return jsonResponse({ error: "origin_not_allowed" }, 403);
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return jsonResponse({ error: "content_type_required", message: "Kirim data sebagai JSON." }, 415, headers);
  }

  const idempotencyKey = request.headers.get("Idempotency-Key");
  if (!idempotencyKey || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
    return jsonResponse({ error: "idempotency_key_required", message: "Kunci pengiriman pesanan tidak valid." }, 400, headers);
  }

  try {
    const previousOrder = await findOrderByIdempotencyKey(env, idempotencyKey);
    if (previousOrder) return orderResult(previousOrder, 200, headers);

    const body = await readBoundedJson(request);
    const customer = validateCustomer(body);
    const cart = validateCartInput(body.items);
    const slugs = [...new Set(cart.map((item) => item.slug))];
    const placeholders = slugs.map(() => "?").join(", ");
    const { results: rows } = await env.DB.prepare(
      `SELECT p.id, p.slug, p.name, p.description, p.price_amount, p.currency, p.shipping_weight_grams,
              p.fixed_size, t.id AS template_id, t.version AS template_version,
              f.field_key, f.label AS field_label, f.input_type,
              f.is_required, f.max_length, f.validation_rules_json
       FROM products AS p
       JOIN product_categories AS c ON c.id = p.category_id
       LEFT JOIN product_templates AS t ON t.product_id = p.id AND t.is_active = 1
       LEFT JOIN customization_fields AS f ON f.template_id = t.id
       WHERE p.slug IN (${placeholders}) AND p.is_active = 1 AND c.is_active = 1
       ORDER BY p.slug ASC, f.sort_order ASC`,
    ).bind(...slugs).all();

    const products = new Map();
    for (const row of rows) {
      if (!products.has(row.slug)) {
        products.set(row.slug, {
          id: row.id,
          slug: row.slug,
          name: row.name,
          price: row.price_amount,
          shippingWeight: row.shipping_weight_grams,
          currency: row.currency,
          fixedSize: row.fixed_size,
          templateId: row.template_id,
          templateVersion: row.template_version,
          fields: [],
        });
      }
      if (row.field_key) {
        products.get(row.slug).fields.push({
          field_key: row.field_key,
          label: row.field_label,
          input_type: row.input_type,
          is_required: row.is_required,
          max_length: row.max_length,
          validation_rules_json: row.validation_rules_json,
        });
      }
    }

    for (const item of cart) {
      if (!products.has(item.slug)) throw inputError("Ada produk yang sudah tidak tersedia. Muat ulang katalog.");
      item.product = products.get(item.slug);
      item.customization = validateCustomization(item.product.fields, item.customization);
    }

    const subtotal = cart.reduce((sum, item) => {
      const line = item.product.price * item.quantity;
      if (!Number.isSafeInteger(line) || !Number.isSafeInteger(sum + line)) throw inputError("Total pesanan terlalu besar.");
      return sum + line;
    }, 0);
    const destinationId = String(body.shipping?.destination_id ?? "");
    const destinationLabel = boundedText(body.shipping?.destination_label, "Tujuan pengiriman", 3, 180);
    const courierCode = boundedText(body.shipping?.courier_code, "Kurir", 2, 24).toLowerCase();
    const shippingService = boundedText(body.shipping?.service, "Layanan kurir", 1, 80);
    if (!/^\d{1,12}$/.test(destinationId)) throw inputError("Pilih tujuan pengiriman dari hasil pencarian.");
    let selectedRate = null;
    let route = null;
    if (courierCode === "gojek") {
      const latitude = Number(body.shipping?.latitude);
      const longitude = Number(body.shipping?.longitude);
      if (!validCoordinates(latitude, longitude)) throw inputError("Pasang pin tujuan di peta untuk memilih Gojek.");
      route = await getRouteDistance(latitude, longitude);
      selectedRate = localCourierRate(route);
      if (!selectedRate || selectedRate.service !== shippingService) {
        throw inputError("Gojek Same Day hanya tersedia bila rute jalan kurang dari 30 km. Hitung ulang ongkir.");
      }
    } else {
      const { rates } = await calculateShippingRates(env, destinationId, cart);
      selectedRate = rates.find((rate) => rate.code === courierCode && rate.service === shippingService);
    }
    if (!selectedRate) throw inputError("Tarif berubah. Hitung ulang ongkir dan pilih layanan kembali.");
    const total = subtotal + selectedRate.cost;
    if (!Number.isSafeInteger(total)) throw inputError("Total pesanan terlalu besar.");
    const orderId = crypto.randomUUID();
    const orderCode = generateOrderCode();
    const paymentExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const statements = [
      env.DB.prepare(
        `INSERT INTO orders (
           id, public_code, idempotency_key, customer_name, customer_phone,
           customer_email, shipping_address, shipping_destination_id,
           shipping_destination_label, shipping_courier_code, shipping_courier_name,
           shipping_service, shipping_distance_km, subtotal_amount, shipping_amount, total_amount,
           currency, customer_note, payment_expires_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, 'IDR', ?17, ?18)`,
      ).bind(
        orderId,
        orderCode,
        idempotencyKey,
        customer.customerName,
        customer.customerPhone,
        customer.customerEmail,
        customer.shippingAddress,
        destinationId,
        destinationLabel,
        selectedRate.code,
        selectedRate.name,
        selectedRate.service,
        route?.distanceKm ?? null,
        subtotal,
        selectedRate.cost,
        total,
        customer.customerNote,
        paymentExpiresAt,
      ),
    ];

    statements.push(env.DB.prepare(
      `INSERT INTO payments (id, order_id, provider, payment_reference, amount, currency, payment_status)
       VALUES (?1, ?2, 'manual_bank_transfer', ?3, ?4, 'IDR', 'pending')`,
    ).bind(crypto.randomUUID(), orderId, orderCode, total));

    for (const item of cart) {
      const orderItemId = crypto.randomUUID();
      const lineTotal = item.product.price * item.quantity;
      statements.push(env.DB.prepare(
        `INSERT INTO order_items (
           id, order_id, product_id, product_name_snapshot,
           product_slug_snapshot, unit_price_amount, quantity,
           line_total_amount, fixed_size_snapshot
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
      ).bind(
        orderItemId,
        orderId,
        item.product.id,
        item.product.name,
        item.product.slug,
        item.product.price,
        item.quantity,
        lineTotal,
        item.product.fixedSize,
      ));

      if (item.product.templateId) {
        statements.push(env.DB.prepare(
          `INSERT INTO order_customizations (
             order_item_id, template_id, template_version_snapshot, values_json, field_snapshot_json
           ) VALUES (?1, ?2, ?3, ?4, ?5)`,
        ).bind(
          orderItemId,
          item.product.templateId,
          item.product.templateVersion,
          JSON.stringify(item.customization),
          JSON.stringify(item.product.fields.map((field) => ({
            key: field.field_key,
            label: field.label,
            type: field.input_type,
            required: Boolean(field.is_required),
            max_length: field.max_length,
            rules: JSON.parse(field.validation_rules_json || "{}"),
          }))),
        ));
      }
    }

    statements.push(env.DB.prepare(
      `INSERT INTO order_status_history (
         id, order_id, status_type, previous_status, new_status, actor_type
       ) VALUES (?1, ?2, 'order', NULL, 'new', 'customer')`,
    ).bind(crypto.randomUUID(), orderId));
    statements.push(env.DB.prepare(
      `INSERT INTO order_status_history (
         id, order_id, status_type, previous_status, new_status, actor_type, note
       ) VALUES (?1, ?2, 'payment', NULL, 'pending', 'system', 'Menunggu transfer bank manual')`,
    ).bind(crypto.randomUUID(), orderId));

    await env.DB.batch(statements);
    const notification = sendAdminNewOrderNotification(env, { public_code: orderCode, total_amount: total });
    if (executionContext?.waitUntil) executionContext.waitUntil(notification);
    else void notification;
    return orderResult({
      public_code: orderCode,
      order_status: "new",
      subtotal_amount: subtotal,
      shipping_amount: selectedRate.cost,
      total_amount: total,
      shipping_destination_label: destinationLabel,
      shipping_courier_name: selectedRate.name,
      shipping_service: selectedRate.service,
      shipping_distance_km: route?.distanceKm ?? null,
      payment_reference: orderCode,
      payment_status: "pending",
      payment_expires_at: paymentExpiresAt,
      currency: "IDR",
    }, 201, headers);
  } catch (error) {
    if (error.status === 400) {
      return jsonResponse({ error: "validation_error", message: error.message }, 400, headers);
    }
    if (error.status === 503) {
      return jsonResponse({ error: "shipping_not_configured", message: "Layanan ongkir belum dikonfigurasi." }, 503, headers);
    }
    if (error.status === 502) {
      return jsonResponse({ error: "shipping_provider_error", message: "Tarif ongkir berubah atau sementara tidak tersedia. Hitung ulang sebelum mengirim pesanan." }, 502, headers);
    }
    try {
      const previousOrder = await findOrderByIdempotencyKey(env, idempotencyKey);
      if (previousOrder) return orderResult(previousOrder, 200, headers);
    } catch (lookupError) {
      logDatabaseError("find_idempotent_order", lookupError);
    }
    logDatabaseError("create_order", error);
    return jsonResponse({
      error: "internal_server_error",
      message: "Pesanan belum berhasil disimpan. Silakan coba lagi.",
    }, 500, headers);
  }
}

export default {
  async scheduled(controller, env, executionContext) {
    const cleanup = expireUnpaidOrders(env)
      .then((count) => {
        if (count > 0) console.info(JSON.stringify({ operation: "expire_unpaid_orders", deleted_orders: count }));
      })
      .catch((error) => logDatabaseError("expire_unpaid_orders", error));
    if (executionContext?.waitUntil) executionContext.waitUntil(cleanup);
    else await cleanup;
  },
  async fetch(request, env, executionContext) {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, "") || "/";

    if (pathname === "/api/orders" && request.method === "OPTIONS") {
      const origin = getAllowedOrigin(request, env);
      if (origin === false) return jsonResponse({ error: "origin_not_allowed" }, 403);
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (["/api/shipping/destinations", "/api/shipping/quotes", "/api/orders/proof", "/api/orders/status", "/api/orders/cancellation"].includes(pathname) && request.method === "OPTIONS") {
      const origin = getAllowedOrigin(request, env);
      if (origin === false) return jsonResponse({ error: "origin_not_allowed" }, 403);
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (pathname.startsWith("/api/admin/") && request.method === "OPTIONS") {
      const origin = getAllowedOrigin(request, env);
      if (origin === false) return jsonResponse({ error: "origin_not_allowed" }, 403);
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    const rateLimitResponse = await enforceRateLimit(request, env, pathname);
    if (rateLimitResponse) return rateLimitResponse;
    const adminProofMatch = pathname.match(/^\/api\/admin\/payments\/([^/]+)\/proof$/);
    const adminReviewMatch = pathname.match(/^\/api\/admin\/payments\/([^/]+)\/review$/);
    const adminRefundActionMatch = pathname.match(/^\/api\/admin\/refunds\/([0-9a-f-]{36})\/(approve|process)$/i);
    const adminShipmentMatch = pathname.match(/^\/api\/admin\/orders\/([^/]+)\/shipment$/);
    const adminGenerateProductionFileMatch = pathname.match(/^\/api\/admin\/orders\/([^/]+)\/items\/([^/]+)\/production-files\/dxf$/);
    const adminProductionFileMatch = pathname.match(/^\/api\/admin\/orders\/([^/]+)\/production-files\/([^/]+)$/);
    const adminOrderStatusMatch = pathname.match(/^\/api\/admin\/orders\/([^/]+)\/status$/);
    const adminOrderMatch = pathname.match(/^\/api\/admin\/orders\/([^/]+)$/);
    if (pathname === "/api/admin/orders" && request.method === "GET") {
      const origin = getAllowedOrigin(request, env);
      if (origin === false) return jsonResponse({ error: "origin_not_allowed" }, 403);
      return listAdminOrders(request, env, corsHeaders(origin));
    }
    if (adminShipmentMatch && request.method === "POST") {
      const origin = getAllowedOrigin(request, env);
      if (origin === false) return jsonResponse({ error: "origin_not_allowed" }, 403);
      return updateAdminShipment(request, env, corsHeaders(origin), decodeURIComponent(adminShipmentMatch[1]));
    }
    if (adminGenerateProductionFileMatch && request.method === "POST") {
      const origin = getAllowedOrigin(request, env);
      if (origin === false) return jsonResponse({ error: "origin_not_allowed" }, 403);
      return createAdminProductionFile(request, env, corsHeaders(origin), decodeURIComponent(adminGenerateProductionFileMatch[1]), decodeURIComponent(adminGenerateProductionFileMatch[2]));
    }
    if (adminProductionFileMatch && request.method === "GET") {
      const origin = getAllowedOrigin(request, env);
      if (origin === false) return jsonResponse({ error: "origin_not_allowed" }, 403);
      return getAdminProductionFile(request, env, corsHeaders(origin), decodeURIComponent(adminProductionFileMatch[1]), decodeURIComponent(adminProductionFileMatch[2]));
    }
    if (["/api/admin/devices", "/api/admin/devices/remove"].includes(pathname) && request.method === "POST") {
      const origin = getAllowedOrigin(request, env);
      if (origin === false) return jsonResponse({ error: "origin_not_allowed" }, 403);
      return registerAdminDevice(request, env, corsHeaders(origin), pathname.endsWith("/remove"));
    }
    if (adminOrderStatusMatch && request.method === "POST") {
      const origin = getAllowedOrigin(request, env);
      if (origin === false) return jsonResponse({ error: "origin_not_allowed" }, 403);
      return updateAdminOrderStatus(request, env, corsHeaders(origin), decodeURIComponent(adminOrderStatusMatch[1]));
    }
    if (adminOrderMatch && request.method === "GET") {
      const origin = getAllowedOrigin(request, env);
      if (origin === false) return jsonResponse({ error: "origin_not_allowed" }, 403);
      return getAdminOrder(request, env, corsHeaders(origin), decodeURIComponent(adminOrderMatch[1]));
    }
    if (pathname === "/api/admin/payments" && request.method === "GET") {
      const origin = getAllowedOrigin(request, env);
      if (origin === false) return jsonResponse({ error: "origin_not_allowed" }, 403);
      return listAdminPayments(request, env, corsHeaders(origin));
    }
    if (pathname === "/api/admin/refunds" && request.method === "GET") {
      const origin = getAllowedOrigin(request, env);
      if (origin === false) return jsonResponse({ error: "origin_not_allowed" }, 403);
      return listAdminRefunds(request, env, corsHeaders(origin));
    }
    if (adminRefundActionMatch && request.method === "POST") {
      const origin = getAllowedOrigin(request, env);
      if (origin === false) return jsonResponse({ error: "origin_not_allowed" }, 403);
      return updateAdminRefund(request, env, corsHeaders(origin), adminRefundActionMatch[1], adminRefundActionMatch[2].toLowerCase());
    }
    if (adminProofMatch && request.method === "GET") {
      const origin = getAllowedOrigin(request, env);
      if (origin === false) return jsonResponse({ error: "origin_not_allowed" }, 403);
      return getAdminPaymentProof(request, env, corsHeaders(origin), decodeURIComponent(adminProofMatch[1]));
    }
    if (adminReviewMatch && request.method === "POST") {
      const origin = getAllowedOrigin(request, env);
      if (origin === false) return jsonResponse({ error: "origin_not_allowed" }, 403);
      return reviewAdminPayment(request, env, corsHeaders(origin), decodeURIComponent(adminReviewMatch[1]));
    }
    if (pathname === "/api/shipping/destinations" && request.method === "GET") {
      const origin = getAllowedOrigin(request, env);
      if (origin === false) return jsonResponse({ error: "origin_not_allowed" }, 403);
      return searchShippingDestinations(request, env, corsHeaders(origin));
    }
    if (pathname === "/api/shipping/quotes" && request.method === "POST") {
      const origin = getAllowedOrigin(request, env);
      if (!origin || origin === false) return jsonResponse({ error: "origin_not_allowed" }, 403);
      if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
        return jsonResponse({ error: "content_type_required", message: "Kirim data sebagai JSON." }, 415, corsHeaders(origin));
      }
      return quoteShipping(request, env, corsHeaders(origin));
    }
    if (pathname === "/api/orders" && request.method === "POST") {
      return createOrder(request, env, getAllowedOrigin(request, env), executionContext);
    }
    if (pathname === "/api/orders/status" && request.method === "POST") {
      const origin = getAllowedOrigin(request, env);
      if (!origin || origin === false) return jsonResponse({ error: "origin_not_allowed" }, 403);
      return getPublicOrderStatus(request, env, corsHeaders(origin));
    }
    if (pathname === "/api/orders/cancellation" && request.method === "POST") {
      const origin = getAllowedOrigin(request, env);
      if (!origin || origin === false) return jsonResponse({ error: "origin_not_allowed" }, 403);
      return requestOrderRefund(request, env, corsHeaders(origin));
    }
    if (pathname === "/api/orders/proof" && request.method === "POST") {
      const origin = getAllowedOrigin(request, env);
      if (!origin || origin === false) return jsonResponse({ error: "origin_not_allowed" }, 403);
      if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) {
        return jsonResponse({ error: "content_type_required", message: "Kirim file sebagai multipart/form-data." }, 415, corsHeaders(origin));
      }
      return submitPaymentProof(request, env, corsHeaders(origin));
    }
    if (request.method !== "GET" && pathname.startsWith("/api/")) {
      return jsonResponse({ error: "method_not_allowed" }, 405);
    }

    if (request.method === "GET" && pathname === "/api/health") {
      return jsonResponse({ status: "ok" });
    }

    if (request.method === "GET" && pathname === "/api/catalog") {
      const origin = getAllowedOrigin(request, env);
      if (origin === false) return jsonResponse({ error: "origin_not_allowed" }, 403);
      const headers = corsHeaders(origin);
      try {
        const [categoryResult, productResult] = await Promise.all([
          env.DB.prepare(
            `SELECT c.slug, c.name, c.description
             FROM product_categories AS c
             WHERE c.is_active = 1
               AND EXISTS (
                 SELECT 1 FROM products AS p
                 WHERE p.category_id = c.id AND p.is_active = 1
               )
             ORDER BY c.sort_order ASC, c.name ASC`,
          ).all(),
          env.DB.prepare(
            `SELECT p.slug, p.name, p.description, p.price_amount,
                    p.currency, p.fixed_size, p.image_url, p.image_alt,
                    c.slug AS category, c.name AS category_name,
                    t.version AS template_version,
                    f.field_key AS customization_key, f.label AS customization_label,
                    f.input_type AS customization_type, f.is_required AS customization_required,
                    f.max_length AS customization_max_length,
                    f.validation_rules_json AS customization_rules_json
             FROM products AS p
             JOIN product_categories AS c ON c.id = p.category_id
             LEFT JOIN product_templates AS t ON t.product_id = p.id AND t.is_active = 1
             LEFT JOIN customization_fields AS f ON f.template_id = t.id
             WHERE p.is_active = 1 AND c.is_active = 1
             ORDER BY p.created_at DESC, p.name ASC, f.sort_order ASC`,
          ).all(),
        ]);

        const productsBySlug = new Map();
        for (const row of productResult.results) {
          if (!productsBySlug.has(row.slug)) {
            productsBySlug.set(row.slug, {
              slug: row.slug,
              name: row.name,
              description: row.description,
              price_amount: row.price_amount,
              currency: row.currency,
              fixed_size: row.fixed_size,
              image_url: row.image_url,
              image_alt: row.image_alt,
              category: row.category,
              category_name: row.category_name,
              customization_fields: [],
            });
          }
          if (row.customization_key) {
            productsBySlug.get(row.slug).customization_fields.push({
              key: row.customization_key,
              label: row.customization_label,
              type: row.customization_type,
              required: Boolean(row.customization_required),
              max_length: row.customization_max_length,
              rules: JSON.parse(row.customization_rules_json || "{}"),
            });
          }
        }

        for (const product of productsBySlug.values()) {
          product.customization = product.customization_fields.map((field) => field.label).join(", ");
        }
        return jsonResponse({
          data: {
            categories: categoryResult.results,
            products: [...productsBySlug.values()],
          },
        }, 200, headers);
      } catch (error) {
        logDatabaseError("get_catalog", error);
        return jsonResponse({ error: "internal_server_error" }, 500, headers);
      }
    }

    if (request.method === "GET" && pathname === "/api/products") {
      const origin = getAllowedOrigin(request, env);
      if (origin === false) return jsonResponse({ error: "origin_not_allowed" }, 403);
      const headers = corsHeaders(origin);
      try {
        const { results } = await env.DB.prepare(
          `SELECT p.slug, p.name, p.description, p.price_amount, p.currency,
                  p.fixed_size, p.image_url, p.image_alt, c.slug AS category_slug,
                  c.name AS category_name
           FROM products AS p
           JOIN product_categories AS c ON c.id = p.category_id
           WHERE p.is_active = 1 AND c.is_active = 1
           ORDER BY p.created_at DESC, p.slug ASC
           LIMIT ?1`,
        ).bind(parseLimit(url)).all();

        return jsonResponse({ data: results }, 200, headers);
      } catch (error) {
        logDatabaseError("list_products", error);
        return jsonResponse({ error: "internal_server_error" }, 500, headers);
      }
    }

    const productMatch = pathname.match(/^\/api\/products\/([a-z0-9-]+)$/);
    if (request.method === "GET" && productMatch) {
      const origin = getAllowedOrigin(request, env);
      if (origin === false) return jsonResponse({ error: "origin_not_allowed" }, 403);
      const headers = corsHeaders(origin);
      try {
        const product = await env.DB.prepare(
          `SELECT p.slug, p.name, p.description, p.price_amount, p.currency,
                  p.fixed_size, p.image_url, p.image_alt, c.slug AS category_slug,
                  c.name AS category_name
           FROM products AS p
           JOIN product_categories AS c ON c.id = p.category_id
           WHERE p.slug = ?1 AND p.is_active = 1 AND c.is_active = 1
           LIMIT 1`,
        ).bind(productMatch[1]).first();

        if (!product) return jsonResponse({ error: "not_found" }, 404, headers);
        return jsonResponse({ data: product }, 200, headers);
      } catch (error) {
        logDatabaseError("get_product", error);
        return jsonResponse({ error: "internal_server_error" }, 500, headers);
      }
    }

    return jsonResponse({ error: "not_found" }, 404);
  },
};
