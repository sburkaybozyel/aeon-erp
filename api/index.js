import app from '../server.js';

export default async function handler(req, res) {
  try {
    return app(req, res);
  } catch (err) {
    res.status(500).json({
      error: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method
    });
  }
}
