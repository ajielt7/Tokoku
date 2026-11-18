package id.ruma.admin;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.annotation.NonNull;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public final class AdminFirebaseMessagingService extends FirebaseMessagingService {
    static final String CHANNEL_ID = "ruma_orders";
    private static final String NOTIFICATION_PREFS = "admin_notifications";
    private static final String UNREAD_COUNT = "unread_orders";
    private static final int NOTIFICATION_ID = 10901;

    @Override
    public void onNewToken(@NonNull String token) {
        MainActivity.onFcmTokenRefreshed(token);
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        if ("visitor_analytics".equals(message.getData().get("event"))) {
            MainActivity.syncVisitorStatsFromPush(this);
            return;
        }
        String orderCode = message.getData().get("order_code");
        String firstName = message.getData().get("customer_first_name");
        if (firstName == null || firstName.trim().isEmpty()) firstName = "Pelanggan";
        else firstName = firstName.trim().split("\\s+", 2)[0];

        try {
            MainActivity.syncOrdersCacheFromPush(this);
        } catch (Exception ignored) {
            // The next push or manual refresh can retry if the network is temporarily unavailable.
        }

        if (MainActivity.isAppVisible()) {
            markAllRead(this);
            MainActivity.refreshVisibleOrderListFromPush();
            return;
        }
        SharedPreferences preferences = getSharedPreferences(NOTIFICATION_PREFS, MODE_PRIVATE);
        int unread = preferences.getInt(UNREAD_COUNT, 0) + 1;
        preferences.edit().putInt(UNREAD_COUNT, unread).apply();
        String title = unread + " Pesanan Baru";
        String body = firstName + (orderCode == null || orderCode.isEmpty() ? "" : " " + orderCode);
        showNotification(title, body, orderCode);
    }

    static void markAllRead(Context context) {
        context.getSharedPreferences(NOTIFICATION_PREFS, MODE_PRIVATE).edit().putInt(UNREAD_COUNT, 0).apply();
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager != null) manager.cancel(NOTIFICATION_ID);
    }

    static void createChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Pesanan toko", NotificationManager.IMPORTANCE_DEFAULT);
        channel.setDescription("Pemberitahuan saat pesanan baru masuk.");
        manager.createNotificationChannel(channel);
    }

    private void showNotification(String title, String body, String orderCode) {
        createChannel(this);
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;
        Intent intent = new Intent(this, MainActivity.class);
        if (orderCode != null) intent.putExtra("order_code", orderCode);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, orderCode == null ? 0 : orderCode.hashCode(), intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification notification = new Notification.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_ruma)
                .setContentTitle(title)
                .setContentText(body)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .build();
        manager.notify(NOTIFICATION_ID, notification);
    }
}