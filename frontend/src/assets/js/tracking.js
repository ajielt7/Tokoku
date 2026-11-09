const form = document.querySelector("[data-tracking-form]");
const messageNode = document.querySelector("[data-tracking-message]");
const resultsNode = document.querySelector("[data-tracking-results]");
const apiBaseUrl = document.currentScript?.dataset.apiBase || "";

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

function renderStatus(order) {
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
    const response = await fetch(`${apiBaseUrl}/api/orders/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      referrerPolicy: "no-referrer",
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Status pesanan belum dapat dimuat.");
    renderStatus(result.data);
    showMessage("Status pesanan ditemukan.");
  } catch (error) {
    showMessage(error instanceof Error ? error.message : "Koneksi bermasalah. Coba lagi.", true);
  } finally {
    submit.disabled = false;
  }
});
