const workerUrl = () => {
  const value = Netlify.env.get("CLOUDFLARE_WORKER_URL")?.trim()
    || "https://ruma-api-production.ajielt7.workers.dev";
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || !["", "/"].includes(url.pathname)) {
    throw new Error("CLOUDFLARE_WORKER_URL must be a clean HTTPS base URL.");
  }
  return url;
};

const jsonError = (message, status) => Response.json(
  { error: "api_proxy_unavailable", message },
  { status, headers: { "cache-control": "no-store" } },
);

export default async (request, context) => {
  let upstreamBase;
  try {
    upstreamBase = workerUrl();
  } catch {
    return jsonError("API belum dikonfigurasi.", 503);
  }

  const proxySecret = Netlify.env.get("NETLIFY_PROXY_SECRET")?.trim() ?? "";

  const incomingUrl = new URL(request.url);
  const upstreamUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, upstreamBase);
  const headers = new Headers(request.headers);

  // Do not forward hop-by-hop headers or client-supplied proxy identity.
  for (const name of [
    "connection", "content-length", "host", "keep-alive", "proxy-authenticate",
    "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade",
    "x-ruma-client-ip", "x-ruma-proxy-secret", "x-forwarded-for", "x-real-ip",
  ]) headers.delete(name);

  // These are trusted by the Worker only after the matching secret is installed there.
  if (proxySecret.length >= 32) {
    headers.set("x-ruma-proxy-secret", proxySecret);
    if (context.ip) headers.set("x-ruma-client-ip", context.ip);
  }

  try {
    const hasBody = !["GET", "HEAD"].includes(request.method);
    const body = hasBody ? await request.arrayBuffer() : undefined;
    const upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(55_000),
    });

    const responseHeaders = new Headers(upstreamResponse.headers);
    for (const name of ["connection", "content-encoding", "content-length", "keep-alive", "transfer-encoding", "upgrade"]) {
      responseHeaders.delete(name);
    }
    responseHeaders.set("cache-control", "no-store");
    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  } catch {
    return jsonError("Layanan API sementara tidak dapat dijangkau. Coba lagi.", 502);
  }
};

export const config = {
  path: "/api/*",
};

