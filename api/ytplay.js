const axios = require('axios');
const { BASE, cors } = require('./_base');

module.exports = async (req, res) => {
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ status: false, message: 'Method not allowed' });
  }

  const { query } = req.body || {};
  if (!query) {
    return res.status(400).json({ status: false, message: 'query (url video) wajib diisi' });
  }

  try {
    const { data } = await axios.post(`${BASE}/api/ytplay`, { query }, { timeout: 20000 });
    return res.status(200).json(data);
  } catch (e) {
    return res.status(502).json({ status: false, message: e.message });
  }
};
