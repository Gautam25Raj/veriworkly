import { describe, expect, it, vi } from "vitest";

vi.mock("#config", () => ({ config: { auth: { cookieDomain: ".veriworkly.com" } } }));
vi.mock("#middleware/auth", () => ({ requireAuthUser: () => ({ id: "user-1" }) }));
vi.mock("#services/userService", () => ({ UserService: { deleteUserAccount: vi.fn() } }));
vi.mock("#utils/authCache", () => ({ invalidateSessionCache: vi.fn() }));

import { UserController } from "#controllers/userController";

describe("deleteCurrentUser", () => {
  it("clears both session cookies with the configured cookie domain", async () => {
    const res = { clearCookie: vi.fn(), json: vi.fn() };

    await UserController.deleteCurrentUser({ headers: {} } as never, res as never, vi.fn());

    const options = { path: "/", domain: ".veriworkly.com" };
    expect(res.clearCookie).toHaveBeenCalledWith("veriworkly-auth.session_token", options);
    expect(res.clearCookie).toHaveBeenCalledWith("__Secure-veriworkly-auth.session_token", options);
  });
});
