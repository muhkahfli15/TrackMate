# TrackMate Vercel Deploy

Vercel is a good free HTTPS host for this PWA prototype.

## What works on Vercel Free

- PWA over HTTPS
- Installable app shell
- User A and User B screens
- PeerJS/WebRTC camera and microphone consent flow
- Browser geolocation permission flow
- Client-side heartbeat alert while User A keeps the app open

## Limitation

Vercel Hobby serverless functions are not a long-running Node server. The 15-second background heartbeat push detector from `server.js` is still better suited to Render, Koyeb, Fly.io, or another always-on/background-capable host.

For true background phone notification on Vercel, add persistent storage for push subscriptions and heartbeat records, then run a scheduled check. The free cron cadence is not suitable for 15-second safety checks.

## Deploy Steps

1. Push this repo to GitHub.
2. Import the repo in Vercel.
3. Framework preset: Other.
4. Build command: leave empty or use `npm install`.
5. Output directory: leave empty.
6. Add environment variables if you want Web Push key discovery:
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `VAPID_SUBJECT`
7. Deploy.
