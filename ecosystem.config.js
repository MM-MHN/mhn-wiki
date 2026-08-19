module.exports = {
  apps: [
    {
      name: "mhn-server",
      cwd: "./server",
      script: "npm",
      args: "run dev",
      env: {
        NODE_ENV: "development"
      },
      watch: false
    },
    {
      name: "mhn-client",
      cwd: "./client",
      script: "npm",
      // pass vite host flag through npm to the client dev script
      args: "run dev -- --host 0.0.0.0",
      env: {
        NODE_ENV: "development"
      },
      watch: false
    }
  ]
};
