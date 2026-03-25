import { post, get } from "./client";

// Mock fetch globally
beforeEach(() => {
  jest.useFakeTimers();
  global.fetch = jest.fn();
  sessionStorage.clear();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("API client error handling", () => {
  it("returns { ok:false, error } on network failure after retries", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));

    const promise = post({ action: "test" }, { retries: 0 });
    await promise;
    const result = await post({ action: "test" }, { retries: 0 });

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("returns parsed JSON on success", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ ok: true, data: [1, 2] })),
    });

    const result = await get("get_requests", { retries: 0 });
    expect(result.ok).toBe(true);
    expect(result.data).toEqual([1, 2]);
  });

  it("returns { ok:false, error } on invalid JSON response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("not valid json {{{"),
    });

    const result = await get("get_requests", { retries: 0 });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("JSON");
  });

  it("returns { ok:false } on 401 without retry", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve(JSON.stringify({ ok: false, error: "Unauthorized" })),
    });

    const result = await post({ action: "test" }, { retries: 2 });
    // 4xx should not retry
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
  });
});
