import type { ReactNode } from "react";
import type { Settings } from "../../storage/settings";

export type UpdateSettings = (mutate: (draft: Settings) => void) => void;
export interface SettingsTabProps {
  settings: Settings;
  update: UpdateSettings;
}
export function RangeControl({
  label,
  value,
  min,
  max,
  unit = "px",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="range-control">
      <span>
        {label}
        <output>
          {value} {unit}
        </output>
      </span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="setting-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
