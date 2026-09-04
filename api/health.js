module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    ok: true,
    platform: 'vercel',
    heartbeat: 'client-side while User A page is open',
    backgroundPush: 'requires persistent storage and scheduled worker'
  });
};
