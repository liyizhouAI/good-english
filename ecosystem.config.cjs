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
    {
      name: "good-english-worker",
      cwd: "/opt/good-english",
      script: "npm",
      args: "run worker",
      env: {
        NODE_ENV: "production",
        GOOD_ENGLISH_ENV: "tencent",
        GOOD_ENGLISH_APP_URL: "http://127.0.0.1:3456",
        GOOD_ENGLISH_ARCHIVE_DIR: "/opt/good-english/DB",
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  ],
};
