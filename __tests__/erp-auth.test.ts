import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { erpDenied, erpKeyMatches } from "@/lib/erp-auth";

function req(key?: string) {
  return new NextRequest("http://x/api/erp/accounts", {
    headers: key === undefined ? {} : { "x-erp-key": key },
  });
}

describe("erpKeyMatches", () => {
  afterEach(() => {
    delete process.env.ERP_API_KEY;
  });

  it("без ключа в env не пускает никого, даже с пустым заголовком", () => {
    expect(erpKeyMatches(req(""))).toBe(false);
    expect(erpKeyMatches(req())).toBe(false);
    expect(erpDenied().status).toBe(404);
  });

  it("пускает только точное совпадение ключа", () => {
    process.env.ERP_API_KEY = "secret-key";
    expect(erpKeyMatches(req("secret-key"))).toBe(true);
    expect(erpKeyMatches(req("secret-kez"))).toBe(false);
    expect(erpKeyMatches(req("secret"))).toBe(false);
    expect(erpKeyMatches(req())).toBe(false);
    expect(erpDenied().status).toBe(401);
  });
});
