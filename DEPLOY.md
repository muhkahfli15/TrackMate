# TrackMate Free Deploy

Jalur gratis yang paling cocok untuk prototype ini adalah Render Web Service Free.
TrackMate butuh Node server hidup untuk menerima heartbeat dan mengirim Web Push.

## 1. Buat VAPID keys

Jalankan:

```bash
npm run vapid
```

Simpan nilai `publicKey` dan `privateKey`.

## 2. Upload ke GitHub

Buat repository GitHub baru, lalu push folder ini.
Jangan upload `node_modules` atau `.env`.

## 3. Deploy di Render

1. Buka Render Dashboard.
2. Pilih New > Web Service.
3. Hubungkan repository GitHub TrackMate.
4. Render akan membaca `render.yaml`.
5. Pilih plan Free.
6. Isi environment variable:
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `VAPID_SUBJECT`, misalnya `mailto:email-anda@example.com`

## 4. Tes di HP

1. Buka URL HTTPS dari Render di HP User A.
2. Login sebagai User A.
3. Tekan Aktifkan Notifikasi dan izinkan dari browser.
4. Buka URL yang sama di HP User B.
5. Login sebagai User B, lalu hubungkan ID ke User A.
6. Jika heartbeat User B berhenti lebih dari timeout server, User A menerima push notification.

## Catatan prototype

Data pairing, heartbeat, dan subscription masih disimpan di memory server. Jika server restart atau free instance sleep, data akan hilang dan User A perlu mengaktifkan notifikasi lagi. Untuk produksi, pindahkan data ini ke database.
