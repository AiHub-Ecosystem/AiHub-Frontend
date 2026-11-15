"use client";

import type { SampleRequest } from "@/lib/sample-request";

export type Shell = "bash" | "powershell" | "postman";

export const SHELLS: { shell: Shell; label: string; title: string }[] = [
  { shell: "bash", label: "Bash", title: "Lệnh cho Bash-compatible shell" },
  { shell: "powershell", label: "PowerShell", title: "Lệnh cho PowerShell" },
  {
    shell: "postman",
    label: "Postman",
    title: "Lệnh curl để import vào Postman",
  },
];

/** The Sample request's command for the shell the holder picked. */
export function commandForShell(
  sample: SampleRequest | undefined,
  shell: Shell
): string | null {
  if (!sample) return null;
  if (shell === "powershell") return sample.powershellCommand;
  if (shell === "postman") return sample.postmanCommand;
  return sample.command;
}

/** Picks the shell a copied Sample request command is written for. */
export function ShellSwitch({
  shell,
  onChange,
  tone = "dark",
}: {
  shell: Shell;
  onChange: (shell: Shell) => void;
  tone?: "dark" | "light";
}) {
  return (
    <div
      aria-label="Shell"
      className={`qs-shells qs-shells--${tone}`}
      role="group"
    >
      {SHELLS.map((option) => (
        <button
          aria-pressed={shell === option.shell}
          className="qs-shell"
          key={option.shell}
          onClick={() => onChange(option.shell)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
