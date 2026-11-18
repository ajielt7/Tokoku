package id.ruma.admin;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

final class VisitorStatsStore extends SQLiteOpenHelper {
    private static final String DATABASE_NAME = "visitor_stats.db";
    private static final int DATABASE_VERSION = 1;

    VisitorStatsStore(Context context) { super(context, DATABASE_NAME, null, DATABASE_VERSION); }

    @Override public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE visits (event_id TEXT PRIMARY KEY NOT NULL, visitor_id TEXT NOT NULL, visited_at TEXT NOT NULL, country_code TEXT NOT NULL)");
        db.execSQL("CREATE INDEX visits_time ON visits(visited_at)");
    }

    @Override public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) { }

    int save(JSONArray events) throws JSONException {
        SQLiteDatabase db = getWritableDatabase();
        int saved = 0;
        db.beginTransaction();
        try {
            for (int index = 0; index < events.length(); index++) {
                JSONObject event = events.optJSONObject(index);
                if (event == null) continue;
                String eventId = event.optString("event_id", "");
                String visitorId = event.optString("visitor_id", "");
                String visitedAt = event.optString("visited_at", "");
                String country = event.optString("country_code", "XX");
                if (eventId.isEmpty() || visitorId.isEmpty() || visitedAt.isEmpty()) continue;
                ContentValues values = new ContentValues();
                values.put("event_id", eventId);
                values.put("visitor_id", visitorId);
                values.put("visited_at", visitedAt);
                values.put("country_code", country);
                if (db.insertWithOnConflict("visits", null, values, SQLiteDatabase.CONFLICT_IGNORE) != -1) saved++;
            }
            db.setTransactionSuccessful();
        } finally { db.endTransaction(); }
        return saved;
    }

    JSONObject report(String period) throws JSONException {
        int amount;
        int field;
        String bucket;
        String labelFormat;
        if ("week".equals(period)) { amount = 12; field = Calendar.WEEK_OF_YEAR; bucket = "strftime('%Y-W%W', visited_at, 'localtime')"; labelFormat = "week"; }
        else if ("month".equals(period)) { amount = 12; field = Calendar.MONTH; bucket = "strftime('%Y-%m', visited_at, 'localtime')"; labelFormat = "month"; }
        else if ("year".equals(period)) { amount = 5; field = Calendar.YEAR; bucket = "strftime('%Y', visited_at, 'localtime')"; labelFormat = "year"; }
        else { period = "day"; amount = 30; field = Calendar.DAY_OF_YEAR; bucket = "date(visited_at, 'localtime')"; labelFormat = "day"; }

        Calendar start = Calendar.getInstance();
        if ("week".equals(period)) {
            start.add(Calendar.DAY_OF_YEAR, -((start.get(Calendar.DAY_OF_WEEK) + 5) % 7));
            start.add(Calendar.DAY_OF_YEAR, -7 * (amount - 1));
        } else if ("month".equals(period)) {
            start.set(Calendar.DAY_OF_MONTH, 1);
            start.add(Calendar.MONTH, -(amount - 1));
        } else if ("year".equals(period)) {
            start.set(Calendar.MONTH, Calendar.JANUARY);
            start.set(Calendar.DAY_OF_MONTH, 1);
            start.add(Calendar.YEAR, -(amount - 1));
        } else start.add(field, -(amount - 1));
        start.set(Calendar.HOUR_OF_DAY, 0); start.set(Calendar.MINUTE, 0); start.set(Calendar.SECOND, 0); start.set(Calendar.MILLISECOND, 0);
        String since = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US) {{ setTimeZone(TimeZone.getTimeZone("UTC")); }}.format(start.getTime());
        JSONObject report = new JSONObject().put("period", period);
        JSONArray points = new JSONArray();
        try (Cursor cursor = getReadableDatabase().rawQuery(
                "SELECT " + bucket + " AS bucket, COUNT(DISTINCT visitor_id) AS visitors, COUNT(*) AS pageviews FROM visits WHERE visited_at >= ? GROUP BY bucket ORDER BY bucket",
                new String[]{since})) {
            while (cursor.moveToNext()) {
                String key = cursor.getString(0);
                long visitors = cursor.getLong(1);
                points.put(new JSONObject().put("label", formatLabel(key, labelFormat)).put("visitors", visitors).put("pageviews", cursor.getLong(2)));
            }
        }
        JSONArray countries = new JSONArray();
        try (Cursor cursor = getReadableDatabase().rawQuery(
                "SELECT country_code, COUNT(DISTINCT visitor_id) AS visitors FROM visits WHERE visited_at >= ? GROUP BY country_code ORDER BY visitors DESC, country_code",
                new String[]{since})) {
            while (cursor.moveToNext()) {
                String code = cursor.getString(0);
                Locale countryLocale = new Locale("", code);
                String countryName = "XX".equals(code) ? "Tidak diketahui" : countryLocale.getDisplayCountry(new Locale("id", "ID"));
                countries.put(new JSONObject().put("code", code).put("name", countryName).put("visitors", cursor.getLong(1)));
            }
        }
        long pageviews = scalar("SELECT COUNT(*) FROM visits WHERE visited_at >= ?", since);
        long uniques = scalar("SELECT COUNT(DISTINCT visitor_id) FROM visits WHERE visited_at >= ?", since);
        report.put("unique_visitors", uniques).put("pageviews", pageviews).put("points", points).put("countries", countries);
        return report;
    }

    private long scalar(String sql, String since) {
        try (Cursor cursor = getReadableDatabase().rawQuery(sql, new String[]{since})) {
            return cursor.moveToFirst() ? cursor.getLong(0) : 0;
        }
    }

    private String formatLabel(String value, String type) {
        try {
            if ("day".equals(type)) return value.substring(8) + "/" + value.substring(5, 7);
            if ("week".equals(type)) return "Minggu " + value.substring(value.lastIndexOf('W') + 1) + " '" + value.substring(2, 4);
            if ("month".equals(type)) return value.substring(5) + "/" + value.substring(2, 4);
            return value;
        } catch (Exception ignored) { return value; }
    }
}