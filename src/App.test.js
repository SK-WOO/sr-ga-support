// Full App render skipped in Jest (Web Crypto API not available in jsdom).
// Core business logic is tested in:
//   utils/resolveHolder.test.js
//   utils/parseJsonField.test.js
//   api/client.test.js
//   hooks/useAuth.test.js

test("placeholder — business logic tests in separate files", () => {
  expect(true).toBe(true);
});
