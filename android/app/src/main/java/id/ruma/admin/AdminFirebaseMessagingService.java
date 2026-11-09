package id.ruma.admin;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.annotation.NonNull;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public final class AdminFirebaseMessagingService extends FirebaseMessagingService {
    static final String CHANNEL_ID = "ruma_orders";

    @Override
    public void onNewToken(@NonNull String token) {
        MainActivity.onFcmTokenRefreshed(token);
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        RemoteMessage.Notification remoteNotification = message.getNotification();
        String title = remoteNotification == null || remoteNotification.getTitle() == null
                ? "Pesanan baru" : remoteNotification.getTitle();
        String body = remoteNotification == null || remoteNotification.getBody() == null
                ? "Ada pembaruan pesanan. Buka Ruma Admin." : remoteNotification.getBody();
        showNotification(title, body, message.getData().get("order_code"));
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
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(title)
                .setContentText(body)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .build();
        manager.notify(orderCode == null ? (int) System.currentTimeMillis() : orderCode.hashCode(), notification);
    }
}
