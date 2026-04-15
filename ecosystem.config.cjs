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
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5001
      }
    }
  ]
};
