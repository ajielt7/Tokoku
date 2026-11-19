package id.ruma.admin;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;

final class AdminApi {
    private static final int CONNECT_TIMEOUT_MS = 8_000;
    private static final int READ_TIMEOUT_MS = 12_000;
    private static final int MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
    private static final long PRIMARY_OUTAGE_COOLDOWN_MS = 30_000;
    private static volatile long primaryUnavailableUntil;

    private final String baseUrl;
    private final String fallbackBaseUrl;
    private final String token;

    AdminApi(String baseUrl, String fallbackBaseUrl, String token) throws IOException {
        this.baseUrl = validateBaseUrl(baseUrl);
        this.fallbackBaseUrl = validateBaseUrl(fallbackBaseUrl);
        if (this.baseUrl.equals(this.fallbackBaseUrl)) throw new IOException("Alamat API utama dan cadangan harus berbeda.");
        if (token == null || token.trim().length() < 32) {
            throw new IOException("Token admin minimal 32 karakter.");
        }
        this.token = token.trim();
    }

    static String validateBaseUrl(String value) throws IOException {
        if (value == null || value.trim().isEmpty()) throw new IOException("Alamat API wajib diisi.");
        String normalized = value.trim().replaceAll("/+$", "");
        try {
            URI uri = URI.create(normalized);
            String scheme = uri.getScheme();
            String host = uri.getHost();
            if (host == null || uri.getRawUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null) {
                throw new IOException("Alamat API tidak valid.");
            }
            boolean secure = "https".equalsIgnoreCase(scheme);
            boolean localHttp = "http".equalsIgnoreCase(scheme)
                    && (host.equalsIgnoreCase("localhost") || host.equals("127.0.0.1") || host.equals("10.0.2.2"));
            if (!secure && !localHttp) throw new IOException("Gunakan HTTPS. HTTP hanya boleh untuk localhost atau emulator 10.0.2.2.");
            return normalized;
        } catch (IllegalArgumentException exception) {
            throw new IOException("Alamat API tidak valid.");
        }
    }

    JSONObject get(String path) throws IOException {
        return request("GET", path, null);
    }

    JSONObject getAnalyticsReport(String period) throws IOException {
        String value = period == null ? "day" : period;
        if (!(value.equals("day") || value.equals("week") || value.equals("month") || value.equals("year"))) {
            throw new IOException("Rentang laporan tidak valid.");
        }
        return get("/api/admin/analytics/report?period=" + value);
    }

    JSONObject post(String path, JSONObject body) throws IOException {
        return request("POST", path, body);
    }

    String getText(String path) throws IOException {
        if (System.currentTimeMillis() < primaryUnavailableUntil) return getTextFrom(fallbackBaseUrl, path);
        try {
            String result = getTextFrom(baseUrl, path);
            primaryUnavailableUntil = 0;
            return result;
        } catch (ApiException error) {
            if (!isRetryableReadStatus(error.statusCode)) throw error;
            markPrimaryUnavailable();
            return getTextFrom(fallbackBaseUrl, path);
        } catch (IOException error) {
            markPrimaryUnavailable();
            return getTextFrom(fallbackBaseUrl, path);
        }
    }

    private String getTextFrom(String requestBaseUrl, String path) throws IOException {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(requestBaseUrl + path).openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
            connection.setReadTimeout(READ_TIMEOUT_MS);
            connection.setInstanceFollowRedirects(false);
            connection.setRequestProperty("Accept", "application/dxf, text/plain");
            connection.setRequestProperty("Authorization", "Bearer " + token);
            int status = connection.getResponseCode();
            InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
            String content = stream == null ? "" : readLimited(stream);
            if (status < 200 || status >= 300) {
                String message = "Unduhan file gagal (HTTP " + status + ").";
                try { message = new JSONObject(content).optString("message", message); }
                catch (JSONException ignored) { }
                throw new ApiException(message, status);
            }
            return content;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    String getPaymentProofUrl(String paymentReference) throws IOException {
        JSONObject response = get("/api/admin/payments/" + paymentReference + "/proof");
        JSONObject data = response.optJSONObject("data");
        String signedUrl = data == null ? null : data.optString("proof_url", null);
        if (signedUrl == null || !signedUrl.startsWith("https://")) {
            throw new IOException("Tautan bukti pembayaran tidak tersedia.");
        }
        return signedUrl;
    }

    String getRefundProofUrl(String refundId) throws IOException {
        JSONObject response = get("/api/admin/refunds/" + refundId + "/proof");
        JSONObject data = response.optJSONObject("data");
        String signedUrl = data == null ? null : data.optString("proof_url", null);
        if (signedUrl == null || !signedUrl.startsWith("https://")) {
            throw new IOException("Tautan bukti pengembalian tidak tersedia.");
        }
        return signedUrl;
    }

    JSONObject postRefundProof(String refundId, String mimeType, byte[] fileBytes) throws IOException {
        String boundary = "RumaBoundary" + java.util.UUID.randomUUID().toString().replace("-", "");
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(baseUrl + "/api/admin/refunds/" + refundId + "/proof").openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
            connection.setReadTimeout(READ_TIMEOUT_MS);
            connection.setInstanceFollowRedirects(false);
            connection.setDoOutput(true);
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("Authorization", "Bearer " + token);
            connection.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);
            try (OutputStream output = connection.getOutputStream()) {
                output.write(("--" + boundary + "\r\n" +
                        "Content-Disposition: form-data; name=\"proof\"; filename=\"refund-proof\"\r\n" +
                        "Content-Type: " + mimeType + "\r\n\r\n").getBytes(StandardCharsets.UTF_8));
                output.write(fileBytes);
                output.write(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
            }
            int status = connection.getResponseCode();
            InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
            String responseBody = stream == null ? "{}" : readLimited(stream);
            JSONObject response;
            try { response = new JSONObject(responseBody); }
            catch (JSONException exception) { throw new IOException("Respons server tidak dapat dibaca."); }
            if (status < 200 || status >= 300) {
                throw new ApiException(response.optString("message", "Unggah bukti gagal (HTTP " + status + ")."), status);
            }
            return response;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private JSONObject request(String method, String path, JSONObject body) throws IOException {
        if (!"GET".equals(method)) return requestFrom(baseUrl, method, path, body);
        if (System.currentTimeMillis() < primaryUnavailableUntil) return requestFrom(fallbackBaseUrl, method, path, body);
        try {
            JSONObject result = requestFrom(baseUrl, method, path, body);
            primaryUnavailableUntil = 0;
            return result;
        } catch (ApiException error) {
            if (!isRetryableReadStatus(error.statusCode)) throw error;
            markPrimaryUnavailable();
            return requestFrom(fallbackBaseUrl, method, path, body);
        } catch (IOException error) {
            markPrimaryUnavailable();
            return requestFrom(fallbackBaseUrl, method, path, body);
        }
    }

    private JSONObject requestFrom(String requestBaseUrl, String method, String path, JSONObject body) throws IOException {
        HttpURLConnection connection = null;
        try {
            URL url = new URL(requestBaseUrl + path);
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod(method);
            connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
            connection.setReadTimeout(READ_TIMEOUT_MS);
            connection.setInstanceFollowRedirects(false);
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("Authorization", "Bearer " + token);
            if (body != null) {
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                byte[] payload = body.toString().getBytes(StandardCharsets.UTF_8);
                try (OutputStream output = connection.getOutputStream()) {
                    output.write(payload);
                }
            }

            int status = connection.getResponseCode();
            InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
            String responseBody = stream == null ? "{}" : readLimited(stream);
            JSONObject response;
            try {
                response = new JSONObject(responseBody);
            } catch (JSONException exception) {
                throw new IOException("Respons server tidak dapat dibaca.");
            }
            if (status < 200 || status >= 300) {
                String message = response.optString("message", "Permintaan gagal (HTTP " + status + ").");
                throw new ApiException(message, status);
            }
            return response;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private static boolean isRetryableReadStatus(int statusCode) {
        return statusCode == 502 || statusCode == 503 || statusCode == 504;
    }

    private static void markPrimaryUnavailable() {
        primaryUnavailableUntil = System.currentTimeMillis() + PRIMARY_OUTAGE_COOLDOWN_MS;
    }

    static String readLimited(InputStream stream) throws IOException {
        try (InputStream input = stream; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int total = 0;
            int count;
            while ((count = input.read(buffer)) != -1) {
                total += count;
                if (total > MAX_RESPONSE_BYTES) throw new IOException("Respons server terlalu besar.");
                output.write(buffer, 0, count);
            }
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }

    static final class ApiException extends IOException {
        final int statusCode;

        ApiException(String message, int statusCode) {
            super(message);
            this.statusCode = statusCode;
        }
    }
}
