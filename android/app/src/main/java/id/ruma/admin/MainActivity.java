package id.ruma.admin;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.content.pm.PackageManager;
import android.text.InputType;
import android.text.method.PasswordTransformationMethod;
import android.util.Base64;
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
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

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
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

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
    private static final int PICK_REFUND_PROOF = 703;
    private static final String ADMIN_TOKEN_PREFS = "admin_session";
    private static final String ADMIN_TOKEN_ALIAS = "id.ruma.admin.token";
    private static final String ADMIN_TOKEN_IV = "token_iv";
    private static final String ADMIN_TOKEN_VALUE = "token_ciphertext";
    private static final String ORDER_CACHE_PREFS = "encrypted_order_cache_v1";
    private static final String ORDER_CACHE_ALIAS = "id.ruma.admin.orders";
    private static final String ORDER_CACHE_IV = "cache_iv";
    private static final String ORDER_CACHE_VALUE = "cache_ciphertext";
    private static final int ORDER_CACHE_MAX_ENTRIES = 12;
    private static final String DEFAULT_API_BASE_URL = "https://toqoku-api.netlify.app";
    private static AdminApi activeSession;
    private static volatile MainActivity visibleActivity;
    private static final ExecutorService fcmRegistrationExecutor = Executors.newSingleThreadExecutor();

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private AdminApi api;
    private String apiBaseUrl;
    private String currentOrderCode;
    private String orderFilter = "new";
    private String paymentFilter = "";
    private String refundFilter = "";
    private String searchQuery = "";
    private String orderTransitionNotice = "";
    private LinearLayout orderTabBar;
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
    private String pendingRefundProofId;

    private static final class CachedPayload {
        final String json;
        final long savedAt;

        CachedPayload(String json, long savedAt) {
            this.json = json;
            this.savedAt = savedAt;
        }
    }

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(DARK_GREEN);
        getWindow().setNavigationBarColor(Color.WHITE);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        apiBaseUrl = DEFAULT_API_BASE_URL;
        api = activeSession;
        if (api == null) {
            String savedToken = loadAdminToken();
            if (savedToken != null) {
                try {
                    api = new AdminApi(apiBaseUrl, savedToken);
                    activeSession = api;
                } catch (IOException error) {
                    clearAdminToken();
                }
            }
        }
        notificationOrderCode = getIntent().getStringExtra("order_code");
        AdminFirebaseMessagingService.createChannel(this);
        AdminFirebaseMessagingService.markAllRead(this);
        if (api == null) showLogin("");
        else {
            registerForOrderNotifications(api);
            if (notificationOrderCode != null && !notificationOrderCode.isEmpty()) showOrderDetail(notificationOrderCode);
            else showOrderList(false);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        visibleActivity = this;
        AdminFirebaseMessagingService.markAllRead(this);
    }

    @Override
    protected void onPause() {
        if (visibleActivity == this) visibleActivity = null;
        super.onPause();
    }

    static boolean isAppVisible() { return visibleActivity != null; }

    static void refreshVisibleOrderListFromPush() {
        MainActivity activity = visibleActivity;
        if (activity == null) return;
        activity.runOnUiThread(() -> {
            if (activity.api != null && activity.currentOrderCode == null
                    && activity.refundFilter.isEmpty() && "new".equals(activity.orderFilter)) {
                activity.loadOrders(false);
            }
        });
    }

    @Override
    protected void onDestroy() {
        if (isFinishing()) executor.shutdownNow();
        super.onDestroy();
    }

    private void saveAdminToken(String token) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateEncryptionKey(ADMIN_TOKEN_ALIAS));
        byte[] encrypted = cipher.doFinal(token.getBytes(StandardCharsets.UTF_8));
        SharedPreferences preferences = getSharedPreferences(ADMIN_TOKEN_PREFS, MODE_PRIVATE);
        boolean saved = preferences.edit()
                .putString(ADMIN_TOKEN_IV, Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
                .putString(ADMIN_TOKEN_VALUE, Base64.encodeToString(encrypted, Base64.NO_WRAP))
                .commit();
        if (!saved) throw new IOException("Token tidak berhasil disimpan aman di perangkat.");
    }

    private String loadAdminToken() { return loadAdminToken(this); }

    static String loadAdminToken(Context context) {
        SharedPreferences preferences = context.getSharedPreferences(ADMIN_TOKEN_PREFS, MODE_PRIVATE);
        String encodedIv = preferences.getString(ADMIN_TOKEN_IV, null);
        String encodedValue = preferences.getString(ADMIN_TOKEN_VALUE, null);
        if (encodedIv == null || encodedValue == null) return null;
        try {
            KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
            keyStore.load(null);
            SecretKey secretKey = (SecretKey) keyStore.getKey(ADMIN_TOKEN_ALIAS, null);
            if (secretKey == null) throw new IOException("Kunci penyimpanan token tidak tersedia.");
            byte[] iv = Base64.decode(encodedIv, Base64.NO_WRAP);
            byte[] encrypted = Base64.decode(encodedValue, Base64.NO_WRAP);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, secretKey, new GCMParameterSpec(128, iv));
            return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
        } catch (Exception error) {
            return null;
        }
    }

    private void clearAdminToken() {
        getSharedPreferences(ADMIN_TOKEN_PREFS, MODE_PRIVATE).edit().clear().apply();
        clearOrderCache();
        deleteEncryptionKey(ADMIN_TOKEN_ALIAS);
    }

    static void syncOrdersCacheFromPush(Context context) throws Exception {
        String token = loadAdminToken(context);
        if (token == null || token.isEmpty()) return;
        AdminApi backgroundApi = new AdminApi(DEFAULT_API_BASE_URL, token);
        JSONArray orders = backgroundApi.get("/api/admin/orders?limit=100&order_status=new").optJSONArray("data");
        if (orders == null) orders = new JSONArray();

        SharedPreferences preferences = context.getSharedPreferences(ORDER_CACHE_PREFS, MODE_PRIVATE);
        JSONArray previous = new JSONArray();
        String encodedIv = preferences.getString(ORDER_CACHE_IV, null);
        String encodedValue = preferences.getString(ORDER_CACHE_VALUE, null);
        if (encodedIv != null && encodedValue != null) {
            try {
                KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
                keyStore.load(null);
                SecretKey cacheKey = (SecretKey) keyStore.getKey(ORDER_CACHE_ALIAS, null);
                if (cacheKey != null) {
                    Cipher decrypt = Cipher.getInstance("AES/GCM/NoPadding");
                    decrypt.init(Cipher.DECRYPT_MODE, cacheKey,
                            new GCMParameterSpec(128, Base64.decode(encodedIv, Base64.NO_WRAP)));
                    String decoded = new String(decrypt.doFinal(Base64.decode(encodedValue, Base64.NO_WRAP)), StandardCharsets.UTF_8);
                    JSONArray entries = new JSONObject(decoded).optJSONArray("entries");
                    if (entries != null) previous = entries;
                }
            } catch (Exception ignored) {
                previous = new JSONArray();
            }
        }

        List<JSONObject> entries = new ArrayList<>();
        for (int index = 0; index < previous.length(); index++) {
            JSONObject entry = previous.optJSONObject(index);
            if (entry != null && !"orders|new||".equals(entry.optString("key"))) entries.add(entry);
        }
        entries.add(new JSONObject().put("key", "orders|new||")
                .put("saved_at", System.currentTimeMillis()).put("payload", orders.toString()));
        entries.sort((left, right) -> Long.compare(right.optLong("saved_at"), left.optLong("saved_at")));
        JSONArray limited = new JSONArray();
        for (int index = 0; index < entries.size() && index < ORDER_CACHE_MAX_ENTRIES; index++) {
            limited.put(entries.get(index));
        }

        Cipher encrypt = Cipher.getInstance("AES/GCM/NoPadding");
        encrypt.init(Cipher.ENCRYPT_MODE, getOrCreateEncryptionKey(ORDER_CACHE_ALIAS));
        byte[] encrypted = encrypt.doFinal(new JSONObject().put("entries", limited).toString().getBytes(StandardCharsets.UTF_8));
        if (!preferences.edit()
                .putString(ORDER_CACHE_IV, Base64.encodeToString(encrypt.getIV(), Base64.NO_WRAP))
                .putString(ORDER_CACHE_VALUE, Base64.encodeToString(encrypted, Base64.NO_WRAP)).commit()) {
            throw new IOException("Cache pesanan tidak berhasil diperbarui.");
        }
    }

    private static SecretKey getOrCreateEncryptionKey(String alias) throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        if (keyStore.containsAlias(alias)) return (SecretKey) keyStore.getKey(alias, null);
        KeyGenerator keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        keyGenerator.init(new KeyGenParameterSpec.Builder(alias,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build());
        return keyGenerator.generateKey();
    }

    private static void deleteEncryptionKey(String alias) {
        try {
            KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
            keyStore.load(null);
            if (keyStore.containsAlias(alias)) keyStore.deleteEntry(alias);
        } catch (Exception ignored) { }
    }

    private CachedPayload readCachedPayload(String cacheKey) {
        try {
            SharedPreferences preferences = getSharedPreferences(ORDER_CACHE_PREFS, MODE_PRIVATE);
            String encodedIv = preferences.getString(ORDER_CACHE_IV, null);
            String encodedValue = preferences.getString(ORDER_CACHE_VALUE, null);
            if (encodedIv == null || encodedValue == null) return null;
            KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
            keyStore.load(null);
            SecretKey secretKey = (SecretKey) keyStore.getKey(ORDER_CACHE_ALIAS, null);
            if (secretKey == null) return null;
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, secretKey,
                    new GCMParameterSpec(128, Base64.decode(encodedIv, Base64.NO_WRAP)));
            String decoded = new String(cipher.doFinal(Base64.decode(encodedValue, Base64.NO_WRAP)), StandardCharsets.UTF_8);
            JSONArray entries = new JSONObject(decoded).optJSONArray("entries");
            if (entries == null) return null;
            for (int index = 0; index < entries.length(); index++) {
                JSONObject entry = entries.optJSONObject(index);
                if (entry != null && cacheKey.equals(entry.optString("key"))) {
                    return new CachedPayload(entry.optString("payload", ""), entry.optLong("saved_at", 0));
                }
            }
        } catch (Exception error) {
            clearOrderCache();
        }
        return null;
    }

    private void saveCachedPayload(String cacheKey, String payload) throws Exception {
        SharedPreferences preferences = getSharedPreferences(ORDER_CACHE_PREFS, MODE_PRIVATE);
        JSONArray previousEntries = readOrderCacheEntries(preferences);
        List<JSONObject> entries = new ArrayList<>();
        for (int index = 0; index < previousEntries.length(); index++) {
            JSONObject entry = previousEntries.optJSONObject(index);
            if (entry != null && !cacheKey.equals(entry.optString("key"))) entries.add(entry);
        }
        entries.add(new JSONObject()
                .put("key", cacheKey)
                .put("saved_at", System.currentTimeMillis())
                .put("payload", payload));
        entries.sort((left, right) -> Long.compare(right.optLong("saved_at"), left.optLong("saved_at")));
        JSONArray boundedEntries = new JSONArray();
        for (int index = 0; index < entries.size() && index < ORDER_CACHE_MAX_ENTRIES; index++) {
            boundedEntries.put(entries.get(index));
        }
        JSONObject store = new JSONObject().put("entries", boundedEntries);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateEncryptionKey(ORDER_CACHE_ALIAS));
        byte[] encrypted = cipher.doFinal(store.toString().getBytes(StandardCharsets.UTF_8));
        boolean saved = preferences.edit()
                .putString(ORDER_CACHE_IV, Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
                .putString(ORDER_CACHE_VALUE, Base64.encodeToString(encrypted, Base64.NO_WRAP))
                .commit();
        if (!saved) throw new IOException("Cache pesanan tidak berhasil disimpan.");
    }

    private JSONArray readOrderCacheEntries(SharedPreferences preferences) {
        try {
            String encodedIv = preferences.getString(ORDER_CACHE_IV, null);
            String encodedValue = preferences.getString(ORDER_CACHE_VALUE, null);
            if (encodedIv == null || encodedValue == null) return new JSONArray();
            KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
            keyStore.load(null);
            SecretKey secretKey = (SecretKey) keyStore.getKey(ORDER_CACHE_ALIAS, null);
            if (secretKey == null) return new JSONArray();
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, secretKey,
                    new GCMParameterSpec(128, Base64.decode(encodedIv, Base64.NO_WRAP)));
            String decoded = new String(cipher.doFinal(Base64.decode(encodedValue, Base64.NO_WRAP)), StandardCharsets.UTF_8);
            JSONArray entries = new JSONObject(decoded).optJSONArray("entries");
            return entries == null ? new JSONArray() : entries;
        } catch (Exception error) {
            preferences.edit().clear().commit();
            deleteEncryptionKey(ORDER_CACHE_ALIAS);
            return new JSONArray();
        }
    }

    private void clearOrderCache() {
        getSharedPreferences(ORDER_CACHE_PREFS, MODE_PRIVATE).edit().clear().apply();
        deleteEncryptionKey(ORDER_CACHE_ALIAS);
    }

    private String ordersCacheKey(String status, String payment, String query) {
        return "orders|" + status + "|" + payment + "|" + query.trim().toLowerCase(Locale.ROOT);
    }

    private String detailCacheKey(String orderCode) {
        return "detail|" + orderCode.trim().toUpperCase(Locale.ROOT);
    }

    private String cacheTimeLabel(long timestamp) {
        return new SimpleDateFormat("HH:mm", new Locale("id", "ID")).format(new Date(timestamp));
    }

    private void showLogin(String message) {
        api = null;
        newPage();
        addBrandHeader("Ajielt7", "Pesanan dan pembayaran");
        addText(page, "Masuk admin", 26, INK, true, 18, 0, 0, 0);
        addText(page, "Token admin", 14, MUTED, true, 16, 12, 0, 4);
        EditText tokenInput = input("", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        tokenInput.setSingleLine(true);
        tokenInput.setHint("ADMIN_TOKEN");
        tokenInput.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);
        tokenInput.setSaveEnabled(false);
        tokenInput.setTransformationMethod(PasswordTransformationMethod.getInstance());
        tokenInput.setTypeface(Typeface.DEFAULT);
        tokenInput.setImeOptions(EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING);
        page.addView(tokenInput, matchWrap());
        addText(page, "Login ini tersimpan aman di perangkat. Gunakan HTTPS.", 13, MUTED, false, 8, 0, 0, 0);
        TextView messageView = addText(page, message, 14, Color.rgb(176, 51, 39), false, 14, 0, 0, 0);
        Button login = button("Masuk", true);
        page.addView(login, matchWrapTop(18));
        login.setOnClickListener(view -> {
            String token = tokenInput.getText().toString();
            try {
                AdminApi candidate = new AdminApi(apiBaseUrl, token);
                login.setEnabled(false);
                messageView.setText("Memeriksa akses admin…");
                runIo(() -> {
                    candidate.get("/api/admin/orders?limit=1");
                    saveAdminToken(token.trim());
                    runOnUiThread(() -> {
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
        finishPage();
    }

    private void showOrderList(boolean fetch) {
        newOrderListPage();
        addToolbar("Pesanan", true, () -> showLogin(""));
        addText(page, refundFilter.isEmpty() ? "Pesanan terbaru" : "Permintaan refund", 15, MUTED, false, 0, 0, 0, 10);

        LinearLayout actions = horizontal();
        if (refundFilter.isEmpty()) {
            Button refunds = smallButton("Refund", false);
            actions.addView(refunds, new LinearLayout.LayoutParams(0, dp(46), 1));
            refunds.setOnClickListener(view -> {
                refundFilter = "requested";
                paymentFilter = "";
                showOrderList(true);
            });
        } else {
            Button requested = smallButton("Diminta", "requested".equals(refundFilter));
            Button approved = smallButton("Disetujui", "approved".equals(refundFilter));
            LinearLayout.LayoutParams toggleParams = new LinearLayout.LayoutParams(0, dp(46), 1);
            actions.addView(requested, toggleParams);
            LinearLayout.LayoutParams approvedParams = new LinearLayout.LayoutParams(0, dp(46), 1);
            approvedParams.leftMargin = dp(6);
            actions.addView(approved, approvedParams);
            requested.setOnClickListener(view -> { refundFilter = "requested"; showOrderList(true); });
            approved.setOnClickListener(view -> { refundFilter = "approved"; showOrderList(true); });
        }
        Button refresh = smallButton("Muat ulang", false);
        LinearLayout.LayoutParams refreshParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, dp(46));
        refreshParams.leftMargin = dp(8);
        actions.addView(refresh, refreshParams);
        page.addView(actions, matchWrap());
        refresh.setOnClickListener(view -> loadOrders(true));

        if (refundFilter.isEmpty()) {
            LinearLayout searchRow = horizontal();
            searchInput = input(searchQuery, InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
            searchInput.setSingleLine(true);
            searchInput.setHint("Cari kode atau nama");
            searchInput.setImeOptions(EditorInfo.IME_ACTION_SEARCH);
            searchRow.addView(searchInput, new LinearLayout.LayoutParams(0, dp(48), 1));
            Button search = smallButton("Cari", true);
            LinearLayout.LayoutParams searchButtonParams = new LinearLayout.LayoutParams(dp(76), dp(48));
            searchButtonParams.leftMargin = dp(8);
            searchRow.addView(search, searchButtonParams);
            page.addView(searchRow, matchWrapTop(8));
            search.setOnClickListener(view -> { searchQuery = searchInput.getText().toString().trim(); loadOrders(); });
            searchInput.setOnEditorActionListener((view, actionId, event) -> {
                if (actionId == EditorInfo.IME_ACTION_SEARCH) {
                    searchQuery = searchInput.getText().toString().trim();
                    loadOrders();
                    return true;
                }
                return false;
            });
        }

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
        finishPage();
        if (fetch) loadOrders(!orderTransitionNotice.isEmpty());
    }

    private void newOrderListPage() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(PAGE);
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);
        page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setPadding(dp(20), dp(16), dp(20), dp(20));
        page.setBackgroundColor(PAGE);
        scroll.addView(page, new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        root.addView(scroll, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));
        orderTabBar = horizontal();
        orderTabBar.setBackground(rounded(Color.WHITE, 0, LINE));
        orderTabBar.setElevation(dp(8));
        addOrderTab("Baru", "new");
        addOrderTab("Proses", "accepted");
        addOrderTab("Riwayat", "history");
        root.addView(orderTabBar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(64)));
        setContentView(root);
        feedback = null;
        progress = null;
        content = null;
        searchInput = null;
        adminNoteInput = null;
    }

    private void addOrderTab(String label, String status) {
        TextView tab = new TextView(this);
        boolean selected = refundFilter.isEmpty() && status.equals(orderFilter);
        tab.setText(label);
        tab.setTextSize(16);
        tab.setGravity(Gravity.CENTER);
        tab.setTypeface(Typeface.DEFAULT, selected ? Typeface.BOLD : Typeface.NORMAL);
        tab.setTextColor(selected ? GREEN : MUTED);
        tab.setBackgroundColor(Color.TRANSPARENT);
        tab.setContentDescription(label + (selected ? ", dipilih" : ""));
        orderTabBar.addView(tab, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1));
        tab.setOnClickListener(view -> {
            if (status.equals(orderFilter) && refundFilter.isEmpty()) return;
            orderFilter = status;
            paymentFilter = "";
            refundFilter = "";
            showOrderList(true);
        });
    }

    private void loadOrders() { loadOrders(false); }

    private void loadOrders(boolean forceRefresh) {
        if (api == null) { showLogin(""); return; }
        if (!refundFilter.isEmpty()) { loadRefunds(); return; }
        if (searchInput != null) searchQuery = searchInput.getText().toString().trim();
        String cacheKey = ordersCacheKey(orderFilter, paymentFilter, searchQuery);
        setBusy(true, "Memeriksa cache pesanan…");
        runIo(() -> {
            CachedPayload cached = readCachedPayload(cacheKey);
            if (cached != null) {
                JSONArray cachedOrders = new JSONArray(cached.json);
                runOnUiThread(() -> {
                    renderOrders(cachedOrders);
                    setBusy(forceRefresh,
                            "Cache lokal · diperbarui " + cacheTimeLabel(cached.savedAt));
                });
                if (!forceRefresh) return;
            } else {
                runOnUiThread(() -> setBusy(true, "Memuat pesanan dari server…"));
            }
            JSONArray orders;
            if ("history".equals(orderFilter)) {
                // Older deployed API versions may not recognize the synthetic "history" filter.
                // Fetch the two terminal statuses separately so the tab still works during rollout.
                orders = new JSONArray();
                appendOrders(orders, api.get(buildOrdersPath("completed")).optJSONArray("data"));
                appendOrders(orders, api.get(buildOrdersPath("cancelled")).optJSONArray("data"));
            } else {
                orders = api.get(buildOrdersPath(orderFilter)).optJSONArray("data");
            }
            JSONArray latestOrders = orders == null ? new JSONArray() : orders;
            saveCachedPayload(cacheKey, latestOrders.toString());
            long syncedAt = System.currentTimeMillis();
            runOnUiThread(() -> {
                renderOrders(latestOrders);
                setBusy(false, latestOrders.length() + " pesanan · disinkronkan " + cacheTimeLabel(syncedAt));
            });
        }, error -> {
            if (error instanceof AdminApi.ApiException
                    && (((AdminApi.ApiException) error).statusCode == 401 || ((AdminApi.ApiException) error).statusCode == 403)) {
                clearAdminToken();
                activeSession = null;
                api = null;
                showLogin("Sesi berakhir. Masukkan token admin kembali.");
                return;
            }
            if (content != null && content.getChildCount() > 0) {
                setBusy(false, "Cache lokal ditampilkan · server gagal: " + error.getMessage());
            } else {
                setBusy(false, error.getMessage());
                if (content != null) addEmptyState("Pesanan belum dapat dimuat.", "Coba muat ulang setelah koneksi tersedia.");
            }
        });
    }

    private String buildOrdersPath(String status) {
        StringBuilder path = new StringBuilder("/api/admin/orders?limit=100");
        if (status != null && !status.isEmpty()) path.append("&order_status=").append(status);
        if (!paymentFilter.isEmpty()) path.append("&payment_status=").append(paymentFilter);
        if (!searchQuery.isEmpty()) {
            try { path.append("&q=").append(URLEncoder.encode(searchQuery, StandardCharsets.UTF_8.name())); }
            catch (Exception ignored) { }
        }
        return path.toString();
    }

    private void appendOrders(JSONArray target, JSONArray source) {
        if (source == null) return;
        for (int index = 0; index < source.length(); index++) {
            JSONObject order = source.optJSONObject(index);
            if (order != null) target.put(order);
        }
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
            clearOrderCache();
            runOnUiThread(() -> {
                feedback.setText(response.optString("message", "Status refund diperbarui."));
                loadRefunds();
            });
        }, error -> setBusy(false, error.getMessage()));
    }

    private void renderOrders(JSONArray orders) {
        String notice = orderTransitionNotice;
        orderTransitionNotice = "";
        setBusy(false, notice.isEmpty()
                ? (orders.length() == 0 ? "Belum ada pesanan pada filter ini." : orders.length() + " pesanan terbaru")
                : notice);
        content.removeAllViews();
        if (orders.length() == 0) {
            addEmptyState("Belum ada pesanan", "Pesanan baru akan muncul di sini.");
            return;
        }
        LinearLayout row = null;
        int visibleIndex = 0;
        for (int index = 0; index < orders.length(); index++) {
            JSONObject order = orders.optJSONObject(index);
            if (order == null) continue;
            if (visibleIndex % 2 == 0) {
                row = horizontal();
                content.addView(row, matchWrapTop(2));
            }
            LinearLayout card = new LinearLayout(this);
            card.setOrientation(LinearLayout.VERTICAL);
            card.setPadding(dp(12), dp(14), dp(12), dp(14));
            card.setMinimumHeight(dp(136));
            card.setBackground(rounded(Color.WHITE, 12, LINE));
            card.setFocusable(true);
            LinearLayout.LayoutParams cardParams = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1);
            cardParams.setMargins(dp(visibleIndex % 2 == 0 ? 0 : 5), 0, dp(visibleIndex % 2 == 0 ? 5 : 0), dp(10));
            row.addView(card, cardParams);
            addText(card, stringValue(order, "order_code", "Pesanan"), 18, GREEN, true, 0, 0, 0, 6);
            TextView customer = addText(card, stringValue(order, "customer_name", "Pelanggan"), 14, INK, true, 0, 0, 0, 7);
            customer.setMaxLines(2);
            addText(card, money(order.optLong("total_amount")), 13, MUTED, false, 0, 0, 0, 5);
            addText(card, statusLabel("order", stringValue(order, "order_status", "new")), 13, INK, false, 0, 0, 0, 3);
            addText(card, "Bayar: " + statusLabel("payment", stringValue(order, "payment_status", "pending"))
                    + " - Bukti: " + (order.optBoolean("has_payment_proof") ? "ada" : "belum ada"), 12, MUTED, false, 0, 0, 0, 0);
            String code = order.optString("order_code", "");
            card.setContentDescription("Pesanan " + code + ", " + stringValue(order, "customer_name", "Pelanggan"));
            card.setOnClickListener(view -> showOrderDetail(code));
            visibleIndex++;
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
        loadOrderDetail(false);
    }

    private void loadOrderDetail() { loadOrderDetail(false); }

    private void loadOrderDetail(boolean forceRefresh) {
        if (api == null || currentOrderCode == null) { showLogin(""); return; }
        String code = currentOrderCode;
        String cacheKey = detailCacheKey(code);
        setBusy(true, "Memeriksa cache detail…");
        runIo(() -> {
            CachedPayload cached = readCachedPayload(cacheKey);
            if (cached != null) {
                JSONObject cachedOrder = new JSONObject(cached.json);
                runOnUiThread(() -> {
                    renderOrderDetail(cachedOrder);
                    setBusy(forceRefresh,
                            "Cache lokal · diperbarui " + cacheTimeLabel(cached.savedAt));
                });
                if (!forceRefresh) return;
            } else {
                runOnUiThread(() -> setBusy(true, "Memuat detail dari server…"));
            }
            JSONObject response = api.get("/api/admin/orders/" + code);
            JSONObject data = response.optJSONObject("data");
            if (data == null) throw new IOException("Detail pesanan kosong.");
            saveCachedPayload(cacheKey, data.toString());
            long syncedAt = System.currentTimeMillis();
            runOnUiThread(() -> {
                renderOrderDetail(data);
                setBusy(false, "Detail disinkronkan " + cacheTimeLabel(syncedAt));
            });
        }, error -> {
            if (error instanceof AdminApi.ApiException
                    && (((AdminApi.ApiException) error).statusCode == 401 || ((AdminApi.ApiException) error).statusCode == 403)) {
                clearAdminToken();
                activeSession = null;
                api = null;
                showLogin("Sesi berakhir. Masukkan token admin kembali.");
            } else if (content != null && content.getChildCount() > 0) {
                setBusy(false, "Cache lokal ditampilkan · server gagal: " + error.getMessage());
            } else {
                setBusy(false, error.getMessage());
            }
        });
    }

    private void renderOrderDetail(JSONObject order) {
        loadedOrder = order;
        content.removeAllViews();
        setBusy(false, "");
        boolean cancelled = "cancelled".equals(stringValue(order, "order_status", ""));
        boolean completed = "completed".equals(stringValue(order, "order_status", ""));
        if ("new".equals(order.optString("order_status", "new"))) {
            renderNewOrderDetail(order);
            return;
        }
        if ("accepted".equals(order.optString("order_status", ""))) {
            renderProcessOrderDetail(order);
            return;
        }
        if (cancelled || completed) {
            renderHistoryOrderDetail(order, cancelled);
            return;
        }
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

        if (!cancelled && !completed) {
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

        if (completed) renderCompletedShipment(order);

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

        if (!cancelled && !completed) {
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
        }

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

    private void renderHistoryOrderDetail(JSONObject order, boolean cancelled) {
        LinearLayout header = horizontal();
        header.setGravity(Gravity.CENTER_VERTICAL);
        content.addView(header, matchWrapBottom(12));
        LinearLayout identity = new LinearLayout(this);
        identity.setOrientation(LinearLayout.VERTICAL);
        header.addView(identity, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        addText(identity, stringValue(order, "order_code", currentOrderCode), 18, INK, true, 0, 0, 0, 4);
        addText(identity, stringValue(order, "customer_name", "Pelanggan"), 16, INK, true, 0, 0, 0, 0);
        LinearLayout statusAndPrice = new LinearLayout(this);
        statusAndPrice.setOrientation(LinearLayout.VERTICAL);
        statusAndPrice.setGravity(Gravity.END);
        header.addView(statusAndPrice, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        addText(statusAndPrice, statusLabel("order", cancelled ? "cancelled" : "completed"), 13, MUTED, true, 0, 0, 0, 3);
        addText(statusAndPrice, money(order.optLong("total_amount")), 20, GREEN, true, 0, 0, 0, 0);

        LinearLayout detail = card(content);
        addText(detail, "Detail pesanan dan harga", 17, GREEN, true, 0, 0, 0, 8);
        JSONArray items = order.optJSONArray("items");
        if (items != null) for (int index = 0; index < items.length(); index++) {
            JSONObject item = items.optJSONObject(index);
            if (item == null) continue;
            addText(detail, item.optString("name", "Produk") + "  ×  " + item.optInt("quantity"), 16, INK, true, 0, 0, 0, 3);
            addText(detail, money(item.optLong("unit_price_amount")) + " per item · " + money(item.optLong("line_total_amount")), 14, MUTED, false, 0, 0, 0, 3);
            String size = stringValue(item, "fixed_size_snapshot", "");
            if (!size.isEmpty()) addText(detail, "Ukuran: " + size, 14, MUTED, false, 0, 0, 0, 3);
            JSONObject custom = item.optJSONObject("customization");
            if (custom != null) {
                java.util.Iterator<String> customKeys = custom.keys();
                while (customKeys.hasNext()) {
                    String key = customKeys.next();
                    addText(detail, customFieldLabel(item, key) + ": " + custom.optString(key), 14, MUTED, false, 0, 0, 0, 3);
                }
            }
            String itemId = item.optString("id", "");
            Button createDxf = smallButton("Buat gambar DXF", false);
            detail.addView(createDxf, matchWrapTop(5));
            createDxf.setOnClickListener(view -> createProductionDxf(itemId, createDxf));
            JSONArray files = item.optJSONArray("production_files");
            if (files != null) for (int fileIndex = 0; fileIndex < files.length(); fileIndex++) {
                JSONObject file = files.optJSONObject(fileIndex);
                if (file == null) continue;
                Button download = smallButton("Simpan DXF v" + file.optInt("version"), false);
                detail.addView(download, matchWrapTop(4));
                String fileId = file.optString("id", "");
                download.setOnClickListener(view -> downloadProductionDxf(fileId, file.optString("file_name"), download));
            }
        }
        if (!cancelled) renderCompletedShipment(order);
        else renderRefundProof(order);
    }

    private void renderRefundProof(JSONObject order) {
        String refundId = stringValue(order, "refund_id", "");
        if (refundId.isEmpty() || !order.optBoolean("has_payment_proof")) return;
        LinearLayout refund = section("Bukti pengembalian dana");
        addText(refund, "Status refund: " + statusLabel("payment", "refunded"), 14, MUTED, false, 0, 0, 0, 6);
        ImageView proofImage = new ImageView(this);
        proofImage.setVisibility(View.GONE);
        proofImage.setAdjustViewBounds(true);
        proofImage.setScaleType(ImageView.ScaleType.FIT_CENTER);
        proofImage.setMaxHeight(dp(420));
        proofImage.setContentDescription("Bukti transfer pengembalian dana");
        refund.addView(proofImage, matchWrapTop(6));
        if (order.optBoolean("has_refund_proof")) {
            Button viewProof = smallButton("Lihat bukti pengembalian", false);
            refund.addView(viewProof, matchWrapTop(6));
            viewProof.setOnClickListener(view -> loadRefundProof(refundId, viewProof, proofImage));
        } else {
            addText(refund, "Unggah bukti transfer yang telah dikirim ke rekening asal pembayaran.", 14, MUTED, false, 0, 0, 0, 6);
            Button upload = smallButton("Unggah bukti pengembalian", true);
            refund.addView(upload, matchWrapTop(4));
            upload.setOnClickListener(view -> chooseRefundProof(refundId));
        }
    }

    private void renderCompletedShipment(JSONObject order) {
        LinearLayout shipping = section("Pengiriman");
        addText(shipping, "Kurir / Ojol", 13, MUTED, false, 0, 0, 0, 3);
        String courier = stringValue(order, "shipping_courier_name", stringValue(order, "carrier", "Kurir"));
        String service = stringValue(order, "shipping_service", "");
        addText(shipping, service.isEmpty() ? courier : courier + " · " + service, 16, INK, true, 0, 0, 0, 8);

        addText(shipping, "Nomor resi", 13, MUTED, false, 0, 0, 0, 3);
        TextView trackingNumberLabel = addText(shipping,
                stringValue(order, "tracking_number", "Nomor resi belum diisi"),
                15, INK, false, 0, 0, 0, 3);
        trackingNumberLabel.setPadding(dp(10), dp(10), dp(10), dp(10));
        trackingNumberLabel.setBackground(rounded(Color.WHITE, 8, LINE));
        EditText trackingNumber = input(stringValue(order, "tracking_number", ""),
                InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS);
        trackingNumber.setSingleLine(true);
        trackingNumber.setHint("Nomor resi");
        trackingNumber.setVisibility(View.GONE);
        shipping.addView(trackingNumber, matchWrapTop(2));

        addText(shipping, "URL tracking", 13, MUTED, false, 0, 8, 0, 3);
        TextView trackingUrlLabel = addText(shipping,
                stringValue(order, "tracking_url", "URL tracking belum diisi"),
                15, INK, false, 0, 0, 0, 3);
        trackingUrlLabel.setPadding(dp(10), dp(10), dp(10), dp(10));
        trackingUrlLabel.setBackground(rounded(Color.WHITE, 8, LINE));
        EditText trackingUrl = input(stringValue(order, "tracking_url", ""),
                InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        trackingUrl.setSingleLine(true);
        trackingUrl.setHint("https:// tautan tracking");
        trackingUrl.setVisibility(View.GONE);
        shipping.addView(trackingUrl, matchWrapTop(2));

        Button editSave = smallButton("Edit", true);
        shipping.addView(editSave, matchWrapTop(8));
        boolean[] editing = {false};
        editSave.setOnClickListener(view -> {
            if (!editing[0]) {
                editing[0] = true;
                trackingNumberLabel.setVisibility(View.GONE);
                trackingUrlLabel.setVisibility(View.GONE);
                trackingNumber.setVisibility(View.VISIBLE);
                trackingUrl.setVisibility(View.VISIBLE);
                editSave.setText("Simpan");
                trackingNumber.requestFocus();
                return;
            }
            String resi = trackingNumber.getText().toString().trim();
            if (resi.length() < 4) {
                trackingNumber.setError("Isi nomor resi minimal 4 karakter.");
                return;
            }
            String carrier = stringValue(order, "carrier", courier);
            saveShipment(carrier, resi, trackingUrl.getText().toString().trim(),
                    "delivered", "Perbarui data pengiriman", editSave);
        });
    }

    private void renderNewOrderDetail(JSONObject order) {
        LinearLayout header = horizontal();
        header.setGravity(Gravity.CENTER_VERTICAL);
        content.addView(header, matchWrapBottom(12));
        LinearLayout identity = new LinearLayout(this);
        identity.setOrientation(LinearLayout.VERTICAL);
        header.addView(identity, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        addText(identity, stringValue(order, "order_code", currentOrderCode), 18, INK, true, 0, 0, 0, 5);
        addText(identity, stringValue(order, "customer_name", "Pelanggan"), 16, INK, true, 0, 0, 0, 0);
        TextView total = new TextView(this);
        total.setText(money(order.optLong("total_amount")));
        total.setTextSize(21);
        total.setTextColor(GREEN);
        total.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        total.setGravity(Gravity.END | Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams totalParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        totalParams.leftMargin = dp(8);
        header.addView(total, totalParams);

        LinearLayout proofCard = card(content);
        ImageView proofImage = new ImageView(this);
        proofImage.setBackground(rounded(PAGE, 8, LINE));
        proofImage.setScaleType(ImageView.ScaleType.FIT_CENTER);
        proofImage.setAdjustViewBounds(false);
        proofImage.setContentDescription("Foto bukti pembayaran pesanan");
        proofCard.addView(proofImage, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(300)));
        Button proofAction = smallButton(order.optBoolean("has_payment_proof") ? "Memuat bukti…" : "Bukti transfer belum diunggah", false);
        proofCard.addView(proofAction, matchWrapTop(8));
        if (order.optBoolean("has_payment_proof")) {
            proofAction.setOnClickListener(view -> loadProof(order, proofAction, proofImage));
            loadProof(order, proofAction, proofImage);
        } else {
            proofAction.setEnabled(false);
        }

        LinearLayout detailCard = card(content);
        addText(detailCard, "Detail pesanan", 17, GREEN, true, 0, 0, 0, 8);
        JSONArray items = order.optJSONArray("items");
        if (items != null) for (int index = 0; index < items.length(); index++) {
            JSONObject item = items.optJSONObject(index);
            if (item == null) continue;
            addText(detailCard, item.optString("name", "Produk") + "  ×  " + item.optInt("quantity"), 16, INK, true, 0, 0, 0, index + 1 < items.length() ? 8 : 0);
        }
        if (items == null || items.length() == 0) addText(detailCard, "Rincian produk belum tersedia.", 14, MUTED, false, 0, 0, 0, 0);

        LinearLayout actions = horizontal();
        Button cancel = smallButton("Batalkan", false);
        Button process = smallButton("Proses", true);
        LinearLayout.LayoutParams actionParams = new LinearLayout.LayoutParams(0, dp(52), 1);
        actions.addView(cancel, actionParams);
        LinearLayout.LayoutParams processParams = new LinearLayout.LayoutParams(0, dp(52), 1);
        processParams.leftMargin = dp(10);
        actions.addView(process, processParams);
        content.addView(actions, matchWrapTop(2));
        cancel.setOnClickListener(view -> cancelNewOrder(order, cancel));
        process.setOnClickListener(view -> processNewOrder(order, process));
    }

    private void processNewOrder(JSONObject order, Button processButton) {
        String paymentStatus = order.optString("payment_status", "pending");
        if ("pending".equals(paymentStatus)) {
            if (!order.optBoolean("has_payment_proof")) {
                setBusy(false, "Bukti transfer belum diunggah. Pesanan belum dapat diproses.");
                return;
            }
            confirmPaymentReview(order, "approve");
            return;
        }
        if (!"paid".equals(paymentStatus)) {
            setBusy(false, "Pembayaran belum berstatus lunas. Periksa status pembayaran terlebih dahulu.");
            return;
        }
        new AlertDialog.Builder(this)
                .setTitle("Terima pesanan?")
                .setMessage("Pesanan akan diterima. Produksi masih perlu dimulai dari detail pesanan setelah pembayaran dikonfirmasi.")
                .setNegativeButton("Kembali", null)
                .setPositiveButton("Proses", (dialog, which) -> updateOrderStatus("order", "accepted", "Pesanan diterima admin", processButton))
                .show();
    }

    private void cancelNewOrder(JSONObject order, Button cancelButton) {
        if ("paid".equals(order.optString("payment_status", "pending"))) {
            new AlertDialog.Builder(this)
                    .setTitle("Pembatalan pesanan lunas")
                    .setMessage("Pesanan yang sudah lunas harus melalui alur permintaan refund. Gunakan tab Refund setelah pelanggan mengajukan pembatalan.")
                    .setPositiveButton("Mengerti", null)
                    .show();
            return;
        }
        EditText reason = input("", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        reason.setHint("Alasan pembatalan");
        reason.setMinLines(2);
        new AlertDialog.Builder(this)
                .setTitle("Batalkan pesanan?")
                .setMessage("Pesanan yang belum lunas akan ditandai dibatalkan.")
                .setView(reason)
                .setNegativeButton("Kembali", null)
                .setPositiveButton("Batalkan", (dialog, which) -> {
                    String note = reason.getText().toString().trim();
                    if (note.isEmpty()) {
                        setBusy(false, "Tulis alasan pembatalan terlebih dahulu.");
                        return;
                    }
                    updateOrderStatus("order", "cancelled", note, cancelButton);
                })
                .show();
    }

    private void renderProcessOrderDetail(JSONObject order) {
        LinearLayout header = horizontal();
        header.setGravity(Gravity.CENTER_VERTICAL);
        content.addView(header, matchWrapBottom(12));
        LinearLayout identity = new LinearLayout(this);
        identity.setOrientation(LinearLayout.VERTICAL);
        header.addView(identity, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        addText(identity, stringValue(order, "order_code", currentOrderCode), 18, INK, true, 0, 0, 0, 5);
        addText(identity, stringValue(order, "customer_name", "Pelanggan"), 16, INK, true, 0, 0, 0, 0);
        TextView total = new TextView(this);
        total.setText(money(order.optLong("total_amount")));
        total.setTextSize(21);
        total.setTextColor(GREEN);
        total.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        total.setGravity(Gravity.END | Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams totalParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        totalParams.leftMargin = dp(8);
        header.addView(total, totalParams);

        LinearLayout details = card(content);
        addText(details, "Detail pesanan", 17, GREEN, true, 0, 0, 0, 8);
        JSONArray items = order.optJSONArray("items");
        if (items != null) for (int index = 0; index < items.length(); index++) {
            JSONObject item = items.optJSONObject(index);
            if (item == null) continue;
            addText(details, item.optString("name", "Produk") + "  ×  " + item.optInt("quantity"), 15, INK, true, 0, 0, 0, 3);
            String size = item.optString("fixed_size_snapshot", "");
            if (!size.isEmpty() && !"null".equals(size)) addText(details, "Ukuran: " + size, 13, MUTED, false, 0, 0, 0, 5);
            Button createDxf = smallButton("Buat gambar DXF", false);
            details.addView(createDxf, matchWrapTop(3));
            String itemId = item.optString("id", "");
            createDxf.setOnClickListener(view -> createProductionDxf(itemId, createDxf));
            JSONArray files = item.optJSONArray("production_files");
            if (files != null) for (int fileIndex = 0; fileIndex < files.length(); fileIndex++) {
                JSONObject file = files.optJSONObject(fileIndex);
                if (file == null) continue;
                Button download = smallButton("Simpan DXF v" + file.optInt("version"), false);
                details.addView(download, matchWrapTop(3));
                String fileId = file.optString("id", "");
                download.setOnClickListener(view -> downloadProductionDxf(fileId, file.optString("file_name"), download));
            }
        }

        LinearLayout address = card(content);
        addText(address, "Alamat", 16, GREEN, true, 0, 0, 0, 6);
        addText(address, stringValue(order, "shipping_address", "Alamat belum tersedia"), 15, INK, false, 0, 0, 0, 3);
        String destination = stringValue(order, "shipping_destination_label", "");
        if (!destination.isEmpty()) addText(address, destination, 13, MUTED, false, 0, 0, 0, 0);

        String checkoutCourier = stringValue(order, "shipping_courier_name", stringValue(order, "carrier", "Kurir belum tersedia"));
        String checkoutService = stringValue(order, "shipping_service", "");
        String oldTracking = stringValue(order, "tracking_number", "");
        String oldUrl = stringValue(order, "tracking_url", "");
        EditText trackingInput = input(oldTracking, InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS);
        trackingInput.setSingleLine(true);
        trackingInput.setHint("Input resi");
        EditText trackingUrlInput = input(oldUrl, InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        trackingUrlInput.setSingleLine(true);
        trackingUrlInput.setHint("URL jasa kirim atau URL tracking Ojol");

        LinearLayout shippingRow = horizontal();
        LinearLayout shippingInputs = new LinearLayout(this);
        shippingInputs.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams inputsParams = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1);
        inputsParams.rightMargin = dp(8);
        shippingRow.addView(shippingInputs, inputsParams);
        TextView courierInfo = new TextView(this);
        courierInfo.setText(checkoutService.isEmpty() ? checkoutCourier : checkoutCourier + "\n" + checkoutService);
        courierInfo.setTextSize(15);
        courierInfo.setTextColor(INK);
        courierInfo.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        courierInfo.setGravity(Gravity.CENTER_VERTICAL);
        courierInfo.setPadding(dp(12), dp(8), dp(12), dp(8));
        courierInfo.setBackground(rounded(Color.WHITE, 8, LINE));
        shippingInputs.addView(courierInfo, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(52)));
        shippingInputs.addView(trackingInput, matchWrapTop(6));
        WebView mapView = new WebView(this);
        mapView.setBackground(rounded(Color.WHITE, 8, LINE));
        WebSettings mapSettings = mapView.getSettings();
        mapSettings.setJavaScriptEnabled(true);
        mapSettings.setDomStorageEnabled(true);
        mapView.setWebViewClient(new WebViewClient());
        shippingRow.addView(mapView, new LinearLayout.LayoutParams(0, dp(156), 1));
        address.addView(shippingRow, matchWrapTop(10));
        double latitude = order.optDouble("shipping_latitude", Double.NaN);
        double longitude = order.optDouble("shipping_longitude", Double.NaN);
        if (validCoordinates(latitude, longitude)) {
            String bbox = String.format(Locale.US, "%.6f,%.6f,%.6f,%.6f",
                    longitude - 0.004, latitude - 0.003, longitude + 0.004, latitude + 0.003);
            String marker = String.format(Locale.US, "%.6f,%.6f", latitude, longitude);
            mapView.loadUrl("https://www.openstreetmap.org/export/embed.html?bbox=" + bbox
                    + "&layer=mapnik&marker=" + marker);
        } else {
            mapView.loadData("<html><body style='font-family:sans-serif;padding:16px'>Pin lokasi tidak tersimpan pada pesanan lama.</body></html>", "text/html", "UTF-8");
            addText(address, "Pesanan lama belum memiliki pin. Tombol Google Maps akan mencari alamat tertulis.", 12, MUTED, false, 6, 0, 0, 0);
        }
        Button openMap = smallButton("Buka di Google Maps", false);
        address.addView(openMap, matchWrapTop(6));
        openMap.setOnClickListener(view -> openOrderLocation(order));
        address.addView(trackingUrlInput, matchWrapTop(8));

        String production = stringValue(order, "production_status", "pending");
        String shipment = stringValue(order, "shipment_status", "pending");
        Button cancel = smallButton("Batalkan", false);
        String actionLabel;
        if ("pending".equals(production)) actionLabel = "Mulai produksi";
        else if ("in_progress".equals(production)) actionLabel = "Selesai";
        else if ("shipped".equals(shipment)) actionLabel = "Selesai";
        else if ("delivered".equals(shipment)) actionLabel = "Tuntaskan pesanan";
        else actionLabel = "Kirim pesanan";
        Button finish = smallButton(actionLabel, true);
        LinearLayout actions = horizontal();
        LinearLayout.LayoutParams actionParams = new LinearLayout.LayoutParams(0, dp(52), 1);
        actions.addView(cancel, actionParams);
        LinearLayout.LayoutParams finishParams = new LinearLayout.LayoutParams(0, dp(52), 1);
        finishParams.leftMargin = dp(8);
        actions.addView(finish, finishParams);
        content.addView(actions, matchWrapTop(4));
        cancel.setOnClickListener(view -> explainProcessCancellation());
        finish.setOnClickListener(view -> finishProcessStep(order, production, shipment,
                checkoutCourier, trackingInput, trackingUrlInput, finish));
    }

    private void openOrderLocation(JSONObject order) {
        double latitude = order.optDouble("shipping_latitude", Double.NaN);
        double longitude = order.optDouble("shipping_longitude", Double.NaN);
        String query = validCoordinates(latitude, longitude)
                ? String.format(Locale.US, "%.6f,%.6f", latitude, longitude)
                : stringValue(order, "shipping_address", "") + " " + stringValue(order, "shipping_destination_label", "");
        try {
            String encoded = URLEncoder.encode(query.trim(), StandardCharsets.UTF_8.name());
            startActivity(new Intent(Intent.ACTION_VIEW,
                    android.net.Uri.parse("https://www.google.com/maps/search/?api=1&query=" + encoded)));
        } catch (Exception error) {
            setBusy(false, "Lokasi tidak dapat dibuka.");
        }
    }

    private static boolean validCoordinates(double latitude, double longitude) {
        return !Double.isNaN(latitude) && !Double.isInfinite(latitude) && latitude >= -90 && latitude <= 90
                && !Double.isNaN(longitude) && !Double.isInfinite(longitude) && longitude >= -180 && longitude <= 180;
    }

    private void explainProcessCancellation() {
        new AlertDialog.Builder(this)
                .setTitle("Batalkan pesanan?")
                .setMessage("Pesanan ini sudah lunas. Pembatalan harus melalui permintaan refund pelanggan agar dana dan status pesanan tercatat dengan benar.")
                .setNegativeButton("Kembali", null)
                .setPositiveButton("Buka Refund", (dialog, which) -> {
                    refundFilter = "requested";
                    showOrderList(true);
                })
                .show();
    }

    private void finishProcessStep(JSONObject order, String production, String shipment,
                                   String checkoutCourier, EditText trackingInput,
                                   EditText trackingUrlInput, Button actionButton) {
        String orderCode = stringValue(order, "order_code", currentOrderCode);
        String note = "Pembaruan melalui aplikasi admin";
        if ("pending".equals(production)) {
            updateOrderStatus("production", "in_progress", "Produksi dimulai", actionButton);
            return;
        }
        if ("in_progress".equals(production)) {
            new AlertDialog.Builder(this)
                    .setTitle("Tandai produksi selesai?")
                    .setMessage("Pastikan produk sudah selesai dibuat sebelum melanjutkan ke pengiriman.")
                    .setNegativeButton("Kembali", null)
                    .setPositiveButton("Selesai", (dialog, which) -> updateOrderStatus("production", "completed", note, actionButton))
                    .show();
            return;
        }
        if ("shipped".equals(shipment)) {
            new AlertDialog.Builder(this)
                    .setTitle("Pesanan sudah diterima?")
                    .setMessage("Status akan diubah menjadi diterima dan pesanan ditandai selesai.")
                    .setNegativeButton("Belum", null)
                    .setPositiveButton("Ya, selesai", (dialog, which) -> {
                        String carrier = stringValue(order, "carrier", "");
                        String tracking = stringValue(order, "tracking_number", "");
                        String url = stringValue(order, "tracking_url", "");
                        setBusy(true, "Menyelesaikan pesanan…");
                        runIo(() -> {
                            api.post("/api/admin/orders/" + orderCode + "/shipment",
                                    json("carrier", carrier, "tracking_number", tracking, "tracking_url", url,
                                            "status", "delivered", "note", "Dikonfirmasi diterima admin"));
                            api.post("/api/admin/orders/" + orderCode + "/status",
                                    json("status_type", "order", "status", "completed", "note", "Pesanan diterima pelanggan"));
                            clearOrderCache();
                            runOnUiThread(() -> returnToCurrentOrderTab(
                                    "Pesanan selesai. Kembali ke daftar Proses."));
                        }, error -> setBusy(false, error.getMessage()));
                    })
                    .show();
            return;
        }
        if ("delivered".equals(shipment)) {
            updateOrderStatus("order", "completed", "Pesanan diterima pelanggan", actionButton);
            return;
        }

        String carrier = checkoutCourier == null ? "" : checkoutCourier.trim();
        String tracking = trackingInput.getText().toString().trim();
        String trackingUrl = trackingUrlInput.getText().toString().trim();
        if (carrier.length() < 2 || tracking.length() < 4) {
            setBusy(false, "Pilih kurir dan isi nomor resi sebelum mengirim pesanan.");
            return;
        }
        if (!"pending".equals(shipment) && !"failed".equals(shipment) && !"returned".equals(shipment)) {
            setBusy(false, "Status pengiriman belum dapat dilanjutkan: " + shipment + ". Muat ulang detail pesanan.");
            return;
        }
        saveShipment(carrier, tracking, trackingUrl, "shipped", note, actionButton);
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
                button.setVisibility(View.GONE);
            });
        }, error -> {
            button.setEnabled(true);
            button.setText("Coba buka bukti lagi");
            setBusy(false, error.getMessage());
        });
    }

    private void loadRefundProof(String refundId, Button button, ImageView imageView) {
        button.setEnabled(false);
        button.setText("Memuat bukti…");
        runIo(() -> {
            String signedUrl = api.getRefundProofUrl(refundId);
            Bitmap bitmap = downloadProof(signedUrl);
            runOnUiThread(() -> {
                imageView.setImageBitmap(bitmap);
                imageView.setVisibility(View.VISIBLE);
                button.setVisibility(View.GONE);
            });
        }, error -> {
            button.setEnabled(true);
            button.setText("Coba buka bukti lagi");
            setBusy(false, error.getMessage());
        });
    }

    private void chooseRefundProof(String refundId) {
        pendingRefundProofId = refundId;
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("image/*");
        intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"image/jpeg", "image/png", "image/webp"});
        startActivityForResult(intent, PICK_REFUND_PROOF);
    }

    private void uploadRefundProof(android.net.Uri uri) {
        String refundId = pendingRefundProofId;
        pendingRefundProofId = null;
        if (refundId == null || refundId.isEmpty()) return;
        try {
            String mimeType = getContentResolver().getType(uri);
            if (mimeType == null || !(mimeType.equals("image/jpeg") || mimeType.equals("image/png") || mimeType.equals("image/webp"))) {
                setBusy(false, "Pilih gambar JPG, PNG, atau WebP.");
                return;
            }
            byte[] bytes;
            try (InputStream input = getContentResolver().openInputStream(uri)) {
                if (input == null) throw new IOException("File gambar tidak dapat dibuka.");
                bytes = readImageLimited(input);
            }
            setBusy(true, "Mengunggah bukti pengembalian dana…");
            runIo(() -> {
                JSONObject response = api.postRefundProof(refundId, mimeType, bytes);
                clearOrderCache();
                runOnUiThread(() -> {
                    feedback.setText(response.optString("message", "Bukti refund tersimpan."));
                    showOrderDetail(currentOrderCode);
                });
            }, error -> setBusy(false, error.getMessage()));
        } catch (IOException error) {
            setBusy(false, error.getMessage());
        }
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
            clearOrderCache();
            runOnUiThread(() -> loadOrderDetail(true));
        }, error -> setBusy(false, error.getMessage()));
    }

    private void updateOrderStatus(String type, String status, String note, Button button) {
        if (api == null || currentOrderCode == null) return;
        String code = currentOrderCode;
        String tabLabel = currentOrderTabLabel();
        button.setEnabled(false);
        setBusy(true, "Menyimpan status…");
        runIo(() -> {
            JSONObject body = json("status_type", type, "status", status, "note", note);
            api.post("/api/admin/orders/" + code + "/status", body);
            String notice = "production".equals(type)
                    ? "Status produksi diperbarui. Kembali ke daftar Proses."
                    : "Status pesanan diperbarui. Kembali ke daftar " + tabLabel + ".";
            clearOrderCache();
            runOnUiThread(() -> returnToCurrentOrderTab(notice));
        }, error -> {
            button.setEnabled(true);
            setBusy(false, error.getMessage());
        });
    }

    private String currentOrderTabLabel() {
        if ("accepted".equals(orderFilter)) return "Proses";
        if ("history".equals(orderFilter)) return "Riwayat";
        return "Baru";
    }

    private void returnToCurrentOrderTab(String notice) {
        currentOrderCode = null;
        loadedOrder = null;
        orderTransitionNotice = notice;
        showOrderList(true);
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
        String code = currentOrderCode;
        String tabLabel = currentOrderTabLabel();
        boolean editingCompletedOrder = loadedOrder != null
                && "completed".equals(stringValue(loadedOrder, "order_status", ""))
                && "delivered".equals(status);
        button.setEnabled(false);
        setBusy(true, "Menyimpan pengiriman…");
        runIo(() -> {
            JSONObject body = json("carrier", carrier, "tracking_number", trackingNumber,
                    "tracking_url", trackingUrl, "status", status, "note", note);
            api.post("/api/admin/orders/" + code + "/shipment", body);
            clearOrderCache();
            runOnUiThread(() -> {
                if (editingCompletedOrder) loadOrderDetail(true);
                else returnToCurrentOrderTab("Data pengiriman tersimpan. Kembali ke daftar " + tabLabel + ".");
            });
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
            clearOrderCache();
            runOnUiThread(() -> {
                button.setEnabled(true);
                setBusy(false, response.optString("message", "Gambar DXF dibuat."));
                showSaveDxfDialog(file.optString("content"), file.optString("file_name"), file.optInt("version"));
                loadOrderDetail(true);
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
        if (requestCode == PICK_REFUND_PROOF) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null) uploadRefundProof(data.getData());
            else pendingRefundProofId = null;
            return;
        }
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
                clearAdminToken();
                showLogin("");
            });
        }
        page.addView(bar, matchWrapBottom(8));
    }

    private void addBrandHeader(String title, String subtitle) {
        LinearLayout brand = card(page);
        TextView mark = addText(brand, "A", 25, Color.WHITE, true, 0, 0, 0, 4);
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
                IOException error = exception instanceof IOException
                        ? (IOException) exception
                        : new IOException(message == null ? "Terjadi kendala jaringan." : message);
                runOnUiThread(() -> onError.accept(error));
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
        return value == null || "null".equalsIgnoreCase(value) || value.trim().isEmpty() ? fallback : value;
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
                JSONObject body = new JSONObject().put("registration_token", token).put("label", "Ajielt7 Android");
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

