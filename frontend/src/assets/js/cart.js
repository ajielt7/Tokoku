const cartStorageKey = "ruma-cart-v1";
const cartItemsNode = document.querySelector("[data-cart-items]");
const checkoutItemsNode = document.querySelector("[data-checkout-items]");
const apiBaseUrl = document.currentScript?.dataset.apiBase?.replace(/\/$/, "") || "http://127.0.0.1:8787";
const previewMode = document.currentScript?.dataset.previewMode === "true";

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
    checkoutItemsNode.append(createTextElement("p", "summary-row", `${item.name || item.slug} Ã— ${item.quantity}`));
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
let shippingPickerExpanded = false;
let showAllShippingCouriers = false;
let activeShippingCourier = null;
const shippingCourierOrder = ["gojek", "jne", "jnt", "spx", "sicepat", "wahana", "anteraja"];
const shippingCourierNames = {
  gojek: "Gojek",
  jne: "JNE",
  jnt: "J&T",
  spx: "SPX",
  sicepat: "SiCepat",
  wahana: "Wahana",
  anteraja: "Anteraja",
};

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
  shippingPickerExpanded = false;
  showAllShippingCouriers = false;
  activeShippingCourier = null;
  updateShippingSummary();
  const items = shippingItems();
  if (!selectedDestination || !items.length) {
    optionsNode.replaceChildren(createTextElement("p", "form-hint", "Tarif muncul setelah tujuan dan keranjang dipilih."));
    return;
  }
  optionsNode.replaceChildren(createTextElement("p", "form-hint", "Menghitung pilihan kurirâ€¦"));
  quoteTimer = setTimeout(() => loadShippingQuotes(items), 450);
}

function renderShippingRates(rates, optionsNode, requestSequence) {
  if (requestSequence !== quoteSequence) return;
  if (!rates.length) {
    optionsNode.replaceChildren(createTextElement("p", "form-hint", "Belum ada layanan kurir untuk tujuan ini."));
    return;
  }
  selectedShipping = rates[0];
  shippingPickerExpanded = false;
  showAllShippingCouriers = false;
  activeShippingCourier = null;
  renderShippingPicker(rates, optionsNode);
}

function shippingRateDetail(rate) {
  return [rate.description, rate.etd ? `Estimasi ${rate.etd}` : ""].filter(Boolean).join(" Â· ");
}

function shippingRateButton(rate, { selected = false, compact = false } = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `shipping-option${selected ? " shipping-option--selected" : ""}${compact ? " shipping-option--compact" : ""}`;
  if (selected) button.setAttribute("aria-pressed", "true");
  button.append(
    createTextElement("strong", "shipping-option-title", `${rate.name} ${rate.service}`),
    createTextElement("span", "shipping-option-price", money(rate.cost)),
    createTextElement("small", "shipping-option-detail", shippingRateDetail(rate)),
  );
  return button;
}

function shippingRateGroups(rates) {
  const grouped = new Map();
  for (const rate of rates) {
    const code = String(rate.code).toLowerCase();
    if (!grouped.has(code)) grouped.set(code, []);
    grouped.get(code).push(rate);
  }
  return [...grouped.entries()]
    .map(([code, services]) => ({ code, name: shippingCourierNames[code] || services[0].name, services }))
    .sort((a, b) => shippingCourierOrder.indexOf(a.code) - shippingCourierOrder.indexOf(b.code));
}

function renderShippingPicker(rates, optionsNode) {
  const groups = shippingRateGroups(rates);
  const selected = shippingRateButton(selectedShipping, { selected: true });
  selected.setAttribute("aria-expanded", String(shippingPickerExpanded));
  selected.append(createTextElement("small", "shipping-option-change", shippingPickerExpanded ? "Tutup pilihan" : "Ubah pilihan"));
  selected.addEventListener("click", () => {
    shippingPickerExpanded = !shippingPickerExpanded;
    activeShippingCourier = null;
    renderShippingPicker(rates, optionsNode);
  });
  const fragment = document.createDocumentFragment();
  fragment.append(selected);

  if (shippingPickerExpanded) {
    const picker = document.createElement("div");
    picker.className = "shipping-picker";
    if (activeShippingCourier) {
      const group = groups.find((item) => item.code === activeShippingCourier);
      if (group) {
        const heading = createTextElement("h3", "shipping-picker-title", `Pilih paket ${group.name}`);
        const back = document.createElement("button");
        back.type = "button";
        back.className = "shipping-picker-back";
        back.textContent = "Kembali ke daftar kurir";
        back.addEventListener("click", () => {
          activeShippingCourier = null;
          renderShippingPicker(rates, optionsNode);
        });
        picker.append(heading, back);
        for (const rate of group.services) {
          const option = shippingRateButton(rate, { compact: true });
          option.addEventListener("click", () => {
            selectedShipping = rate;
            shippingPickerExpanded = false;
            activeShippingCourier = null;
            renderShippingPicker(rates, optionsNode);
            updateShippingSummary();
          });
          picker.append(option);
        }
      }
    } else {
      const visibleGroups = showAllShippingCouriers ? groups : groups.slice(0, 4);
      for (const group of visibleGroups) {
        const cheapest = group.services[0];
        const button = document.createElement("button");
        button.type = "button";
        button.className = "shipping-courier-option";
        const serviceLabel = group.services.length > 1
          ? `Mulai ${money(cheapest.cost)} Â· ${group.services.length} pilihan paket`
          : `${cheapest.service} Â· ${money(cheapest.cost)}`;
        button.append(
          createTextElement("strong", "shipping-courier-name", group.name),
          createTextElement("span", "shipping-courier-price", money(cheapest.cost)),
          createTextElement("small", "shipping-courier-detail", serviceLabel),
        );
        button.addEventListener("click", () => {
          activeShippingCourier = group.code;
          renderShippingPicker(rates, optionsNode);
        });
        picker.append(button);
      }
      if (!showAllShippingCouriers && groups.length > 4) {
        const showAll = document.createElement("button");
        showAll.type = "button";
        showAll.className = "shipping-picker-more";
        showAll.textContent = "Lihat semua kurir";
        showAll.addEventListener("click", () => {
          showAllShippingCouriers = true;
          renderShippingPicker(rates, optionsNode);
        });
        picker.append(showAll);
      } else if (showAllShippingCouriers && groups.length > 4) {
        const showLess = document.createElement("button");
        showLess.type = "button";
        showLess.className = "shipping-picker-more";
        showLess.textContent = "Tampilkan 4 kurir";
        showLess.addEventListener("click", () => {
          showAllShippingCouriers = false;
          renderShippingPicker(rates, optionsNode);
        });
        picker.append(showLess);
      }
    }
    fragment.append(picker);
  }
  optionsNode.replaceChildren(fragment);
  updateShippingSummary();
}

async function loadShippingQuotes(items) {
  if (!selectedDestination) return;
  const requestSequence = ++quoteSequence;
  const optionsNode = document.querySelector("[data-shipping-options]");
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
      const response = await fetch(`${apiBaseUrl}/api/shipping/destinations?search=${encodeURIComponent(query)}`, { signal: destinationController.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Pencarian tujuan belum berhasil.");
      const locations = Array.isArray(result.data) ? result.data : [];
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
    if (previewMode) {
      showMessage(messageNode, "Checkout pesanan nyata belum tersedia pada build lokal ini. Buka website online untuk mengirim pesanan.", true);
      return;
    }
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

    if (!idempotencyKey) idempotencyKey = crypto.randomUUID();
    submitButton.disabled = true;
    showMessage(messageNode, "Menyimpan pesananâ€¦");
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
      showMessage(proofMessage, "Unggah bukti hanya tersedia pada website online dengan pesanan nyata.", true);
      return;
    }
    submitProofButton.disabled = true;
    showMessage(proofMessage, "Mengirim bukti pembayaranâ€¦");
    try {
      const response = await fetch(`${apiBaseUrl}/api/orders/proof`, {
        method: "POST",
        body: new FormData(proofForm),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Bukti belum berhasil dikirim.");
      paymentProofSubmitted = true;
      showMessage(proofMessage, `${result.message || "Bukti transfer tersimpan."} Admin menargetkan pemeriksaan maksimal 1 Ã— 24 jam. Jika bukti ditolak, hubungi admin melalui WhatsApp.`);
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

