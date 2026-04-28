const path = require('path');

module.exports = {
  apps: [
    {
      name: 'stockex-api',
      cwd: path.join(__dirname, 'server'),
      script: 'index.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      /** Tune for VPS RAM — with ZERODHA_MAX_WS_TOKENS capped, 2–3GB heap is usually enough. */
      node_args: '--max-old-space-size=2560',
      max_memory_restart: '2800M',
      env: {
        NODE_ENV: 'production',
        PORT: 5001
      }
    }
  ]
};
