"use client";

import { remarkOptions, type RemarkCategory } from "@/lib/remark-options";

type Props = {
  category: RemarkCategory;
  current: string;
  onSelect: (next: string) => void;
  disabled?: boolean;
};

export default function RemarkPresetSelect({ category, current, onSelect, disabled }: Props) {
  const choices: readonly string[] = remarkOptions[category];
  return (
    <select
      className="field"
      aria-label={`Choose a suggested ${category.replaceAll("_", " ")}`}
      disabled={disabled}
      value={choices.includes(current) ? current : ""}
      onChange={(event) => {
        if (event.target.value) onSelect(event.target.value);
      }}
    >
      <option value="">Choose a suggestion or type your own below</option>
      {choices.map((text) => <option key={text} value={text}>{text}</option>)}
    </select>
  );
}
