"use client";
import { useEffect } from "react";

/**
 * Globally fixes number inputs:
 * - When value is 0 and user types a digit → 0 gets replaced (not "02")
 * - Prevents leading zeros in all number inputs across the project
 */
export default function GlobalInputFix() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLInputElement;
      if (el.tagName !== "INPUT" || el.type !== "number") return;
      // If current value is 0 and user types any digit → select all so it replaces
      if (Number(el.value) === 0 && /^\d$/.test(e.key) && e.key !== "0") {
        el.select();
      }
    };

    const onInput = (e: Event) => {
      const el = e.target as HTMLInputElement;
      if (el.tagName !== "INPUT" || el.type !== "number") return;
      // Remove leading zeros (e.g. "02" → "2")
      if (/^0\d/.test(el.value)) {
        const cleaned = String(parseFloat(el.value));
        if (cleaned !== el.value) {
          const nativeSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, "value"
          )?.set;
          nativeSetter?.call(el, cleaned);
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("input", onInput, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("input", onInput, true);
    };
  }, []);

  return null;
}
