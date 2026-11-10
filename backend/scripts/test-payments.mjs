import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wranglerCli = path.join(backendDirectory, "node_modules", "wrangler", "bin", "wrangler.js");
const testRunId = `${process.pid}-${Date.now()}`;
const stateDirectory = path.join(backendDirectory, ".wrangler", `payment-test-${testRunId}`);
const testEnvFile = path.join(backendDirectory, ".wrangler", `payment-test-${testRunId}.env`);
const apiBaseUrl = process.env.PAYMENT_TEST_API_URL || "http://127.0.0.1:8791";
const browserOrigin = "http://localhost:5500";
const adminToken = "local-test-admin-token-not-for-production-0000000000000000";
const childEnvironment = { ...process.env };
delete childEnvironment.ADMIN_TOKEN;
delete childEnvironment.IMAGEKIT_PRIVATE_KEY;
delete childEnvironment.RAJAONGKIR_API_KEY;
delete childEnvironment.FCM_PROJECT_ID;
delete childEnvironment.FCM_SERVICE_ACCOUNT_EMAIL;
delete childEnvironment.FCM_PRIVATE_KEY;

function runWrangler(args) {
  const result = spawnSync(process.execPath, [wranglerCli, ...args], {
    cwd: backendDirectory,
    env: childEnvironment,
    encoding: "utf8",
    timeout: 120_000,
  });
  if (result.status !== 0) {
    throw new Error(`Perintah Wrangler gagal (${result.status}).\n${result.stdout}\n${result.stderr}`);
  }
}

async function waitForWorker(worker) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (worker.exitCode !== null) throw new Error(`Worker lokal berhenti dengan kode ${worker.exitCode}.`);
    try {
      const response = await fetch(`${apiBaseUrl}/api/health`, { signal: AbortSignal.timeout(1500) });
      if (response.ok) return;
    } catch { /* Wrangler is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Worker test lokal tidak siap dalam 30 detik.");
}

async function requestJson(pathname, { method = "GET", body, headers = {} } = {}) {
  const response = await fetch(`${apiBaseUrl}${pathname}`, {
    method,
    headers: {
      origin: browserOrigin,
      ...(body instanceof FormData ? {} : { "content-type": "application/json" }),
      ...headers,
    },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  let payload = {};
  try { payload = await response.json(); } catch { /* Report the HTTP status below. */ }
  return { response, payload };
}

function adminHeaders() {
  return { authorization: `Bearer ${adminToken}` };
}

async function createOrder() {
  const body = {
    customer: {
      name: "Pelanggan Uji Lokal",
      phone: "081234567890",
      email: "",
      address: "Jalan Contoh Nomor 1, Bandung",
      note: "",
    },
    shipping: {
      destination_id: "101",
      destination_label: "Kelurahan Uji, Kecamatan Uji, Kota Bandung",
      courier_code: "jne",
      service: "REG",
    },
    items: [{
      slug: "nomor-rumah-uji",
      quantity: 1,
      customization: { house_number: "a01", area_name: "Kampung A" },
    }],
  };
  const { response, payload } = await requestJson("/api/orders", {
    method: "POST",
    body,
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });
  assert.equal(response.status, 201, JSON.stringify(payload));
  assert.equal(payload.data.total_amount, 60_000);
  assert.ok(Date.parse(payload.data.payment_expires_at) > Date.now());
  return { code: payload.data.order_code, phone: body.customer.phone };
}

async function uploadProof(order) {
  const form = new FormData();
  form.set("payment_reference", order.code);
  form.set("phone", order.phone);
  form.set("proof", new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: "image/png" }), "proof.png");
  const { response, payload } = await requestJson("/api/orders/proof", { method: "POST", body: form });
  return { response, payload };
}

async function reviewPayment(order, decision) {
  const { response, payload } = await requestJson(`/api/admin/payments/${order.code}/review`, {
    method: "POST",
    headers: adminHeaders(),
    body: { decision, note: "Simulasi lokal" },
  });
  assert.equal(response.status, 200, JSON.stringify(payload));
  return payload.data;
}

async function trackOrder(order) {
  return requestJson("/api/orders/status", {
    method: "POST",
    body: { order_code: order.code, phone: order.phone },
  });
}

async function setOrderExpired(order) {
  runWrangler([
    "d1", "execute", "ruma-store-test-local", "--local", "--persist-to", stateDirectory,
    "--config", "wrangler.jsonc", "--env", "test", "--env-file", testEnvFile,
    "--command", `UPDATE orders SET payment_expires_at = '2000-01-01T00:00:00.000Z' WHERE public_code = '${order.code}'`,
  ]);
  const expiredStatus = await trackOrder(order);
  assert.equal(expiredStatus.response.status, 200);
  assert.equal(expiredStatus.payload.data.payment_expired, true, "Fixture harus kedaluwarsa di database yang dipakai Worker.");
}

async function run() {
  let worker;
  try {
    await mkdir(path.dirname(testEnvFile), { recursive: true });
    await writeFile(testEnvFile, [
      `ADMIN_TOKEN=${adminToken}`,
      "IMAGEKIT_PRIVATE_KEY=local-test-key-not-a-secret",
      "TEST_PAYMENT_PROOF_STORAGE=memory",
      "\n",
    ].join("\n"), { mode: 0o600 });

    runWrangler([
      "d1", "migrations", "apply", "ruma-store-test-local", "--local", "--persist-to", stateDirectory,
      "--config", "wrangler.jsonc", "--env", "test", "--env-file", testEnvFile,
    ]);
    runWrangler([
      "d1", "execute", "ruma-store-test-local", "--local", "--persist-to", stateDirectory,
      "--file", "seeds/payment-test.sql",
      "--config", "wrangler.jsonc", "--env", "test", "--env-file", testEnvFile,
    ]);

    worker = spawn(process.execPath, [
      wranglerCli, "dev",
      "--local", "--ip", "127.0.0.1", "--port", "8791", "--persist-to", stateDirectory, "--test-scheduled",
      "--config", "wrangler.jsonc", "--env", "test", "--env-file", testEnvFile,
  ], { cwd: backendDirectory, env: childEnvironment, stdio: "ignore", windowsHide: true });

    await waitForWorker(worker);

    const rejected = await createOrder();
    const firstProof = await uploadProof(rejected);
    assert.equal(firstProof.response.status, 201, JSON.stringify(firstProof.payload));
    const proof = await requestJson(`/api/admin/payments/${rejected.code}/proof`, { headers: adminHeaders() });
    assert.equal(proof.response.status, 200, JSON.stringify(proof.payload));
    assert.match(proof.payload.data.proof_url, /^https:\/\/imagekit-test\.invalid\//);
    const rejectedReview = await reviewPayment(rejected, "reject");
    assert.equal(rejectedReview.payment_status, "failed");
    const retry = await uploadProof(rejected);
    assert.equal(retry.response.status, 409, JSON.stringify(retry.payload));
    const rejectedTracking = await trackOrder(rejected);
    assert.equal(rejectedTracking.response.status, 200);
    assert.equal(rejectedTracking.payload.data.payment_status, "failed");

    const refundable = await createOrder();
    const refundableProof = await uploadProof(refundable);
    assert.equal(refundableProof.response.status, 201, JSON.stringify(refundableProof.payload));
    await reviewPayment(refundable, "approve");
    const accepted = await requestJson(`/api/admin/orders/${refundable.code}/status`, {
      method: "POST", headers: adminHeaders(), body: { status_type: "order", status: "accepted", note: "Test" },
    });
    assert.equal(accepted.response.status, 200, JSON.stringify(accepted.payload));
    const requested = await requestJson("/api/orders/cancellation", {
      method: "POST", body: { order_code: refundable.code, phone: refundable.phone },
    });
    assert.equal(requested.response.status, 201, JSON.stringify(requested.payload));
    const requestedTracking = await trackOrder(refundable);
    assert.equal(requestedTracking.payload.data.refund_status, "requested");
    const blockedProduction = await requestJson(`/api/admin/orders/${refundable.code}/status`, {
      method: "POST", headers: adminHeaders(), body: { status_type: "production", status: "in_progress", note: "Test" },
    });
    assert.equal(blockedProduction.response.status, 409);

    const queue = await requestJson("/api/admin/refunds?status=requested", { headers: adminHeaders() });
    assert.equal(queue.response.status, 200);
    const refund = queue.payload.data.find((entry) => entry.order_code === refundable.code);
    assert.ok(refund, "Permintaan refund harus tampil di antrean admin.");
    const approved = await requestJson(`/api/admin/refunds/${refund.refund_id}/approve`, {
      method: "POST", headers: adminHeaders(), body: { note: "Simulasi lokal" },
    });
    assert.equal(approved.response.status, 200, JSON.stringify(approved.payload));
    assert.ok(Date.parse(approved.payload.data.refund_due_at) - Date.now() > 71 * 60 * 60 * 1000);
    const missingConfirmation = await requestJson(`/api/admin/refunds/${refund.refund_id}/process`, {
      method: "POST", headers: adminHeaders(), body: { note: "Belum dikonfirmasi" },
    });
    assert.equal(missingConfirmation.response.status, 400);
    const processed = await requestJson(`/api/admin/refunds/${refund.refund_id}/process`, {
      method: "POST", headers: adminHeaders(), body: { note: "Simulasi transfer lokal", transfer_confirmed: true },
    });
    assert.equal(processed.response.status, 200, JSON.stringify(processed.payload));
    const processedTracking = await trackOrder(refundable);
    assert.equal(processedTracking.payload.data.order_status, "cancelled");
    assert.equal(processedTracking.payload.data.payment_status, "refunded");
    assert.equal(processedTracking.payload.data.refund_status, "processed");

    const productionStarted = await createOrder();
    const productionProof = await uploadProof(productionStarted);
    assert.equal(productionProof.response.status, 201, JSON.stringify(productionProof.payload));
    await reviewPayment(productionStarted, "approve");
    const acceptedForProduction = await requestJson(`/api/admin/orders/${productionStarted.code}/status`, {
      method: "POST", headers: adminHeaders(), body: { status_type: "order", status: "accepted", note: "Test" },
    });
    assert.equal(acceptedForProduction.response.status, 200);
    const started = await requestJson(`/api/admin/orders/${productionStarted.code}/status`, {
      method: "POST", headers: adminHeaders(), body: { status_type: "production", status: "in_progress", note: "Test" },
    });
    assert.equal(started.response.status, 200);
    const lateRequest = await requestJson("/api/orders/cancellation", {
      method: "POST", body: { order_code: productionStarted.code, phone: productionStarted.phone },
    });
    assert.equal(lateRequest.response.status, 409);
    assert.match(lateRequest.payload.message, /chat/i);

    const expired = await createOrder();
    await setOrderExpired(expired);
    const scheduled = await fetch(`${apiBaseUrl}/__scheduled?cron=${encodeURIComponent("*/15 * * * *")}`, { signal: AbortSignal.timeout(10_000) });
    assert.ok(scheduled.ok, `Scheduled cleanup gagal: HTTP ${scheduled.status}`);
    assert.equal(await scheduled.text(), "Ran scheduled event", "Wrangler harus benar-benar menjalankan handler scheduled.");
    let expiredStatus;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      expiredStatus = await trackOrder(expired);
      if (expiredStatus.response.status === 404) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(expiredStatus.response.status, 404, "Order tanpa bukti yang kedaluwarsa harus terhapus.");

    const retained = await createOrder();
    const retainedProof = await uploadProof(retained);
    assert.equal(retainedProof.response.status, 201, JSON.stringify(retainedProof.payload));
    await setOrderExpired(retained);
    const scheduledAgain = await fetch(`${apiBaseUrl}/__scheduled?cron=${encodeURIComponent("*/15 * * * *")}`, { signal: AbortSignal.timeout(10_000) });
    assert.ok(scheduledAgain.ok);
    const retainedTracking = await trackOrder(retained);
    assert.equal(retainedTracking.response.status, 200, "Order dengan bukti harus dipertahankan.");
    assert.equal(retainedTracking.payload.data.has_payment_proof, true);

    console.log("Lulus: checkout/expiry, bukti privat tiruan, penolakan tanpa unggah ulang, persetujuan, refund, batas produksi, dan cleanup lokal.");
  } finally {
    if (worker && worker.exitCode === null) {
      worker.kill("SIGTERM");
      await Promise.race([
        new Promise((resolve) => worker.once("exit", resolve)),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
    }
    await rm(testEnvFile, { force: true });
    if (path.dirname(stateDirectory) === path.join(backendDirectory, ".wrangler")
      && path.basename(stateDirectory).startsWith("payment-test-")) {
      await rm(stateDirectory, { recursive: true, force: true });
    }
  }
}

if (!existsSync(wranglerCli)) throw new Error("Wrangler belum terpasang. Jalankan npm ci di backend terlebih dahulu.");
await run();
