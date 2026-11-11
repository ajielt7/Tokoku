const cartStorageKey = "ruma-cart-v1";
const cartItemsNode = document.querySelector("[data-cart-items]");
const checkoutItemsNode = document.querySelector("[data-checkout-items]");
const apiBaseUrl = document.currentScript?.dataset.apiBase?.replace(/\/$/, "") || "http://127.0.0.1:8787";
const previewMode = document.currentScript?.dataset.previewMode === "true";
const previewDestinations = [
  { id: "demo-cileunyi", label: "Cileunyi, Kabupaten Bandung" },
  { id: "demo-cileunyi-kulon", label: "Desa Cileunyi Kulon, Kecamatan Cileunyi, Kabupaten Bandung" },
  { id: "demo-cileunyi-wetan", label: "Desa Cileunyi Wetan, Kecamatan Cileunyi, Kabupaten Bandung" },
  { id: "demo-cimekar", label: "Desa Cimekar, Kecamatan Cileunyi, Kabupaten Bandung" },
  { id: "demo-cinunuk", label: "Desa Cinunuk, Kecamatan Cileunyi, Kabupaten Bandung" },
  { id: "demo-cibiru-hilir", label: "Desa Cibiru Hilir, Kecamatan Cileunyi, Kabupaten Bandung" },
  { id: "demo-cibiru-wetan", label: "Desa Cibiru Wetan, Kecamatan Cileunyi, Kabupaten Bandung" },
  { id: "demo-cibiru", label: "Cibiru, Kota Bandung" },
  { id: "demo-coblong", label: "Coblong, Kota Bandung" },
  { id: "demo-cimahi", label: "Cimahi, Kota Cimahi" },
  { id: "demo-jaksel", label: "Kebayoran Baru, Jakarta Selatan" },
];

function readCart() {
  try {
    const value = JSON.parse(localStorage.getItem(cartStorageKey) || "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((item) => item && typeof item.slug === "string" && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 10).slice(0, 20)
      .map((item) => ({
        ...item,
        customization: item.customization && typeof item.customization === "object" && !Array.isArray(item.customization)
          ? item.customization
          : {},
      }));
  } catch {
    return [];
  }
}

function saveCart(items) {
  try {
    localStorage.setItem(cartStorageKey, JSON.stringify(items));
  } catch {
    return false;
  }
  renderCart();
  renderCheckoutSummary();
  updateCartCounts();
  return true;
}

function money(amount) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
}

function updateCartCounts() {
  const count = readCart().reduce((sum, item) => sum + item.quantity, 0);
  document.querySelectorAll("[data-cart-count]").forEach((node) => { node.textContent = String(count); });
}

function productLineKey(item) {
  return `${item.slug}:${JSON.stringify(item.customization || {})}`;
}

function createTextElement(tagName, className, text) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  node.textContent = text;
  return node;
}

function renderCart() {
  if (!cartItemsNode) return;
  const items = readCart();
  const empty = document.querySelector("[data-cart-empty]");
  const checkoutLink = document.querySelector("[data-checkout-link]");
  const subtotalNode = document.querySelector("[data-cart-subtotal]");
  cartItemsNode.replaceChildren();
  if (empty) empty.hidden = items.length > 0;
  if (checkoutLink) checkoutLink.setAttribute("aria-disabled", String(items.length === 0));

  let subtotal = 0;
  for (const item of items) {
    const line = document.createElement("article");
    line.className = "cart-line";
    const copy = document.createElement("div");
    copy.append(createTextElement("h2", "cart-line-title", item.name || item.slug));
    for (const [key, value] of Object.entries(item.customization || {})) {
      const label = item.customizationLabels?.[key] || key;
      copy.append(createTextElement("p", "cart-line-custom", `${label}: ${String(value)}`));
    }
    const unitPrice = Number.isSafeInteger(item.priceAmount) ? item.priceAmount : 0;
    subtotal += unitPrice * item.quantity;
    copy.append(createTextElement("p", "cart-line-price", `${money(unitPrice)} per barang`));

    const controls = document.createElement("div");
    controls.className = "cart-line-controls";
    const quantity = document.createElement("label");
    quantity.className = "form-field quantity-field";
    quantity.append(document.createTextNode("Jumlah"));
    const input = document.createElement("input");
    input.type = "number";
    input.min = "1";
    input.max = "10";
    input.value = String(Math.min(item.quantity, 10));
    input.setAttribute("aria-label", `Jumlah ${item.name || item.slug}`);
    input.addEventListener("change", () => {
      const nextQuantity = Number(input.value);
      if (!Number.isInteger(nextQuantity) || nextQuantity < 1 || nextQuantity > 10) return;
      const current = readCart();
      const index = current.findIndex((entry) => productLineKey(entry) === productLineKey(item));
      if (index >= 0) current[index].quantity = nextQuantity;
      saveCart(current);
    });
    quantity.append(input);
    const remove = document.createElement("button");
    remove.className = "text-button";
    remove.type = "button";
    remove.textContent = "Hapus";
    remove.addEventListener("click", () => saveCart(readCart().filter((entry) => productLineKey(entry) !== productLineKey(item))));
    controls.append(quantity, remove);
    line.append(copy, controls);
    cartItemsNode.append(line);
  }
  if (subtotalNode) subtotalNode.textContent = money(subtotal);
}

document.querySelector("[data-checkout-link]")?.addEventListener("click", (event) => {
  if (!readCart().length) event.preventDefault();
});

function renderCheckoutSummary() {
  if (!checkoutItemsNode) return;
  const items = readCart();
  const subtotalNode = document.querySelector("[data-checkout-subtotal]");
  checkoutItemsNode.replaceChildren();
  let subtotal = 0;
  for (const item of items) {
    const price = Number.isSafeInteger(item.priceAmount) ? item.priceAmount : 0;
    subtotal += price * item.quantity;
    checkoutItemsNode.append(createTextElement("p", "summary-row", `${item.name || item.slug} × ${item.quantity}`));
  }
  if (subtotalNode) subtotalNode.textContent = money(subtotal);
  updateShippingSummary();
  scheduleShippingQuote();
}

let selectedDestination = null;
let selectedShipping = null;
let deliveryCoordinates = null;
let deliveryMap = null;
let deliveryMarker = null;
let destinationTimer = null;
let destinationController = null;
let quoteController = null;
let quoteTimer = null;
let quoteSequence = 0;

function currentSubtotal() {
  return readCart().reduce((sum, item) => sum + (Number.isSafeInteger(item.priceAmount) ? item.priceAmount : 0) * item.quantity, 0);
}

function updateShippingSummary() {
  const shippingNode = document.querySelector("[data-checkout-shipping]");
  const totalNode = document.querySelector("[data-checkout-total]");
  const shipping = Number(selectedShipping?.cost);
  if (shippingNode) shippingNode.textContent = Number.isSafeInteger(shipping) ? money(shipping) : "Belum dipilih";
  if (totalNode) totalNode.textContent = Number.isSafeInteger(shipping) ? money(currentSubtotal() + shipping) : "Belum dihitung";
}

function shippingItems() {
  return readCart().map(({ slug, quantity }) => ({ slug, quantity }));
}

function updateDeliveryPin(latitude, longitude) {
  deliveryCoordinates = { latitude, longitude };
  if (deliveryMarker) deliveryMarker.setLngLat([longitude, latitude]);
  else if (deliveryMap) {
    deliveryMarker = new maplibregl.Marker({ color: "#e87524", draggable: true })
      .setLngLat([longitude, latitude])
      .addTo(deliveryMap);
    deliveryMarker.on("dragend", () => {
      const point = deliveryMarker.getLngLat();
      updateDeliveryPin(point.lat, point.lng);
    });
  }
  const status = document.querySelector("[data-delivery-map-status]");
  if (status) status.textContent = `Pin tujuan dipilih: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}. Tarif Gojek sedang dihitung.`;
  scheduleShippingQuote();
}

function showDeliveryMap() {
  const panel = document.querySelector("[data-delivery-map-panel]");
  const mapNode = document.querySelector("[data-delivery-map]");
  if (!panel || !mapNode) return;
  panel.hidden = false;
  if (!deliveryMap && window.maplibregl) {
    deliveryMap = new maplibregl.Map({
      container: mapNode,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: [107.7430814, -6.9298300],
      zoom: 10,
    });
    deliveryMap.addControl(new maplibregl.NavigationControl(), "top-right");
    deliveryMap.on("click", (event) => updateDeliveryPin(event.lngLat.lat, event.lngLat.lng));
  }
  if (deliveryMap) {
    setTimeout(() => deliveryMap.resize(), 0);
  } else {
    const status = document.querySelector("[data-delivery-map-status]");
    if (status) status.textContent = "Peta gagal dimuat. Muat ulang halaman untuk memilih titik Gojek.";
  }
}

function scheduleShippingQuote() {
  const optionsNode = document.querySelector("[data-shipping-options]");
  if (!optionsNode) return;
  clearTimeout(quoteTimer);
  if (quoteController) quoteController.abort();
  quoteSequence += 1;
  selectedShipping = null;
  updateShippingSummary();
  const items = shippingItems();
  if (!selectedDestination || !items.length) {
    optionsNode.replaceChildren(createTextElement("p", "form-hint", "Tarif muncul setelah tujuan dan keranjang dipilih."));
    return;
  }
  optionsNode.replaceChildren(createTextElement("p", "form-hint", "Menghitung pilihan kurir…"));
  quoteTimer = setTimeout(() => loadShippingQuotes(items), 450);
}

function renderShippingRates(rates, optionsNode, requestSequence) {
  if (requestSequence !== quoteSequence) return;
  if (!rates.length) {
    optionsNode.replaceChildren(createTextElement("p", "form-hint", "Belum ada layanan kurir untuk tujuan ini."));
    return;
  }
  selectedShipping = rates[0];
  const fragment = document.createDocumentFragment();
  for (const rate of rates) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "shipping-option";
    button.setAttribute("aria-pressed", String(rate === selectedShipping));
    const title = createTextElement("strong", "shipping-option-title", `${rate.name} ${rate.service}`);
    const price = createTextElement("span", "shipping-option-price", money(rate.cost));
    const detail = createTextElement("small", "shipping-option-detail", [rate.description, rate.etd ? `Estimasi ${rate.etd}` : ""].filter(Boolean).join(" · "));
    button.append(title, price, detail);
    button.addEventListener("click", () => {
      selectedShipping = rate;
      optionsNode.querySelectorAll(".shipping-option").forEach((option) => option.setAttribute("aria-pressed", String(option === button)));
      updateShippingSummary();
    });
    fragment.append(button);
  }
  optionsNode.replaceChildren(fragment);
  updateShippingSummary();
}

async function loadShippingQuotes(items) {
  if (!selectedDestination) return;
  const requestSequence = ++quoteSequence;
  const optionsNode = document.querySelector("[data-shipping-options]");
  if (previewMode) {
    const distanceFee = selectedDestination.id === "demo-jaksel" ? 7000 : 0;
    const rates = [
      { name: "JNE", code: "jne", service: "REG", cost: 12000 + distanceFee, description: "Tarif simulasi", etd: "2–3 hari" },
      { name: "J&T", code: "jnt", service: "EZ", cost: 14000 + distanceFee, description: "Tarif simulasi", etd: "2–3 hari" },
      { name: "SiCepat", code: "sicepat", service: "REG", cost: 15000 + distanceFee, description: "Tarif simulasi", etd: "2–3 hari" },
      { name: "AnterAja", code: "anteraja", service: "Reguler", cost: 13000 + distanceFee, description: "Tarif simulasi", etd: "2–4 hari" },
    ];
    if (deliveryCoordinates) rates.push({ name: "Gojek", code: "gojek", service: "Same Day", cost: 22000, description: "Tarif simulasi dari titik peta", etd: "Hari ini" });
    rates.sort((a, b) => a.cost - b.cost);
    renderShippingRates(rates, optionsNode, requestSequence);
    return;
  }

  quoteController = new AbortController();
  try {
    const response = await fetch(`${apiBaseUrl}/api/shipping/quotes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        destination_id: selectedDestination.id,
        latitude: deliveryCoordinates?.latitude,
        longitude: deliveryCoordinates?.longitude,
        items,
      }),
      signal: quoteController.signal,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Tarif ongkir belum berhasil dimuat.");
    const rates = (Array.isArray(result.data) ? result.data : [])
      .filter((rate) => rate && Number.isSafeInteger(rate.cost) && rate.cost >= 0 && rate.code && rate.service)
      .sort((a, b) => a.cost - b.cost || String(a.name).localeCompare(String(b.name)));
    renderShippingRates(rates, optionsNode, requestSequence);
  } catch (error) {
    if (error.name === "AbortError" || requestSequence !== quoteSequence) return;
    optionsNode.replaceChildren(createTextElement("p", "form-hint is-error", error.message || "Tarif ongkir belum berhasil dimuat."));
    selectedShipping = null;
    updateShippingSummary();
  }
}

const destinationInput = document.querySelector("[data-shipping-destination]");
const destinationResults = document.querySelector("[data-shipping-destinations]");
const destinationStatus = document.querySelector("[data-shipping-destination-status]");
if (destinationInput && destinationResults) {
  async function searchDestinations(query) {
    if (destinationController) destinationController.abort();
    destinationController = new AbortController();
    try {
      let locations;
      if (previewMode) {
        const normalizedQuery = query.toLocaleLowerCase("id-ID");
        locations = previewDestinations.filter((location) => location.label.toLocaleLowerCase("id-ID").includes(normalizedQuery));
      } else {
        const response = await fetch(`${apiBaseUrl}/api/shipping/destinations?search=${encodeURIComponent(query)}`, { signal: destinationController.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Pencarian tujuan belum berhasil.");
        locations = Array.isArray(result.data) ? result.data : [];
      }
      destinationResults.replaceChildren();
      if (!locations.length) {
        destinationResults.append(createTextElement("p", "form-hint", "Tujuan tidak ditemukan. Coba nama kecamatan atau kelurahan."));
      }
      for (const location of locations) {
        const option = document.createElement("button");
        option.type = "button";
        option.role = "option";
        option.textContent = location.label;
        option.addEventListener("click", () => {
          selectedDestination = { id: String(location.id), label: location.label };
          deliveryCoordinates = null;
          deliveryMarker?.remove();
          deliveryMarker = null;
          destinationInput.value = location.label;
          destinationResults.hidden = true;
          destinationResults.replaceChildren();
          destinationStatus.textContent = `Tujuan dipilih: ${location.label}`;
          const mapStatus = document.querySelector("[data-delivery-map-status]");
          if (mapStatus) mapStatus.textContent = "Pin tujuan belum dipilih.";
          showDeliveryMap();
          scheduleShippingQuote();
        });
        destinationResults.append(option);
      }
      destinationResults.hidden = false;
    } catch (error) {
      if (error.name === "AbortError") return;
      destinationResults.replaceChildren(createTextElement("p", "form-hint is-error", error.message));
      destinationResults.hidden = false;
    }
  }

  destinationInput.addEventListener("input", () => {
    selectedDestination = null;
    deliveryCoordinates = null;
    deliveryMarker?.remove();
    deliveryMarker = null;
    const mapPanel = document.querySelector("[data-delivery-map-panel]");
    if (mapPanel) mapPanel.hidden = true;
    selectedShipping = null;
    destinationStatus.textContent = "Pilih tujuan dari saran pencarian.";
    scheduleShippingQuote();
    clearTimeout(destinationTimer);
    const query = destinationInput.value.trim();
    if (query.length < 3) {
      destinationResults.hidden = true;
      destinationResults.replaceChildren();
      return;
    }
    destinationTimer = setTimeout(() => searchDestinations(query), 350);
  });
  destinationInput.addEventListener("focus", () => {
    const query = destinationInput.value.trim();
    if (!selectedDestination && query.length >= 3) searchDestinations(query);
  });
  document.addEventListener("click", (event) => {
    if (event.target !== destinationInput && !destinationResults.contains(event.target)) destinationResults.hidden = true;
  });
}

function showMessage(node, message, isError = false) {
  if (!node) return;
  node.textContent = message;
  node.classList.toggle("is-error", isError);
}

document.querySelectorAll("[data-product-form]").forEach((form) => {
  form.querySelectorAll('[data-uppercase="true"]').forEach((input) => {
    input.addEventListener("input", () => {
      const start = input.selectionStart;
      const end = input.selectionEnd;
      input.value = input.value.toLocaleUpperCase("id-ID");
      if (start !== null && end !== null) input.setSelectionRange(start, end);
    });
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const customization = {};
    form.querySelectorAll("[data-custom-key]").forEach((input) => {
      customization[input.dataset.customKey] = input.value.trim();
    });
    const item = {
      slug: form.dataset.productSlug,
      name: form.dataset.productName,
      priceAmount: Number(form.dataset.productPrice),
      quantity: Number(new FormData(form).get("quantity")),
      customization,
      customizationLabels: Object.fromEntries([...form.querySelectorAll("[data-custom-key]")]
        .map((input) => [input.dataset.customKey, input.dataset.customLabel || input.dataset.customKey])),
    };
    const cart = readCart();
    const key = productLineKey(item);
    const existing = cart.find((entry) => productLineKey(entry) === key);
    if (existing) {
      if (existing.quantity + item.quantity > 10) {
        showMessage(form.querySelector("[data-form-message]"), "Maksimal 10 produk untuk pilihan custom ini.", true);
        return;
      }
      existing.quantity += item.quantity;
    } else {
      if (cart.length >= 20) {
        showMessage(form.querySelector("[data-form-message]"), "Keranjang maksimal 20 pilihan produk.", true);
        return;
      }
      cart.push(item);
    }
    if (saveCart(cart)) {
      showMessage(form.querySelector("[data-form-message]"), "Produk masuk ke keranjang.");
    } else {
      showMessage(form.querySelector("[data-form-message]"), "Penyimpanan keranjang tidak tersedia di browser ini.", true);
    }
  });
});

let idempotencyKey = null;
let paymentExpiresAt = null;
let paymentExpiryTimer = null;
let paymentProofSubmitted = false;
const checkoutForm = document.querySelector("[data-checkout-form]");
if (checkoutForm) {
  const submitButton = checkoutForm.querySelector('button[type="submit"]');
  const messageNode = checkoutForm.querySelector("[data-checkout-message]");
  checkoutForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!checkoutForm.reportValidity()) return;
    if (!selectedDestination) {
      showMessage(messageNode, "Pilih tujuan pengiriman dari saran pencarian.", true);
      destinationInput?.focus();
      return;
    }
    if (!selectedShipping) {
      showMessage(messageNode, "Pilih layanan kurir setelah tarif berhasil dimuat.", true);
      document.querySelector("[data-shipping-options]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const items = readCart();
    if (!items.length) {
      showMessage(messageNode, "Keranjang masih kosong. Tambahkan produk terlebih dahulu.", true);
      return;
    }
    const formData = new FormData(checkoutForm);
    const payload = {
      customer: {
        name: String(formData.get("name") || "").trim(),
        phone: String(formData.get("phone") || "").trim(),
        email: String(formData.get("email") || "").trim(),
        address: String(formData.get("address") || "").trim(),
        note: String(formData.get("note") || "").trim(),
      },
      shipping: {
        destination_id: selectedDestination.id,
        destination_label: selectedDestination.label,
        courier_code: selectedShipping.code,
        service: selectedShipping.service,
        ...(selectedShipping.code === "gojek" && deliveryCoordinates
          ? { latitude: deliveryCoordinates.latitude, longitude: deliveryCoordinates.longitude }
          : {}),
      },
      items: items.map(({ slug, quantity, customization }) => ({ slug, quantity, customization: customization || {} })),
    };

    if (previewMode) {
      const paymentReference = `DEMO-${crypto.randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`;
      const success = document.querySelector("[data-order-success]");
      const layout = document.querySelector("[data-checkout-layout]");
      const proofForm = document.querySelector("[data-proof-form]");
      success.hidden = false;
      layout.hidden = true;
      document.querySelector("[data-order-code]").textContent = paymentReference;
      document.querySelector("[data-order-total]").textContent = money(currentSubtotal() + selectedShipping.cost);
      document.querySelector("[data-order-message]").textContent = "Pesanan demo tersimpan di halaman ini saja. Tidak ada pesanan atau pembayaran yang dikirim ke toko.";
      const deadlineNode = document.querySelector("[data-payment-deadline]");
      if (deadlineNode) deadlineNode.textContent = "Mode demo: tidak ada pembayaran sungguhan.";
      if (proofForm) {
        proofForm.elements.payment_reference.value = paymentReference;
        proofForm.elements.phone.value = payload.customer.phone;
      }
      try {
        const storedOrders = JSON.parse(sessionStorage.getItem("ruma-demo-orders-v1") || "[]");
        const demoOrders = Array.isArray(storedOrders) ? storedOrders : [];
        demoOrders.push({
          public_code: paymentReference,
          phone: payload.customer.phone.replace(/\D/g, ""),
          order_status: "new",
          payment_status: "pending",
          production_status: "pending",
          shipment_status: "pending",
          history: [{ status_type: "order", new_status: "new", created_at: new Date().toISOString() }],
        });
        sessionStorage.setItem("ruma-demo-orders-v1", JSON.stringify(demoOrders.slice(-10)));
      } catch {
        // Demo tracking is optional if browser storage is disabled.
      }
      saveCart([]);
      return;
    }

    if (!idempotencyKey) idempotencyKey = crypto.randomUUID();
    submitButton.disabled = true;
    showMessage(messageNode, "Menyimpan pesanan…");
    try {
      const response = await fetch(`${apiBaseUrl}/api/orders`, {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Pesanan belum berhasil disimpan.");

      const success = document.querySelector("[data-order-success]");
      const layout = document.querySelector("[data-checkout-layout]");
      success.hidden = false;
      layout.hidden = true;
      const paymentReference = result.data.payment_reference || result.data.order_code;
      document.querySelector("[data-order-code]").textContent = paymentReference;
      document.querySelector("[data-order-total]").textContent = money(result.data.total_amount);
      document.querySelector("[data-order-message]").textContent = result.message;
      paymentExpiresAt = result.data.payment_expires_at || null;
      paymentProofSubmitted = false;
      const deadlineNode = document.querySelector("[data-payment-deadline]");
      const proofForm = document.querySelector("[data-proof-form]");
      const renderDeadline = () => {
        if (!deadlineNode || !paymentExpiresAt) return;
        const deadline = new Date(paymentExpiresAt);
        const remaining = deadline.getTime() - Date.now();
        if (remaining <= 0) {
          deadlineNode.textContent = "Pembayaran telah kedaluwarsa. Pesanan tanpa bukti akan dihapus.";
          deadlineNode.classList.add("is-error");
          if (!paymentProofSubmitted && proofForm) proofForm.hidden = true;
          if (paymentExpiryTimer) clearInterval(paymentExpiryTimer);
          return;
        }
        deadlineNode.textContent = `Batas pembayaran: ${deadline.toLocaleString("id-ID")}.`;
      };
      renderDeadline();
      if (paymentExpiryTimer) clearInterval(paymentExpiryTimer);
      paymentExpiryTimer = window.setInterval(renderDeadline, 30_000);
      proofForm.elements.payment_reference.value = paymentReference;
      proofForm.elements.phone.value = payload.customer.phone;
      idempotencyKey = null;
      saveCart([]);
    } catch (error) {
      showMessage(messageNode, error instanceof TypeError
        ? "API tidak dapat dijangkau. Pastikan Worker lokal sedang berjalan."
        : error.message, true);
      submitButton.disabled = false;
    }
  });
}

const proofForm = document.querySelector("[data-proof-form]");
if (proofForm) {
  const submitProofButton = proofForm.querySelector('button[type="submit"]');
  const proofMessage = proofForm.querySelector("[data-proof-message]");
  proofForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!proofForm.reportValidity()) return;
    const file = proofForm.elements.proof.files?.[0];
    if (!file || file.size < 1 || file.size > 5 * 1024 * 1024) {
      showMessage(proofMessage, "Pilih gambar berukuran maksimal 5 MB.", true);
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      showMessage(proofMessage, "Format bukti harus JPG, PNG, atau WebP.", true);
      return;
    }
    if (previewMode) {
      paymentProofSubmitted = true;
      showMessage(proofMessage, "Bukti simulasi diterima di browser. File tidak diunggah.");
      submitProofButton.textContent = "Bukti simulasi";
      submitProofButton.disabled = true;
      proofForm.elements.proof.disabled = true;
      return;
    }
    submitProofButton.disabled = true;
    showMessage(proofMessage, "Mengirim bukti pembayaran…");
    try {
      const response = await fetch(`${apiBaseUrl}/api/orders/proof`, {
        method: "POST",
        body: new FormData(proofForm),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Bukti belum berhasil dikirim.");
      paymentProofSubmitted = true;
      showMessage(proofMessage, `${result.message || "Bukti transfer tersimpan."} Admin menargetkan pemeriksaan maksimal 1 × 24 jam. Jika bukti ditolak, hubungi admin melalui WhatsApp.`);
      submitProofButton.textContent = "Bukti terkirim";
      submitProofButton.disabled = true;
      proofForm.elements.proof.disabled = true;
    } catch (error) {
      showMessage(proofMessage, error instanceof TypeError ? "API tidak dapat dijangkau. Coba lagi nanti." : error.message, true);
      submitProofButton.disabled = false;
    }
  });
}

updateCartCounts();
renderCart();
renderCheckoutSummary();
