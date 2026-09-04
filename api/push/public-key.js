module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (!process.env.VAPID_PUBLIC_KEY) {
    res.status(200).json({
      publicKey: null,
      warning: 'VAPID_PUBLIC_KEY is not configured.'
    });
    return;
  }

  res.status(200).json({ publicKey: process.env.VAPID_PUBLIC_KEY });
};
