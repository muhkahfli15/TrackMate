module.exports = function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Vercel Hobby serverless functions cannot keep a persistent in-memory
  // heartbeat watcher. Store this in a database before using background push.
  res.status(200).json({
    ok: true,
    mode: 'vercel-serverless',
    warning: 'Subscription accepted but not persisted in this free prototype.'
  });
};
