const form = document.querySelector("[data-tracking-form]");
const messageNode = document.querySelector("[data-tracking-message]");
const resultsNode = document.querySelector("[data-tracking-results]");
const apiBaseUrl = document.currentScript?.dataset.apiBase || "";
const previewMode = document.currentScript?.dataset.previewMode === "true";
const chatHref = document.querySelector(".footer-contact")?.href || "";

const labels = {
  order: { new: "Pesanan diterima", accepted: "Pesanan diproses", completed: "Pesanan selesai", cancelled: "Pesanan dibatalkan" },
  payment: { pending: "Menunggu pembayaran", paid: "Pembayaran terverifikasi", failed: "Pembayaran gagal", refunded: "Pembayaran dikembalikan" },
  production: { pending: "Menunggu produksi", in_progress: "Sedang diproduksi", completed: "Produksi selesai", cancelled: "Produksi dibatalkan" },
  shipment: { pending: "Menunggu pengiriman", shipped: "Dalam perjalanan", delivered: "Pesanan diterima", failed: "Pengiriman bermasalah", returned: "Paket dikembalikan" },
};

function showMessage(message, isError = false) {
  messageNode.textContent = message;
  messageNode.classList.toggle("is-error", isError);
}

function addText(parent, tagName, className, text) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  node.textContent = text;
  parent.append(node);
  return node;
}

function statusLabel(type, status) {
  return labels[type]?.[status] || "Belum tersedia";
}

function addChatLink(parent, message) {
  if (!chatHref) return;
  const link = document.createElement("a");
  const target = new URL(chatHref);
  target.searchParams.set("text", message);
  link.href = target.href;
  link.className = "button button-secondary";
  link.textContent = "Chat WhatsApp";
  parent.append(link);
}

async function submitRefundRequest(order, credentials, button, statusNode) {
  button.disabled = true;
  statusNode.textContent = "Mengirim permintaan ke admin…";
  try {
    const response = await fetch(`${apiBaseUrl}/api/orders/cancellation`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      referrerPolicy: "no-referrer",
      body: JSON.stringify({ order_code: order.public_code, phone: credentials.phone }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Permintaan belum berhasil dikirim.");
    order.refund_status = result.data?.status || "requested";
    order.refund_requested_at = new Date().toISOString();
    order.can_request_refund = false;
    renderStatus(order, credentials);
    showMessage(result.message || "Permintaan refund dikirim ke admin.");
  } catch (error) {
    statusNode.textContent = error instanceof Error ? error.message : "Koneksi bermasalah. Coba lagi.";
    if (statusNode.textContent.toLocaleLowerCase("id-ID").includes("chat")) {
      addChatLink(statusNode.parentElement, `Halo, saya ingin koordinasi pembatalan/refund pesanan ${order.public_code}.`);
    }
    button.disabled = false;
  }
}

function renderStatus(order, credentials = {}) {
  resultsNode.replaceChildren();
  resultsNode.hidden = false;
  const summary = document.createElement("article");
  summary.className = "tracking-card";
  addText(summary, "p", "eyebrow", "Kode pesanan");
  addText(summary, "h2", "tracking-order-code", order.public_code);
  const statusGrid = document.createElement("dl");
  statusGrid.className = "tracking-status-grid";
  for (const [label, value] of [
    ["Pesanan", statusLabel("order", order.order_status)],
    ["Pembayaran", statusLabel("payment", order.payment_status)],
    ["Produksi", statusLabel("production", order.production_status)],
    ["Pengiriman", statusLabel("shipment", order.shipment_status || "pending")],
  ]) {
    const group = document.createElement("div");
    addText(group, "dt", "", label);
    addText(group, "dd", "", value);
    statusGrid.append(group);
  }
  summary.append(statusGrid);
  if (order.payment_expired) {
    addText(summary, "p", "form-message is-error", "Pembayaran telah kedaluwarsa. Pesanan tanpa bukti pembayaran akan dihapus.");
  }
  if (order.refund_status === "requested") {
    addText(summary, "p", "form-hint", "Permintaan pembatalan/refund sudah dikirim. Admin akan meninjaunya.");
  } else if (order.refund_status === "approved") {
    const due = order.refund_due_at ? new Date(order.refund_due_at).toLocaleString("id-ID") : "maksimal 3 × 24 jam";
    addText(summary, "p", "form-hint", `Refund disetujui. Admin menargetkan pengiriman ke rekening asal sebelum ${due}.`);
  } else if (order.refund_status === "processed") {
    addText(summary, "p", "form-hint", "Refund telah diproses ke rekening asal. Hubungi admin melalui chat jika perlu koordinasi.");
    addChatLink(summary, `Halo, saya ingin koordinasi refund pesanan ${order.public_code}.`);
  } else if (order.can_request_refund) {
    const statusNode = addText(summary, "p", "form-hint", "Pesanan belum mulai diproduksi. Refund dapat diajukan ke rekening asal pembayaran.");
    const requestButton = document.createElement("button");
    requestButton.type = "button";
    requestButton.className = "button button-secondary";
    requestButton.textContent = "Ajukan pembatalan dan refund";
    requestButton.addEventListener("click", () => submitRefundRequest(order, credentials, requestButton, statusNode));
    summary.append(requestButton);
  } else if (order.payment_status === "failed" || (order.payment_status === "paid" && order.production_status !== "pending")) {
    addText(summary, "p", "form-hint", order.payment_status === "failed"
      ? "Bukti transfer ditolak. Hubungi admin melalui chat; bukti tidak dapat diunggah ulang."
      : "Produksi sudah dimulai. Refund tidak tersedia; hubungi admin melalui chat untuk koordinasi.");
    addChatLink(summary, `Halo, saya ingin koordinasi pesanan ${order.public_code}.`);
  }
  if (order.tracking_number) {
    const shipment = document.createElement("p");
    shipment.className = "tracking-shipment";
    shipment.append(document.createTextNode(`${order.carrier || "Kurir"} · Resi ${order.tracking_number}`));
    if (order.tracking_url?.startsWith("https://")) {
      shipment.append(document.createTextNode(" · "));
      const link = document.createElement("a");
      link.href = order.tracking_url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Lihat tracking kurir";
      shipment.append(link);
    }
    summary.append(shipment);
  }
  resultsNode.append(summary);

  const history = document.createElement("section");
  history.className = "tracking-card tracking-timeline";
  addText(history, "h2", "", "Perkembangan");
  const events = Array.isArray(order.history) ? order.history : [];
  if (!events.length) addText(history, "p", "form-hint", "Belum ada pembaruan.");
  const list = document.createElement("ol");
  for (const event of events) {
    const item = document.createElement("li");
    addText(item, "strong", "", statusLabel(event.status_type, event.new_status));
    const time = addText(item, "time", "", event.created_at || "");
    if (event.created_at) {
      const parsed = new Date(event.created_at);
      if (!Number.isNaN(parsed.valueOf())) time.dateTime = parsed.toISOString();
    }
    list.append(item);
  }
  history.append(list);
  resultsNode.append(history);
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  resultsNode.hidden = true;
  showMessage("Mencari pesanan…");
  try {
    const payload = Object.fromEntries(new FormData(form));
    payload.order_code = String(payload.order_code).trim().toUpperCase();
    if (previewMode) {
      let demoOrders = [];
      try {
        const storedOrders = JSON.parse(sessionStorage.getItem("ruma-demo-orders-v1") || "[]");
        if (Array.isArray(storedOrders)) demoOrders = storedOrders;
      } catch {
        // Treat unavailable or invalid local demo data as no matching order.
      }
      const phone = String(payload.phone).replace(/\D/g, "");
      const order = demoOrders.find((item) => item.public_code === payload.order_code && item.phone === phone);
      if (!order) throw new Error("Pesanan demo tidak ditemukan di browser ini. Buat pesanan demo baru lewat checkout.");
      renderStatus(order, payload);
      showMessage("Status pesanan demo ditemukan. Ini hanya simulasi.");
      return;
    }
    const response = await fetch(`${apiBaseUrl}/api/orders/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      referrerPolicy: "no-referrer",
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Status pesanan belum dapat dimuat.");
    renderStatus(result.data, payload);
    showMessage("Status pesanan ditemukan.");
  } catch (error) {
    showMessage(error instanceof Error ? error.message : "Koneksi bermasalah. Coba lagi.", true);
  } finally {
    submit.disabled = false;
  }
});
