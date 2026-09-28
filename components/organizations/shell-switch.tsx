"use client";

export type Shell = "bash" | "powershell";

export const SHELLS: { shell: Shell; label: string; title: string }[] = [
  { shell: "bash", label: "Bash", title: "Lệnh cho Bash-compatible shell" },
  { shell: "powershell", label: "PowerShell", title: "Lệnh cho PowerShell" },
];

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
