// Artillery processor: small helpers shared across scenario files.
// Referenced from scenario YAML via `config.processor: "../processors/helpers.cjs"`.

const ADJECTIVES = ["swift", "amber", "quiet", "bold", "lucky", "calm", "brisk", "vivid"];
const NOUNS = ["falcon", "harbor", "meadow", "cinder", "quartz", "ridge", "willow", "delta"];

function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// Most username-availability lookups should miss (that's the cheap, common
// case in prod - people checking if a handle is taken). Generate a
// realistic-looking but almost-certainly-unregistered handle each iteration
// so we're not hammering a single DB row/cache key for the whole test.
function setRandomUsername(context, events, done) {
  context.vars.randomUsername = `${randomItem(ADJECTIVES)}-${randomItem(NOUNS)}-${Math.floor(
    Math.random() * 1_000_000,
  )}`;
  return done();
}

// Portfolio username to load public portfolio pages/API for. Real load tests
// should point this at an actual published portfolio (PORTFOLIO_TEST_USERNAME);
// fall back to a placeholder so the scenario still runs (and exercises the
// 404 path) if it's unset.
function setPortfolioUsername(context, events, done) {
  context.vars.portfolioUsername = process.env.PORTFOLIO_TEST_USERNAME || "demo";
  return done();
}

// Blog post slug to load. Falls back to a slug that's expected to 404 (still
// exercises the not-found render path) if BLOG_TEST_SLUG isn't set.
function setBlogSlug(context, events, done) {
  context.vars.blogSlug = process.env.BLOG_TEST_SLUG || "not-found-check";
  return done();
}

// Log non-2xx/3xx responses with enough detail to debug after a run, without
// drowning stdout during a high-arrival-rate phase.
function logUnexpectedStatus(requestParams, response, context, events, done) {
  if (response.statusCode >= 400) {
    events.emit("counter", `custom.status_${response.statusCode}`, 1);
  }
  return done();
}

// The API only accepts browser-style cross-site writes from an allowed Origin, and an API key
// (X-API-Key) is optional. Both come from the environment so the scenario file holds no secrets.
// Unset values add no header at all rather than an empty one.
function withHeaders(requestParams, extra) {
  requestParams.headers = requestParams.headers || {};
  requestParams.headers.origin = process.env.ORIGIN || "http://localhost:3001";
  if (process.env.API_KEY) requestParams.headers["x-api-key"] = process.env.API_KEY;
  Object.assign(requestParams.headers, extra);
}

function setServerHeaders(requestParams, context, events, done) {
  withHeaders(requestParams, {});
  return done();
}

// Authenticated user: SESSION_COOKIE is the full Cookie header from a logged-in browser session
// on the target environment (a dedicated test account, never a real user).
function setSessionHeaders(requestParams, context, events, done) {
  withHeaders(
    requestParams,
    process.env.SESSION_COOKIE ? { cookie: process.env.SESSION_COOKIE } : {},
  );
  return done();
}

// Admin endpoints need an admin session; ADMIN_SESSION_COOKIE falls back to SESSION_COOKIE.
function setAdminHeaders(requestParams, context, events, done) {
  const cookie = process.env.ADMIN_SESSION_COOKIE || process.env.SESSION_COOKIE;
  withHeaders(requestParams, cookie ? { cookie } : {});
  return done();
}

function initServerVars(context, events, done) {
  context.vars.hasSession = Boolean(process.env.SESSION_COOKIE);
  context.vars.hasAdminSession = Boolean(
    process.env.ADMIN_SESSION_COOKIE || process.env.SESSION_COOKIE,
  );
  context.vars.shareUsername = process.env.SHARE_USERNAME || "demo";
  context.vars.shareSlug = process.env.SHARE_SLUG || "not-found-check";
  context.vars.docTitle = `load-test ${Math.floor(Math.random() * 1_000_000)}`;
  return done();
}

module.exports = {
  setServerHeaders,
  setSessionHeaders,
  setAdminHeaders,
  initServerVars,
  setRandomUsername,
  setPortfolioUsername,
  setBlogSlug,
  logUnexpectedStatus,
};
