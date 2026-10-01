import { describe, expect, it } from "vitest";
import {
  productDm,
  productKeywords,
  productReplies,
  serviceDm,
  serviceKeywords,
  serviceLinks,
  serviceReplies,
} from "../bot/presets";
import { matchKeywords } from "../lib/utils/keyword-matcher";

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

describe("service preset", () => {
  it("covers both spellings of плёнка", () => {
    // The matcher keeps Cyrillic combining marks on purpose, so е and ё are
    // two different keywords and both have to be listed.
    const keywords = serviceKeywords();

    expect(matchKeywords("сколько стоит плёнка?", keywords).matched).toBe(true);
    expect(matchKeywords("сколько стоит пленка?", keywords).matched).toBe(true);
  });

  it("fires on the words the operator listed", () => {
    const keywords = serviceKeywords();

    for (const comment of [
      "Броня на капот сколько стоит",
      "Цена?",
      "скиньте цену",
      "как купить",
      "дайте ссылку",
      "это полиуретан?",
    ]) {
      expect(matchKeywords(comment, keywords).matched, comment).toBe(true);
    }
  });

  it("does not fire on a comment with none of them", () => {
    expect(matchKeywords("Красивая машина", serviceKeywords()).matched).toBe(false);
  });

  it("offers ten distinct public replies", () => {
    const replies = serviceReplies();

    expect(replies).toHaveLength(10);
    expect(new Set(replies).size).toBe(10);
  });

  it("sends one button to the lead form", () => {
    const links = serviceLinks();

    expect(links).toHaveLength(1);
    expect(links[0].url).toBe(
      "https://forms.yandex.ru/cloud/6926fbca84227ca4ce3b4a69/"
    );
    expect(links[0].label).toBe("Оставить заявку");
  });

  it("hands out fresh objects, so editing one campaign cannot leak into the next", () => {
    const first = serviceLinks();
    first[0].label = "изменено";

    expect(serviceLinks()[0].label).toBe("Оставить заявку");
    expect(serviceKeywords()).not.toBe(serviceKeywords());
  });

  it("keeps the {link} token the worker substitutes", () => {
    expect(serviceDm()).toContain("{link}");
  });
});
