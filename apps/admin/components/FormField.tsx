export function FormField({
  label,
  children,
  error,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  hint?: string;
}) {
  return (
    // The supplied child is always the wrapped form control; Biome cannot
    // infer that association through the ReactNode prop.
    // biome-ignore lint/a11y/noLabelWithoutControl: control is supplied as children
    <label className="flex flex-col gap-1.5 text-left">
      <span className="text-sm font-medium text-text-secondary">{label}</span>
      {children}
      {hint ? <span className="text-xs text-text-muted">{hint}</span> : null}
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </label>
  );
}

export const inputClassName =
  "w-full rounded-lg border border-border-subtle bg-surface-1 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-accent";

export const buttonPrimaryClassName =
  "rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60";

export const buttonSecondaryClassName =
  "rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-2";
