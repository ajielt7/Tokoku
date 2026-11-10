package id.ruma.admin;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Build;
import android.content.pm.PackageManager;
import android.text.InputType;
import android.text.method.PasswordTransformationMethod;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URLEncoder;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;

public final class MainActivity extends Activity {
    private static final int GREEN = Color.rgb(0, 107, 60);
    private static final int DARK_GREEN = Color.rgb(7, 91, 53);
    private static final int ORANGE = Color.rgb(232, 117, 36);
    private static final int INK = Color.rgb(30, 41, 35);
    private static final int MUTED = Color.rgb(99, 112, 105);
    private static final int LINE = Color.rgb(222, 231, 225);
    private static final int PAGE = Color.rgb(245, 248, 246);
    private static final long MAX_PROOF_BYTES = 5L * 1024L * 1024L;
    private static final int CREATE_DXF_DOCUMENT = 702;
    private static final String PREFS = "ruma_admin_settings";
    private static final String PREF_API_URL = "api_url";
    private static AdminApi activeSession;
    private static final ExecutorService fcmRegistrationExecutor = Executors.newSingleThreadExecutor();

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private AdminApi api;
    private String apiBaseUrl;
    private String currentOrderCode;
    private String orderFilter = "";
    private String paymentFilter = "";
    private String refundFilter = "";
    private String searchQuery = "";
    private boolean paymentProofViewed;
    private LinearLayout page;
    private LinearLayout content;
    private TextView feedback;
    private ProgressBar progress;
    private EditText searchInput;
    private EditText adminNoteInput;
    private JSONObject loadedOrder;
    private String notificationOrderCode;
    private String pendingDxfContent;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(DARK_GREEN);
        getWindow().setNavigationBarColor(Color.WHITE);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        apiBaseUrl = getSharedPreferences(PREFS, MODE_PRIVATE)
                .getString(PREF_API_URL, "http://10.0.2.2:8787");
        api = activeSession;
        notificationOrderCode = getIntent().getStringExtra("order_code");
        AdminFirebaseMessagingService.createChannel(this);
        if (api == null) showLogin("");
        else if (notificationOrderCode != null && !notificationOrderCode.isEmpty()) showOrderDetail(notificationOrderCode);
        else showOrderList(true);
    }

    @Override
    protected void onDestroy() {
        if (isFinishing()) executor.shutdownNow();
        super.onDestroy();
    }

    private void showLogin(String message) {
        api = null;
        newPage();
        addBrandHeader("Admin Ruma", "Pesanan dan pembayaran");
        addText(page, "Masuk admin", 26, INK, true, 18, 0, 0, 0);
        addText(page, "Alamat API", 14, MUTED, true, 16, 12, 0, 4);
        EditText urlInput = input(apiBaseUrl, InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        urlInput.setSingleLine(true);
        urlInput.setHint("https://api.toko.id atau http://10.0.2.2:8787");
        page.addView(urlInput, matchWrap());
        addText(page, "Token admin", 14, MUTED, true, 14, 12, 0, 4);
        EditText tokenInput = input("", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        tokenInput.setSingleLine(true);
        tokenInput.setHint("ADMIN_TOKEN");
        tokenInput.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);
        tokenInput.setSaveEnabled(false);
        tokenInput.setTransformationMethod(PasswordTransformationMethod.getInstance());
        tokenInput.setTypeface(Typeface.DEFAULT);
        tokenInput.setImeOptions(EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING);
        page.addView(tokenInput, matchWrap());
        addText(page, "Token hanya disimpan di memori aplikasi. Untuk API publik gunakan HTTPS.", 13, MUTED, false, 8, 0, 0, 0);
        TextView messageView = addText(page, message, 14, Color.rgb(176, 51, 39), false, 14, 0, 0, 0);
        Button login = button("Masuk", true);
        page.addView(login, matchWrapTop(18));
        login.setOnClickListener(view -> {
            String url = urlInput.getText().toString().trim();
            String token = tokenInput.getText().toString();
            try {
                url = AdminApi.validateBaseUrl(url);
                AdminApi candidate = new AdminApi(url, token);
                String finalUrl = url;
                login.setEnabled(false);
                messageView.setText("Memeriksa akses admin…");
                runIo(() -> {
                    candidate.get("/api/admin/orders?limit=1");
                    runOnUiThread(() -> {
                        apiBaseUrl = finalUrl;
                        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(PREF_API_URL, finalUrl).apply();
                        activeSession = candidate;
                        api = candidate;
                        registerForOrderNotifications(candidate);
                        if (notificationOrderCode != null && !notificationOrderCode.isEmpty()) showOrderDetail(notificationOrderCode);
                        else showOrderList(true);
                    });
                }, error -> {
                    login.setEnabled(true);
                    messageView.setText(error.getMessage());
                });
            } catch (IOException error) {
                messageView.setText(error.getMessage());
            }
        });
        addFooterHint("Belum punya token? Minta ADMIN_TOKEN kepada pemilik sistem. Jangan kirim token lewat chat.");
        finishPage();
    }

    private void showOrderList(boolean fetch) {
        newPage();
        addToolbar("Pesanan", true, () -> showLogin(""));
        addText(page, "Kelola pembayaran dan status pesanan", 15, MUTED, false, 0, 0, 0, 12);

        LinearLayout filters = horizontal();
        Spinner statusSpinner = new Spinner(this);
        String[] filterLabels = {"Semua pesanan", "Pesanan baru", "Diterima", "Selesai", "Dibatalkan", "Menunggu pembayaran", "Pembayaran lunas", "Pembayaran gagal", "Pembayaran dikembalikan", "Refund diminta", "Refund disetujui"};
        String[] filterCodes = {"", "order:new", "order:accepted", "order:completed", "order:cancelled", "payment:pending", "payment:paid", "payment:failed", "payment:refunded", "refund:requested", "refund:approved"};
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_item, filterLabels);
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        statusSpinner.setAdapter(adapter);
        String currentFilter = !refundFilter.isEmpty() ? "refund:" + refundFilter
                : (paymentFilter.isEmpty()
                    ? (orderFilter.isEmpty() ? "" : "order:" + orderFilter)
                    : "payment:" + paymentFilter);
        for (int index = 0; index < filterCodes.length; index++) if (filterCodes[index].equals(currentFilter)) statusSpinner.setSelection(index);
        filters.addView(statusSpinner, new LinearLayout.LayoutParams(0, dp(50), 1));
        Button refresh = smallButton("Muat ulang", false);
        LinearLayout.LayoutParams refreshParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, dp(50));
        refreshParams.leftMargin = dp(8);
        filters.addView(refresh, refreshParams);
        page.addView(filters, matchWrap());

        LinearLayout searchRow = horizontal();
        searchInput = input(searchQuery, InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        searchInput.setSingleLine(true);
        searchInput.setHint("Cari kode atau nama");
        searchInput.setImeOptions(EditorInfo.IME_ACTION_SEARCH);
        searchRow.addView(searchInput, new LinearLayout.LayoutParams(0, dp(50), 1));
        Button search = smallButton("Cari", true);
        LinearLayout.LayoutParams searchButtonParams = new LinearLayout.LayoutParams(dp(84), dp(50));
        searchButtonParams.leftMargin = dp(8);
        searchRow.addView(search, searchButtonParams);
        LinearLayout.LayoutParams searchParams = matchWrapTop(8);
        page.addView(searchRow, searchParams);

        progress = new ProgressBar(this);
        progress.setVisibility(View.GONE);
        LinearLayout.LayoutParams progressParams = new LinearLayout.LayoutParams(dp(32), dp(32));
        progressParams.gravity = Gravity.CENTER_HORIZONTAL;
        progressParams.topMargin = dp(14);
        page.addView(progress, progressParams);
        feedback = addText(page, "", 14, MUTED, false, 8, 0, 0, 0);
        content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams listParams = matchWrapTop(8);
        page.addView(content, listParams);

        statusSpinner.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener() {
            private boolean initialized;
            @Override public void onItemSelected(android.widget.AdapterView<?> parent, View view, int position, long id) {
                String selected = filterCodes[position];
                if (!initialized) { initialized = true; return; }
                if (selected.startsWith("refund:")) {
                    String nextRefundFilter = selected.substring("refund:".length());
                    if (!nextRefundFilter.equals(refundFilter)) { refundFilter = nextRefundFilter; orderFilter = ""; paymentFilter = ""; loadOrders(); }
                } else if (selected.startsWith("payment:")) {
                    String nextPaymentFilter = selected.substring("payment:".length());
                    if (!nextPaymentFilter.equals(paymentFilter) || !refundFilter.isEmpty()) { paymentFilter = nextPaymentFilter; orderFilter = ""; refundFilter = ""; loadOrders(); }
                } else {
                    String nextOrderFilter = selected.startsWith("order:") ? selected.substring("order:".length()) : "";
                    if (!nextOrderFilter.equals(orderFilter) || !paymentFilter.isEmpty() || !refundFilter.isEmpty()) { orderFilter = nextOrderFilter; paymentFilter = ""; refundFilter = ""; loadOrders(); }
                }
            }
            @Override public void onNothingSelected(android.widget.AdapterView<?> parent) { }
        });
        refresh.setOnClickListener(view -> loadOrders());
        search.setOnClickListener(view -> { searchQuery = searchInput.getText().toString().trim(); loadOrders(); });
        searchInput.setOnEditorActionListener((view, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_SEARCH) {
                searchQuery = searchInput.getText().toString().trim();
                loadOrders();
                return true;
            }
            return false;
        });
        finishPage();
        if (fetch) loadOrders();
    }

    private void loadOrders() {
        if (api == null) { showLogin(""); return; }
        if (!refundFilter.isEmpty()) { loadRefunds(); return; }
        if (searchInput != null) searchQuery = searchInput.getText().toString().trim();
        setBusy(true, "Memuat pesanan…");
        StringBuilder path = new StringBuilder("/api/admin/orders?limit=100");
        if (!orderFilter.isEmpty()) path.append("&order_status=").append(orderFilter);
        if (!paymentFilter.isEmpty()) path.append("&payment_status=").append(paymentFilter);
        if (!searchQuery.isEmpty()) {
            try { path.append("&q=").append(URLEncoder.encode(searchQuery, StandardCharsets.UTF_8.name())); }
            catch (Exception ignored) { }
        }
        runIo(() -> {
            JSONObject response = api.get(path.toString());
            JSONArray orders = response.optJSONArray("data");
            runOnUiThread(() -> renderOrders(orders == null ? new JSONArray() : orders));
        }, error -> {
            setBusy(false, error.getMessage());
            if (content != null && content.getChildCount() == 0) addEmptyState("Pesanan belum dapat dimuat.", "Coba muat ulang setelah koneksi tersedia.");
        });
    }

    private void loadRefunds() {
        if (api == null) { showLogin(""); return; }
        setBusy(true, "Memuat permintaan refund…");
        String status = refundFilter;
        runIo(() -> {
            JSONObject response = api.get("/api/admin/refunds?status=" + status);
            JSONArray refunds = response.optJSONArray("data");
            runOnUiThread(() -> renderRefunds(refunds == null ? new JSONArray() : refunds));
        }, error -> {
            setBusy(false, error.getMessage());
            if (content != null && content.getChildCount() == 0) addEmptyState("Permintaan refund belum dapat dimuat.", "Coba muat ulang setelah koneksi tersedia.");
        });
    }

    private void renderRefunds(JSONArray refunds) {
        setBusy(false, refunds.length() == 0 ? "Belum ada permintaan pada tab ini." : refunds.length() + " permintaan refund");
        content.removeAllViews();
        if (refunds.length() == 0) {
            addEmptyState("Belum ada permintaan refund", "Permintaan pembatalan dari pelanggan akan muncul di sini.");
            return;
        }
        for (int index = 0; index < refunds.length(); index++) {
            JSONObject refund = refunds.optJSONObject(index);
            if (refund == null) continue;
            LinearLayout card = card(content);
            addText(card, stringValue(refund, "order_code", "Pesanan"), 16, GREEN, true, 0, 0, 0, 4);
            addText(card, stringValue(refund, "customer_name", "Pelanggan"), 16, INK, true, 0, 0, 0, 4);
            addText(card, "WhatsApp: " + stringValue(refund, "customer_phone", ""), 14, MUTED, false, 0, 0, 0, 4);
            addText(card, "Refund " + money(refund.optLong("amount")) + " · diminta " + dateText(refund.optString("requested_at")), 14, MUTED, false, 0, 0, 0, 4);
            if ("approved".equals(refund.optString("refund_status"))) {
                addText(card, "Target: " + dateText(refund.optString("refund_due_at")) + ". Transfer hanya ke rekening asal pembayaran.", 14, ORANGE, true, 0, 0, 0, 8);
            } else if (!refund.optString("customer_note").isEmpty()) {
                addText(card, "Catatan pembeli: " + refund.optString("customer_note"), 14, MUTED, false, 0, 0, 0, 8);
            }
            Button openOrder = smallButton("Lihat pesanan dan bukti", false);
            card.addView(openOrder, matchWrap());
            String orderCode = refund.optString("order_code", "");
            openOrder.setOnClickListener(view -> showOrderDetail(orderCode));
            String status = refund.optString("refund_status", "requested");
            if ("requested".equals(status)) {
                Button approve = smallButton("Setujui refund", true);
                card.addView(approve, matchWrapTop(6));
                approve.setOnClickListener(view -> confirmRefundAction(refund, "approve"));
            } else if ("approved".equals(status)) {
                Button process = smallButton("Konfirmasi refund sudah ditransfer", true);
                card.addView(process, matchWrapTop(6));
                process.setOnClickListener(view -> confirmRefundAction(refund, "process"));
            }
        }
    }

    private void confirmRefundAction(JSONObject refund, String action) {
        boolean processing = "process".equals(action);
        String title = processing ? "Konfirmasi transfer refund?" : "Setujui permintaan refund?";
        String message = processing
                ? "Pastikan dana sudah ditransfer ke rekening asal yang mengirim pembayaran. Setelah dikonfirmasi, status pesanan berubah menjadi dibatalkan/refund."
                : "Refund hanya untuk pesanan yang belum mulai diproduksi. Setelah disetujui, target pengiriman dana maksimal 3 × 24 jam.";
        new AlertDialog.Builder(this)
                .setTitle(title)
                .setMessage(message)
                .setNegativeButton("Kembali", null)
                .setPositiveButton(processing ? "Ya, sudah transfer" : "Setujui", (dialog, which) -> runRefundAction(refund, action))
                .show();
    }

    private void runRefundAction(JSONObject refund, String action) {
        String refundId = refund.optString("refund_id", "");
        setBusy(true, "Menyimpan status refund…");
        runIo(() -> {
            JSONObject response = api.post("/api/admin/refunds/" + refundId + "/" + action,
                    json("note", action.equals("process") ? "Admin mengonfirmasi transfer ke rekening asal" : "",
                            "transfer_confirmed", action.equals("process")));
            runOnUiThread(() -> {
                feedback.setText(response.optString("message", "Status refund diperbarui."));
                loadRefunds();
            });
        }, error -> setBusy(false, error.getMessage()));
    }

    private void renderOrders(JSONArray orders) {
        setBusy(false, orders.length() == 0 ? "Belum ada pesanan pada filter ini." : orders.length() + " pesanan terbaru");
        content.removeAllViews();
        if (orders.length() == 0) {
            addEmptyState("Belum ada pesanan", "Pesanan baru akan muncul di sini.");
            return;
        }
        for (int index = 0; index < orders.length(); index++) {
            JSONObject order = orders.optJSONObject(index);
            if (order == null) continue;
            LinearLayout card = card(content);
            addText(card, stringValue(order, "order_code", "Pesanan"), 16, GREEN, true, 0, 0, 0, 4);
            addText(card, stringValue(order, "customer_name", "Pelanggan"), 16, INK, true, 0, 0, 0, 4);
            addText(card, money(order.optLong("total_amount")) + "  ·  " + dateText(order.optString("created_at")), 14, MUTED, false, 0, 0, 0, 8);
            addText(card, "Pesanan: " + statusLabel("order", stringValue(order, "order_status", "new"))
                    + "   •   Produksi: " + statusLabel("production", stringValue(order, "production_status", "pending")), 14, INK, false, 0, 0, 0, 4);
            addText(card, "Pembayaran: " + statusLabel("payment", stringValue(order, "payment_status", "pending"))
                    + (order.optBoolean("has_payment_proof") ? "  ·  Bukti ada" : ""), 14, MUTED, false, 0, 0, 0, 10);
            String proofUploadedAt = order.optString("proof_uploaded_at", "");
            if (!proofUploadedAt.isEmpty() && "pending".equals(order.optString("payment_status"))) {
                try {
                    java.time.Instant uploaded = java.time.Instant.parse(proofUploadedAt);
                    String reviewDeadline = java.time.format.DateTimeFormatter.ofPattern("dd MMM yyyy, HH:mm", Locale.forLanguageTag("id-ID"))
                            .withZone(java.time.ZoneId.systemDefault()).format(uploaded.plusSeconds(24 * 60 * 60));
                    addText(card, "Target periksa bukti sebelum " + reviewDeadline, 14, ORANGE, true, 0, 0, 0, 8);
                } catch (Exception ignored) { }
            }
            Button open = smallButton("Lihat pesanan", false);
            card.addView(open, matchWrap());
            String code = order.optString("order_code", "");
            card.setOnClickListener(view -> showOrderDetail(code));
            open.setOnClickListener(view -> showOrderDetail(code));
        }
    }

    private void showOrderDetail(String orderCode) {
        if (orderCode == null || orderCode.isEmpty()) return;
        currentOrderCode = orderCode;
        paymentProofViewed = false;
        newPage();
        addToolbar(orderCode, false, () -> showOrderList(true));
        feedback = addText(page, "Memuat detail…", 14, MUTED, false, 8, 0, 0, 0);
        progress = new ProgressBar(this);
        LinearLayout.LayoutParams progressParams = new LinearLayout.LayoutParams(dp(32), dp(32));
        progressParams.gravity = Gravity.CENTER_HORIZONTAL;
        page.addView(progress, progressParams);
        content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        page.addView(content, matchWrapTop(8));
        finishPage();
        loadOrderDetail();
    }

    private void loadOrderDetail() {
        if (api == null || currentOrderCode == null) { showLogin(""); return; }
        String code = currentOrderCode;
        setBusy(true, "Memuat detail pesanan…");
        runIo(() -> {
            JSONObject response = api.get("/api/admin/orders/" + code);
            JSONObject data = response.optJSONObject("data");
            if (data == null) throw new IOException("Detail pesanan kosong.");
            runOnUiThread(() -> renderOrderDetail(data));
        }, error -> setBusy(false, error.getMessage()));
    }

    private void renderOrderDetail(JSONObject order) {
        loadedOrder = order;
        content.removeAllViews();
        setBusy(false, "");
        card(content);
        LinearLayout summary = (LinearLayout) content.getChildAt(content.getChildCount() - 1);
        addText(summary, money(order.optLong("total_amount")), 25, GREEN, true, 0, 0, 0, 4);
        addText(summary, "Dibuat " + dateText(stringValue(order, "created_at", "")), 14, MUTED, false, 0, 0, 0, 4);
        addText(summary, "Pesanan: " + statusLabel("order", stringValue(order, "order_status", "new")), 15, INK, true, 0, 0, 0, 4);
        addText(summary, "Produksi: " + statusLabel("production", stringValue(order, "production_status", "pending")), 15, INK, true, 0, 0, 0, 0);

        LinearLayout customer = section("Pelanggan dan alamat");
        addText(customer, stringValue(order, "customer_name", ""), 17, INK, true, 0, 0, 0, 3);
        addText(customer, stringValue(order, "customer_phone", ""), 15, GREEN, true, 0, 0, 0, 3);
        String email = stringValue(order, "customer_email", "");
        if (!email.isEmpty()) addText(customer, email, 14, MUTED, false, 0, 0, 0, 6);
        addText(customer, stringValue(order, "shipping_address", ""), 15, INK, false, 0, 0, 0, 4);
        String customerNote = stringValue(order, "customer_note", "");
        if (!customerNote.isEmpty()) addText(customer, "Catatan: " + customerNote, 14, MUTED, false, 0, 0, 0, 0);

        LinearLayout shipping = section("Pengiriman");
        addPair(shipping, "Tujuan", stringValue(order, "shipping_destination_label", "—"));
        addPair(shipping, "Kurir", stringValue(order, "shipping_courier_name", "—") + " " + stringValue(order, "shipping_service", ""));
        if (order.has("shipping_distance_km") && !order.isNull("shipping_distance_km")) addPair(shipping, "Jarak", order.optString("shipping_distance_km") + " km");
        addPair(shipping, "Ongkir", money(order.optLong("shipping_amount")));
        String carrier = stringValue(order, "carrier", "");
        if (!carrier.isEmpty()) addPair(shipping, "Resi", carrier + " " + stringValue(order, "tracking_number", ""));
        addPair(shipping, "Status kirim", statusLabel("shipment", stringValue(order, "shipment_status", "pending")));
        String trackingUrl = stringValue(order, "tracking_url", "");
        if (trackingUrl.startsWith("https://")) {
            Button openTracking = smallButton("Buka halaman kurir", false);
            shipping.addView(openTracking, matchWrapTop(6));
            openTracking.setOnClickListener(view -> {
                try { startActivity(new Intent(Intent.ACTION_VIEW, android.net.Uri.parse(trackingUrl))); }
                catch (Exception error) { setBusy(false, "Tautan tracking tidak dapat dibuka."); }
            });
        }

        LinearLayout itemsCard = section("Isi pesanan");
        JSONArray items = order.optJSONArray("items");
        if (items != null) for (int index = 0; index < items.length(); index++) {
            JSONObject item = items.optJSONObject(index);
            if (item == null) continue;
            addText(itemsCard, item.optString("name", "Produk") + "  ×  " + item.optInt("quantity"), 16, INK, true, 0, 0, 0, 3);
            addText(itemsCard, money(item.optLong("unit_price_amount")) + " per item · " + money(item.optLong("line_total_amount")), 14, MUTED, false, 0, 0, 0, 3);
            String size = item.optString("fixed_size_snapshot", "");
            if (!size.isEmpty() && !"null".equals(size)) addText(itemsCard, "Ukuran: " + size, 14, MUTED, false, 0, 0, 0, 3);
            JSONObject custom = item.optJSONObject("customization");
            if (custom != null && custom.length() > 0) {
                java.util.Iterator<String> customKeys = custom.keys();
                while (customKeys.hasNext()) {
                    String key = customKeys.next();
                    addText(itemsCard, customFieldLabel(item, key) + ": " + custom.optString(key), 14, MUTED, false, 0, 0, 0, 3);
                }
            }
            addText(itemsCard, "Template versi " + Math.max(1, item.optInt("template_version_snapshot", 1)), 13, MUTED, false, 0, 0, 0, 5);
            Button createDxf = smallButton("Buat gambar DXF", false);
            itemsCard.addView(createDxf, matchWrapTop(4));
            String itemId = item.optString("id", "");
            createDxf.setOnClickListener(view -> createProductionDxf(itemId, createDxf));
            JSONArray productionFiles = item.optJSONArray("production_files");
            if (productionFiles != null) for (int fileIndex = 0; fileIndex < productionFiles.length(); fileIndex++) {
                JSONObject file = productionFiles.optJSONObject(fileIndex);
                if (file == null) continue;
                Button downloadDxf = smallButton("Simpan DXF v" + file.optInt("version"), false);
                itemsCard.addView(downloadDxf, matchWrapTop(4));
                String fileId = file.optString("id", "");
                downloadDxf.setOnClickListener(view -> downloadProductionDxf(fileId, file.optString("file_name"), downloadDxf));
            }
        }
        addText(itemsCard, "Koordinat DXF dihitung dalam mm; saat impor pilih skala 1 unit = 1 mm. File ini gambar 2D, bukan toolpath. Periksa font, bahan, toleransi, dan toolpath di CAD/CAM sebelum produksi mesin.", 13, MUTED, false, 0, 0, 0, 4);

        LinearLayout payment = section("Pembayaran");
        String paymentStatus = stringValue(order, "payment_status", "pending");
        addPair(payment, "Referensi", stringValue(order, "payment_reference", stringValue(order, "order_code", "")));
        addPair(payment, "Status", statusLabel("payment", paymentStatus));
        addPair(payment, "Jumlah", money(order.optLong("payment_amount", order.optLong("total_amount"))));
        if (order.optBoolean("has_payment_proof")) {
            ImageView proofImage = new ImageView(this);
            proofImage.setVisibility(View.GONE);
            proofImage.setAdjustViewBounds(true);
            proofImage.setScaleType(ImageView.ScaleType.FIT_CENTER);
            proofImage.setMaxHeight(dp(420));
            proofImage.setContentDescription("Bukti pembayaran pelanggan");
            LinearLayout.LayoutParams imageParams = matchWrapTop(8);
            payment.addView(proofImage, imageParams);
            Button viewProof = smallButton("Lihat bukti bayar", false);
            payment.addView(viewProof, matchWrapTop(8));
            viewProof.setOnClickListener(view -> loadProof(order, viewProof, proofImage));
        }
        if ("pending".equals(paymentStatus) && order.optBoolean("has_payment_proof")) {
            LinearLayout reviewButtons = horizontal();
            Button approve = smallButton("Setujui", true);
            Button reject = smallButton("Tolak bukti", false);
            LinearLayout.LayoutParams actionParams = new LinearLayout.LayoutParams(0, dp(48), 1);
            reviewButtons.addView(approve, actionParams);
            LinearLayout.LayoutParams rejectParams = new LinearLayout.LayoutParams(0, dp(48), 1);
            rejectParams.leftMargin = dp(8);
            reviewButtons.addView(reject, rejectParams);
            payment.addView(reviewButtons, matchWrapTop(8));
            approve.setOnClickListener(view -> confirmPaymentReview(order, "approve"));
            reject.setOnClickListener(view -> confirmPaymentReview(order, "reject"));
        }

        EditText noteInput = input("", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        adminNoteInput = noteInput;
        noteInput.setHint("Catatan admin; wajib untuk pembatalan");
        noteInput.setMinLines(2);
        noteInput.setGravity(Gravity.TOP | Gravity.START);
        LinearLayout statusCard = section("Perbarui status");
        addText(statusCard, "Perubahan dicatat. Pesanan baru diterima setelah lunas dan dituntaskan setelah produksi serta pengiriman selesai.", 14, MUTED, false, 0, 0, 0, 8);
        addText(statusCard, "Status pesanan", 14, INK, true, 0, 0, 0, 3);
        Spinner orderStatus = statusSpinner("order", order.optString("order_status"));
        statusCard.addView(orderStatus, matchWrap());
        Button saveOrderStatus = smallButton("Simpan status pesanan", false);
        statusCard.addView(saveOrderStatus, matchWrapTop(6));
        saveOrderStatus.setOnClickListener(view -> saveStatus("order", selectedStatusCode(orderStatus), order.optString("order_status"), noteInput.getText().toString().trim(), saveOrderStatus));
        addText(statusCard, "Status produksi", 14, INK, true, 0, 8, 0, 3);
        Spinner productionStatus = statusSpinner("production", order.optString("production_status"));
        statusCard.addView(productionStatus, matchWrap());
        statusCard.addView(noteInput, matchWrapTop(8));
        Button saveProductionStatus = smallButton("Simpan status produksi", true);
        statusCard.addView(saveProductionStatus, matchWrapTop(8));
        saveProductionStatus.setOnClickListener(view -> saveStatus("production", selectedStatusCode(productionStatus), order.optString("production_status"), noteInput.getText().toString().trim(), saveProductionStatus));

        LinearLayout shipmentCard = section("Kelola pengiriman");
        addText(shipmentCard, "Kirim setelah pembayaran lunas dan produksi selesai. Catat kurir, resi, dan tautan HTTPS.", 14, MUTED, false, 0, 0, 0, 8);
        EditText carrierInput = input(stringValue(order, "carrier", ""), InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_WORDS);
        carrierInput.setSingleLine(true);
        carrierInput.setHint("Nama kurir");
        shipmentCard.addView(carrierInput, matchWrapTop(6));
        EditText trackingNumberInput = input(stringValue(order, "tracking_number", ""), InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS);
        trackingNumberInput.setSingleLine(true);
        trackingNumberInput.setHint("Nomor resi");
        shipmentCard.addView(trackingNumberInput, matchWrapTop(6));
        EditText trackingUrlInput = input(stringValue(order, "tracking_url", ""), InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        trackingUrlInput.setSingleLine(true);
        trackingUrlInput.setHint("https:// tautan tracking kurir");
        shipmentCard.addView(trackingUrlInput, matchWrapTop(6));
        addText(shipmentCard, "Status pengiriman", 14, INK, true, 0, 8, 0, 3);
        Spinner shipmentStatus = statusSpinner("shipment", stringValue(order, "shipment_status", "pending"));
        shipmentCard.addView(shipmentStatus, matchWrap());
        Button saveShipment = smallButton("Simpan pengiriman", true);
        shipmentCard.addView(saveShipment, matchWrapTop(8));
        saveShipment.setOnClickListener(view -> saveShipment(
                carrierInput.getText().toString().trim(), trackingNumberInput.getText().toString().trim(),
                trackingUrlInput.getText().toString().trim(), selectedStatusCode(shipmentStatus),
                noteInput.getText().toString().trim(), saveShipment));

        LinearLayout historyCard = section("Riwayat");
        JSONArray history = order.optJSONArray("history");
        if (history != null && history.length() > 0) for (int index = 0; index < history.length(); index++) {
            JSONObject event = history.optJSONObject(index);
            if (event == null) continue;
            String type = event.optString("status_type");
            addText(historyCard, statusLabel(type, event.optString("new_status")), 15, INK, true, 0, 0, 0, 2);
            addText(historyCard, dateText(event.optString("created_at")) + " · " + event.optString("actor_type", "system"), 13, MUTED, false, 0, 0, 0, 2);
            String historyNote = event.optString("note", "");
            if (!historyNote.isEmpty() && !"null".equals(historyNote)) addText(historyCard, historyNote, 14, MUTED, false, 0, 0, 0, 8);
        }
    }

    private void loadProof(JSONObject order, Button button, ImageView imageView) {
        String reference = stringValue(order, "payment_reference", stringValue(order, "order_code", ""));
        button.setEnabled(false);
        button.setText("Memuat bukti…");
        runIo(() -> {
            String signedUrl = api.getPaymentProofUrl(reference);
            Bitmap bitmap = downloadProof(signedUrl);
            runOnUiThread(() -> {
                imageView.setImageBitmap(bitmap);
                imageView.setVisibility(View.VISIBLE);
                paymentProofViewed = true;
                button.setText("Bukti pembayaran");
                button.setEnabled(true);
            });
        }, error -> {
            button.setEnabled(true);
            button.setText("Coba buka bukti lagi");
            setBusy(false, error.getMessage());
        });
    }

    private Bitmap downloadProof(String signedUrl) throws IOException {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(signedUrl).openConnection();
            connection.setConnectTimeout(12_000);
            connection.setReadTimeout(20_000);
            connection.setInstanceFollowRedirects(true);
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) throw new IOException("Bukti tidak dapat dimuat (HTTP " + status + ").");
            long length = connection.getContentLengthLong();
            if (length > MAX_PROOF_BYTES) throw new IOException("Ukuran bukti melebihi batas 5 MB.");
            byte[] bytes = readImageLimited(connection.getInputStream());
            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bounds);
            if (bounds.outWidth < 1 || bounds.outHeight < 1) throw new IOException("File bukti bukan gambar yang dapat dibaca.");
            BitmapFactory.Options options = new BitmapFactory.Options();
            options.inSampleSize = 1;
            while (bounds.outWidth / options.inSampleSize > 1800 || bounds.outHeight / options.inSampleSize > 1800) options.inSampleSize *= 2;
            Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
            if (bitmap == null) throw new IOException("Bukti tidak dapat ditampilkan.");
            return bitmap;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private byte[] readImageLimited(InputStream stream) throws IOException {
        try (InputStream input = stream; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int total = 0;
            int count;
            while ((count = input.read(buffer)) != -1) {
                total += count;
                if (total > MAX_PROOF_BYTES) throw new IOException("Ukuran bukti melebihi batas 5 MB.");
                output.write(buffer, 0, count);
            }
            return output.toByteArray();
        }
    }

    private void confirmPaymentReview(JSONObject order, String decision) {
        if (!paymentProofViewed) {
            setBusy(false, "Buka dan periksa gambar bukti sebelum menyetujui atau menolak pembayaran.");
            return;
        }
        String title = "approve".equals(decision) ? "Setujui pembayaran?" : "Tolak bukti transfer?";
        String message = "approve".equals(decision)
                ? "Pastikan nominal dan rekening pengirim cocok sebelum menyetujui."
                : "Bukti akan dihapus dan pelanggan dapat mengirim ulang.";
        new AlertDialog.Builder(this)
                .setTitle(title)
                .setMessage(message)
                .setNegativeButton("Kembali", null)
                .setPositiveButton("Lanjutkan", (dialog, which) -> reviewPayment(order, decision))
                .show();
    }

    private void reviewPayment(JSONObject order, String decision) {
        String reference = stringValue(order, "payment_reference", stringValue(order, "order_code", ""));
        String note = adminNoteInput == null ? "" : adminNoteInput.getText().toString().trim();
        setBusy(true, "Memperbarui pembayaran…");
        runIo(() -> {
            api.post("/api/admin/payments/" + reference + "/review", json("decision", decision, "note", note));
            runOnUiThread(() -> loadOrderDetail());
        }, error -> setBusy(false, error.getMessage()));
    }

    private void updateOrderStatus(String type, String status, String note, Button button) {
        if (api == null || currentOrderCode == null) return;
        button.setEnabled(false);
        setBusy(true, "Menyimpan status…");
        runIo(() -> {
            JSONObject body = json("status_type", type, "status", status, "note", note);
            api.post("/api/admin/orders/" + currentOrderCode + "/status", body);
            runOnUiThread(() -> loadOrderDetail());
        }, error -> {
            button.setEnabled(true);
            setBusy(false, error.getMessage());
        });
    }

    private void saveStatus(String type, String selected, String current, String note, Button button) {
        if (selected.equals(current)) {
            setBusy(false, "Status tidak berubah.");
            return;
        }
        updateOrderStatus(type, selected, note, button);
    }

    private void saveShipment(String carrier, String trackingNumber, String trackingUrl, String status, String note, Button button) {
        if (api == null || currentOrderCode == null) return;
        button.setEnabled(false);
        setBusy(true, "Menyimpan pengiriman…");
        runIo(() -> {
            JSONObject body = json("carrier", carrier, "tracking_number", trackingNumber,
                    "tracking_url", trackingUrl, "status", status, "note", note);
            api.post("/api/admin/orders/" + currentOrderCode + "/shipment", body);
            runOnUiThread(() -> loadOrderDetail());
        }, error -> {
            button.setEnabled(true);
            setBusy(false, error.getMessage());
        });
    }

    private void createProductionDxf(String itemId, Button button) {
        if (api == null || currentOrderCode == null || itemId.isEmpty()) return;
        button.setEnabled(false);
        setBusy(true, "Membuat gambar DXF…");
        runIo(() -> {
            JSONObject response = api.post("/api/admin/orders/" + currentOrderCode + "/items/" + itemId + "/production-files/dxf", new JSONObject());
            JSONObject file = response.optJSONObject("data");
            if (file == null || file.optString("content").isEmpty()) throw new IOException("Isi gambar DXF tidak tersedia.");
            runOnUiThread(() -> {
                button.setEnabled(true);
                setBusy(false, response.optString("message", "Gambar DXF dibuat."));
                showSaveDxfDialog(file.optString("content"), file.optString("file_name"), file.optInt("version"));
                loadOrderDetail();
            });
        }, error -> { button.setEnabled(true); setBusy(false, error.getMessage()); });
    }

    private void downloadProductionDxf(String fileId, String fileName, Button button) {
        if (api == null || currentOrderCode == null || fileId.isEmpty()) return;
        button.setEnabled(false);
        runIo(() -> {
            String content = api.getText("/api/admin/orders/" + currentOrderCode + "/production-files/" + fileId);
            runOnUiThread(() -> { button.setEnabled(true); showSaveDxfDialog(content, fileName, 0); });
        }, error -> { button.setEnabled(true); setBusy(false, error.getMessage()); });
    }

    private void showSaveDxfDialog(String content, String fileName, int version) {
        pendingDxfContent = content;
        new AlertDialog.Builder(this)
                .setTitle(version > 0 ? "DXF versi " + version : "Simpan gambar DXF")
                .setMessage("Gambar tersimpan pada pesanan. DXF R12 tidak menyimpan satuan; pilih skala 1 unit = 1 mm saat impor. Ini gambar 2D, bukan toolpath siap mesin.")
                .setNegativeButton("Tutup", (dialog, which) -> pendingDxfContent = null)
                .setPositiveButton("Simpan file", (dialog, which) -> {
                    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("application/dxf");
                    intent.putExtra(Intent.EXTRA_TITLE, fileName);
                    startActivityForResult(intent, CREATE_DXF_DOCUMENT);
                }).show();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != CREATE_DXF_DOCUMENT) return;
        if (resultCode != RESULT_OK || data == null || data.getData() == null || pendingDxfContent == null) {
            pendingDxfContent = null;
            return;
        }
        try (OutputStream output = getContentResolver().openOutputStream(data.getData())) {
            if (output == null) throw new IOException("Lokasi file tidak dapat dibuka.");
            output.write(pendingDxfContent.getBytes(StandardCharsets.UTF_8));
            setBusy(false, "File DXF tersimpan.");
        } catch (IOException error) {
            setBusy(false, "File DXF belum tersimpan: " + error.getMessage());
        } finally {
            pendingDxfContent = null;
        }
    }

    private Spinner statusSpinner(String type, String current) {
        String[] codes;
        if ("order".equals(type)) {
            if ("new".equals(current)) codes = new String[]{"new", "accepted", "cancelled"};
            else if ("accepted".equals(current)) codes = new String[]{"accepted", "completed", "cancelled"};
            else codes = new String[]{current};
        } else if ("production".equals(type)) {
            if ("pending".equals(current)) codes = new String[]{"pending", "in_progress", "cancelled"};
            else if ("in_progress".equals(current)) codes = new String[]{"in_progress", "completed", "cancelled"};
            else codes = new String[]{current};
        } else {
            if ("pending".equals(current)) codes = new String[]{"shipped"};
            else if ("shipped".equals(current)) codes = new String[]{"shipped", "delivered", "failed", "returned"};
            else if ("failed".equals(current) || "returned".equals(current)) codes = new String[]{current, "shipped"};
            else codes = new String[]{current};
        }
        List<String> labels = new ArrayList<>();
        for (String code : codes) labels.add(statusLabel(type, code));
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_item, labels);
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        Spinner spinner = new Spinner(this);
        spinner.setAdapter(adapter);
        spinner.setTag(codes);
        return spinner;
    }

    private String selectedStatusCode(Spinner spinner) {
        String[] codes = (String[]) spinner.getTag();
        int selected = spinner.getSelectedItemPosition();
        return codes != null && selected >= 0 && selected < codes.length ? codes[selected] : "";
    }

    private void addToolbar(String title, boolean logout, Runnable back) {
        LinearLayout bar = horizontal();
        Button backButton = smallButton("‹", false);
        backButton.setContentDescription("Kembali");
        bar.addView(backButton, new LinearLayout.LayoutParams(dp(48), dp(48)));
        backButton.setOnClickListener(view -> back.run());
        TextView heading = new TextView(this);
        heading.setText(title);
        heading.setTextColor(INK);
        heading.setTextSize(21);
        heading.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        heading.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams headingParams = new LinearLayout.LayoutParams(0, dp(48), 1);
        headingParams.leftMargin = dp(8);
        bar.addView(heading, headingParams);
        if (logout) {
            Button logoutButton = smallButton("Keluar", false);
            bar.addView(logoutButton, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, dp(48)));
            logoutButton.setOnClickListener(view -> {
                unregisterNotificationDevice(api);
                activeSession = null;
                api = null;
                showLogin("");
            });
        }
        page.addView(bar, matchWrapBottom(8));
    }

    private void addBrandHeader(String title, String subtitle) {
        LinearLayout brand = card(page);
        TextView mark = addText(brand, "R", 25, Color.WHITE, true, 0, 0, 0, 4);
        mark.setGravity(Gravity.CENTER);
        mark.setBackground(rounded(GREEN, 12, Color.TRANSPARENT));
        brand.addView(new View(this), new LinearLayout.LayoutParams(1, dp(10)));
        addText(brand, title, 25, GREEN, true, 0, 0, 0, 3);
        addText(brand, subtitle, 15, MUTED, false, 0, 0, 0, 0);
    }

    private void addFooterHint(String text) {
        TextView hint = addText(page, text, 13, MUTED, false, 22, 0, 0, 0);
        hint.setGravity(Gravity.CENTER);
    }

    private LinearLayout section(String title) {
        LinearLayout box = card(content);
        addText(box, title, 18, GREEN, true, 0, 0, 0, 10);
        return box;
    }

    private void addPair(LinearLayout parent, String label, String value) {
        LinearLayout row = horizontal();
        TextView left = new TextView(this);
        left.setText(label);
        left.setTextColor(MUTED);
        left.setTextSize(14);
        row.addView(left, new LinearLayout.LayoutParams(dp(102), ViewGroup.LayoutParams.WRAP_CONTENT));
        TextView right = new TextView(this);
        right.setText(value == null || value.isEmpty() ? "—" : value);
        right.setTextColor(INK);
        right.setTextSize(15);
        right.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        right.setGravity(Gravity.END);
        row.addView(right, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        parent.addView(row, matchWrapBottom(8));
    }

    private void addEmptyState(String title, String message) {
        if (content == null) return;
        LinearLayout box = card(content);
        addText(box, title, 18, INK, true, 0, 0, 0, 5);
        addText(box, message, 14, MUTED, false, 0, 0, 0, 0);
    }

    private void setBusy(boolean busy, String message) {
        if (progress != null) progress.setVisibility(busy ? View.VISIBLE : View.GONE);
        if (feedback != null) feedback.setText(message == null ? "" : message);
        if (message != null && !message.isEmpty() && (message.startsWith("API") || message.startsWith("Akses") || message.startsWith("Status") || message.startsWith("Permintaan") || message.startsWith("Pesanan") || message.startsWith("Pembayaran") || message.startsWith("Produksi") || message.startsWith("Bukti") || message.startsWith("Tautan"))) {
            if (feedback != null) feedback.setTextColor(Color.rgb(176, 51, 39));
        } else if (feedback != null) feedback.setTextColor(MUTED);
    }

    private void runIo(IoAction action, ErrorAction onError) {
        executor.execute(() -> {
            try { action.run(); }
            catch (Exception exception) {
                String message = exception.getMessage();
                runOnUiThread(() -> onError.accept(new IOException(message == null ? "Terjadi kendala jaringan." : message)));
            }
        });
    }

    private ScrollView newPage() {
        page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setPadding(dp(20), dp(20), dp(20), dp(32));
        page.setBackgroundColor(PAGE);
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);
        scroll.addView(page, new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        setContentView(scroll);
        feedback = null;
        progress = null;
        content = null;
        searchInput = null;
        adminNoteInput = null;
        return scroll;
    }

    private void finishPage() { page.requestLayout(); }

    private LinearLayout card(LinearLayout parent) {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(16), dp(16), dp(16), dp(16));
        box.setBackground(rounded(Color.WHITE, 14, LINE));
        parent.addView(box, matchWrapBottom(12));
        return box;
    }

    private LinearLayout horizontal() {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        return row;
    }

    private TextView addText(LinearLayout parent, String text, int size, int color, boolean bold,
                             int top, int left, int right, int bottom) {
        TextView label = new TextView(this);
        label.setText(text == null ? "" : text);
        label.setTextColor(color);
        label.setTextSize(size);
        label.setLineSpacing(dp(2), 1f);
        if (bold) label.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        params.setMargins(dp(left), dp(top), dp(right), dp(bottom));
        parent.addView(label, params);
        return label;
    }

    private EditText input(String value, int inputType) {
        EditText edit = new EditText(this);
        edit.setText(value);
        edit.setTextColor(INK);
        edit.setHintTextColor(MUTED);
        edit.setTextSize(16);
        edit.setInputType(inputType);
        edit.setPadding(dp(12), dp(8), dp(12), dp(8));
        edit.setBackground(rounded(Color.WHITE, 10, LINE));
        return edit;
    }

    private Button button(String label, boolean primary) {
        Button button = new Button(this);
        button.setText(label);
        button.setAllCaps(false);
        button.setTextSize(16);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setTextColor(primary ? Color.WHITE : GREEN);
        button.setMinHeight(dp(48));
        button.setBackground(rounded(primary ? GREEN : Color.WHITE, 10, primary ? GREEN : LINE));
        return button;
    }

    private Button smallButton(String label, boolean primary) {
        Button button = button(label, primary);
        button.setTextSize(14);
        button.setPadding(dp(10), 0, dp(10), 0);
        return button;
    }

    private GradientDrawable rounded(int fill, int radius, int stroke) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(fill);
        drawable.setCornerRadius(dp(radius));
        if (stroke != Color.TRANSPARENT) drawable.setStroke(dp(1), stroke);
        return drawable;
    }

    private LinearLayout.LayoutParams matchWrap() {
        return new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
    }

    private LinearLayout.LayoutParams matchWrapTop(int top) {
        LinearLayout.LayoutParams params = matchWrap();
        params.topMargin = dp(top);
        return params;
    }

    private LinearLayout.LayoutParams matchWrapBottom(int bottom) {
        LinearLayout.LayoutParams params = matchWrap();
        params.bottomMargin = dp(bottom);
        return params;
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }

    private static JSONObject json(Object... pairs) throws JSONException {
        JSONObject object = new JSONObject();
        for (int index = 0; index + 1 < pairs.length; index += 2) object.put(String.valueOf(pairs[index]), pairs[index + 1]);
        return object;
    }

    private String money(long amount) {
        NumberFormat formatter = NumberFormat.getCurrencyInstance(new Locale("id", "ID"));
        formatter.setMaximumFractionDigits(0);
        return formatter.format(amount);
    }

    private String dateText(String value) {
        if (value == null || value.isEmpty() || "null".equals(value)) return "";
        String normalized = value.replace('T', ' ').replace("Z", "");
        return normalized.length() > 16 ? normalized.substring(0, 16) : normalized;
    }

    private String stringValue(JSONObject object, String key, String fallback) {
        if (object == null || object.isNull(key)) return fallback;
        String value = object.optString(key, fallback);
        return value == null || "null".equalsIgnoreCase(value) ? fallback : value;
    }

    private String customFieldLabel(JSONObject item, String key) {
        JSONArray fields = item.optJSONArray("field_snapshot");
        if (fields != null) for (int index = 0; index < fields.length(); index++) {
            JSONObject field = fields.optJSONObject(index);
            if (field != null && key.equals(field.optString("key"))) return field.optString("label", key);
        }
        return key;
    }

    private String statusLabel(String type, String code) {
        if ("order".equals(type)) {
            switch (code) {
                case "new": return "Baru";
                case "accepted": return "Diterima";
                case "completed": return "Selesai";
                case "cancelled": return "Dibatalkan";
            }
        } else if ("production".equals(type)) {
            switch (code) {
                case "pending": return "Menunggu";
                case "in_progress": return "Diproses";
                case "completed": return "Selesai";
                case "cancelled": return "Dibatalkan";
            }
        } else if ("payment".equals(type)) {
            switch (code) {
                case "pending": return "Menunggu pembayaran";
                case "paid": return "Lunas";
                case "failed": return "Gagal";
                case "refunded": return "Dikembalikan";
            }
        } else if ("shipment".equals(type)) {
            switch (code) {
                case "pending": return "Menunggu dikirim";
                case "shipped": return "Dalam perjalanan";
                case "delivered": return "Diterima pelanggan";
                case "failed": return "Pengiriman bermasalah";
                case "returned": return "Dikembalikan";
            }
        }
        return code == null || code.isEmpty() ? "Belum tersedia" : code;
    }

    private void registerForOrderNotifications(AdminApi session) {
        if (FirebaseApp.getApps(this).isEmpty()) return;
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 701);
            return;
        }
        FirebaseMessaging.getInstance().getToken().addOnSuccessListener(token -> sendDeviceRegistration(session, token, false));
    }

    private void sendDeviceRegistration(AdminApi session, String token, boolean remove) {
        fcmRegistrationExecutor.execute(() -> {
            try {
                session.post(remove ? "/api/admin/devices/remove" : "/api/admin/devices",
                        json("registration_token", token, "label", Build.MANUFACTURER + " " + Build.MODEL));
            } catch (Exception ignored) {
                // Notification registration is optional; the order-management API remains available.
            }
        });
    }

    private void unregisterNotificationDevice(AdminApi session) {
        if (session == null || FirebaseApp.getApps(this).isEmpty()) return;
        FirebaseMessaging.getInstance().getToken().addOnSuccessListener(token -> sendDeviceRegistration(session, token, true));
    }

    static void onFcmTokenRefreshed(String token) {
        AdminApi session = activeSession;
        if (session == null) return;
        fcmRegistrationExecutor.execute(() -> {
            try {
                JSONObject body = new JSONObject().put("registration_token", token).put("label", "Ruma Admin Android");
                session.post("/api/admin/devices", body);
            } catch (Exception ignored) {
                // The next successful admin login retries the latest FCM token.
            }
        });
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == 701 && grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED && api != null) {
            registerForOrderNotifications(api);
        }
    }

    private interface IoAction { void run() throws Exception; }
    private interface ErrorAction { void accept(IOException error); }
}
