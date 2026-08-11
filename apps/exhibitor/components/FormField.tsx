export function FormField({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    // The supplied child is always the wrapped form control; Biome cannot
    // infer that association through the ReactNode prop.
    // biome-ignore lint/a11y/noLabelWithoutControl: control is supplied as children
    <label className="flex flex-col gap-1.5 text-left">
      <span className="text-sm font-medium text-text-secondary">{label}</span>
      {children}
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </label>
  );
}

export const inputClassName =
  "w-full rounded-xl border border-border-subtle bg-surface-1 px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-brand-accent";
