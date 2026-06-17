"use client";

import { useRef } from "react";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
}

export function OtpInput({ value, onChange, length = 6, disabled = false }: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const digits = value.split("").slice(0, length);
  const paddedDigits = [...digits, ...new Array(length - digits.length).fill("")];

  const handleChange = (index: number, val: string) => {
    if (disabled) return;

    // Only allow numbers
    const cleanedVal = val.replace(/\D/g, "");
    if (!cleanedVal && val !== "") return;

    const newDigits = [...paddedDigits];
    
    // Handle paste or multiple characters
    if (cleanedVal.length > 1) {
      const pastedDigits = cleanedVal.slice(0, length - index).split("");
      for (let i = 0; i < pastedDigits.length; i++) {
        newDigits[index + i] = pastedDigits[i];
      }
      const newValue = newDigits.join("");
      onChange(newValue);
      
      // Focus last filled or next empty
      const nextIndex = Math.min(index + pastedDigits.length, length - 1);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    newDigits[index] = cleanedVal;
    const newValue = newDigits.join("");
    onChange(newValue);

    // Auto-focus next input
    if (cleanedVal && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        // Focus previous input on backspace if current is empty
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    if (disabled) return;
    
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (pastedData) {
      onChange(pastedData);
      const nextIndex = Math.min(pastedData.length, length - 1);
      setTimeout(() => inputRefs.current[nextIndex]?.focus(), 0);
    }
  };

  return (
    <div className="flex justify-between gap-2 sm:gap-4" onPaste={handlePaste}>
      {paddedDigits.map((digit, idx) => (
        <input
          key={idx}
          ref={(el) => { inputRefs.current[idx] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(idx, e.target.value)}
          onKeyDown={(e) => handleKeyDown(idx, e)}
          disabled={disabled}
          className="h-14 w-full rounded-xl border-2 border-slate-200 bg-white text-center text-xl font-bold text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100 dark:border-white/10 dark:bg-slate-950/70 dark:text-white dark:focus:border-sky-400 dark:focus:ring-sky-400/20 sm:h-16 sm:text-2xl"
          autoComplete="one-time-code"
        />
      ))}
    </div>
  );
}
