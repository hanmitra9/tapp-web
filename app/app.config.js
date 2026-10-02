// Lets the web build live under a sub-path of the website (e.g. https://domain/app) when APP_BASE=/app.
module.exports = ({ config }) => ({
  ...config,
  experiments: { ...(config.experiments ?? {}), ...(process.env.APP_BASE ? { baseUrl: process.env.APP_BASE } : {}) },
});
