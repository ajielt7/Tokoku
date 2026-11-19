(() => {
  const script = document.currentScript;
  const primaryBase = script?.dataset.apiBase?.replace(/\/$/, "") || "";
  const fallbackBase = script?.dataset.apiFallback?.replace(/\/$/, "") || "";
  const outageKey = "ruma-api-primary-unavailable-until";
  const outageCooldownMs = 30_000;
  const primaryTimeoutMs = 8_000;

  function recentlyUnavailable() {
    try {
      return Number(sessionStorage.getItem(outageKey) || 0) > Date.now();
    } catch {
      return false;
    }
  }

  function markUnavailable() {
    try {
      sessionStorage.setItem(outageKey, String(Date.now() + outageCooldownMs));
    } catch {
      // Storage can be disabled; the current request still gets its fallback.
    }
  }

  function clearUnavailable() {
    try {
      sessionStorage.removeItem(outageKey);
    } catch {
      // The network request does not depend on storage.
    }
  }

  function canFallback(path, options) {
    const method = String(options.method || "GET").toUpperCase();
    if (["GET", "HEAD"].includes(method)) return true;
    if (method !== "POST") return false;
    if (["/api/shipping/quotes", "/api/orders/status", "/api/orders/cancellation"].includes(path)) return true;
    if (path === "/api/orders") {
      const headers = new Headers(options.headers || {});
      return Boolean(headers.get("Idempotency-Key"));
    }
    // Payment proof uploads are deliberately not retried automatically.
    return false;
  }

  async function request(path, options = {}) {
    if (!primaryBase) throw new Error("Alamat API utama belum dikonfigurasi.");
    const useFallback = fallbackBase && fallbackBase !== primaryBase && canFallback(path, options);
    if (!useFallback) return fetch(`${primaryBase}${path}`, options);
    if (recentlyUnavailable()) {
      return fetch(`${fallbackBase}${path}`, options);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), primaryTimeoutMs);
    const callerSignal = options.signal;
    const abortFromCaller = () => controller.abort(callerSignal.reason);
    if (callerSignal?.aborted) abortFromCaller();
    else callerSignal?.addEventListener("abort", abortFromCaller, { once: true });

    try {
      const response = await fetch(`${primaryBase}${path}`, { ...options, signal: controller.signal });
      if (!useFallback || ![502, 503, 504].includes(response.status)) {
        clearUnavailable();
        return response;
      }
      markUnavailable();
    } catch (error) {
      if (callerSignal?.aborted) throw error;
      markUnavailable();
    } finally {
      clearTimeout(timeoutId);
      callerSignal?.removeEventListener("abort", abortFromCaller);
    }

    return fetch(`${fallbackBase}${path}`, options);
  }

  window.RumaApi = Object.freeze({ request });
})();
