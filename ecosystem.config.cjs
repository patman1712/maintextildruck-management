module.exports = {
  apps: [{
    name: "maintextildruck-manager",
    script: "./node_modules/.bin/tsx",
    args: "api/server.ts",
    env: {
      NODE_ENV: "production",
      PORT: 3000
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
}
