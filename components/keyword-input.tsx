"use client";

/**
 * Keyword Input
 *
 * Tag-style input for adding/removing keywords.
 */

import { useState, type KeyboardEvent } from "react";
import { IconX } from "@/components/ui/icons";

interface KeywordInputProps {
  keywords: string[];
  onChange: (keywords: string[]) => void;
  max?: number;
}

export default function KeywordInput({ keywords, onChange, max = 10 }: KeywordInputProps) {
  const [input, setInput] = useState("");

  function addKeyword(value: string) {
    const trimmed = value.trim().toUpperCase();
    if (!trimmed) return;
    if (keywords.includes(trimmed)) return;
    if (keywords.length >= max) return;
    onChange([...keywords, trimmed]);
    setInput("");
  }

  function removeKeyword(keyword: string) {
    onChange(keywords.filter((k) => k !== keyword));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addKeyword(input);
    }
    if (e.key === "Backspace" && !input && keywords.length > 0) {
      removeKeyword(keywords[keywords.length - 1]);
    }
  }

  return (
    <div>
      {/* The wrapper is the visual field; the real input inside is borderless. */}
      <div className="input flex !h-auto min-h-[44px] flex-wrap items-center gap-1.5 !py-1.5 focus-within:!border-accent">
        {keywords.map((keyword) => (
          <span key={keyword} className="chip !pr-1">
            {keyword}
            <button
              type="button"
              onClick={() => removeKeyword(keyword)}
              aria-label={`Удалить ${keyword}`}
              className="grid h-4 w-4 place-items-center rounded-[4px] text-accent-hi hover:bg-accent hover:text-white"
            >
              <IconX size={11} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={keywords.length === 0 ? "Введите ключевое слово и нажмите Enter…" : ""}
          className="min-w-[120px] flex-1 bg-transparent text-[14px] text-foreground outline-none placeholder:text-[var(--text-4)]"
        />
      </div>
      <p className="hint tabular-nums">
        {keywords.length}/{max} ключевых слов · Enter или запятая — добавить
      </p>
    </div>
  );
}
