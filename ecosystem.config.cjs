module.exports = {
  apps: [
    {
      name: "good-english",
      cwd: "/opt/good-english",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: "3456",
        GOOD_ENGLISH_ENV: "tencent",
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  ],
};
