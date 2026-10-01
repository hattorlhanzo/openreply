import { describe, expect, it } from "vitest";
import {
  productDm,
  productKeywords,
  productReplies,
} from "../bot/presets";

describe("product preset", () => {
  it("appends the brand after the fixed intent words", () => {
    const keywords = productKeywords("WiWU");

    expect(keywords.slice(0, 7)).toEqual([
      "цена",
      "цену",
      "ссылка",
      "ссылку",
      "как купить",
      "сколько",
      "стоит",
    ]);
    // Lower-cased: matching is case-insensitive anyway, and a stray capital in
    // the keyword list is the kind of thing that looks like a bug later.
    expect(keywords.at(-1)).toBe("wiwu");
  });

  it("puts the brand into every public reply and leaves no placeholder", () => {
    const replies = productReplies("remax");

    expect(replies).toHaveLength(10);
    for (const reply of replies) {
      expect(reply).toContain("«remax»");
      expect(reply).not.toContain("{бренд}");
    }
  });

  it("keeps the ten replies distinct, which is the whole point of having ten", () => {
    expect(new Set(productReplies("wiwu")).size).toBe(10);
  });

  it("preserves the brand's own casing in the reply text", () => {
    // The keyword is folded for matching; the sentence a human reads is not.
    expect(productReplies("WiWU")[0]).toContain("«WiWU»");
  });

  it("agrees with the number of buttons", () => {
    expect(productDm(1)).toContain("прикладываем ссылку:");
    expect(productDm(2)).toContain("прикладываем ссылки:");
  });

  it("falls back to the singular when there are no links at all", () => {
    expect(productDm(0)).toContain("прикладываем ссылку:");
  });

  it("keeps both tokens the worker substitutes", () => {
    for (const count of [1, 2]) {
      expect(productDm(count)).toContain("{username}");
      expect(productDm(count)).toContain("{link}");
    }
  });
});
