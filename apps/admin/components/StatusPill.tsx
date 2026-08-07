export function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
        active ? "bg-success/15 text-success" : "bg-surface-3 text-text-muted"
      }`}
    >
      {active ? "Active" : "Deactivated"}
    </span>
  );
}

export function VisitorTypeBadge({ visitorType }: { visitorType: "invited" | "guest" }) {
  const isInvited = visitorType === "invited";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
        isInvited ? "bg-brand-primary/20 text-brand-accent" : "bg-surface-3 text-text-secondary"
      }`}
    >
      {isInvited ? "Invited" : "Guest"}
    </span>
  );
}
