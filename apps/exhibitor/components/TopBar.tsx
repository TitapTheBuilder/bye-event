import Image from "next/image";
import Link from "next/link";
import { AccountBadge } from "./AccountBadge";
import { LanguageToggle } from "./LanguageToggle";

export function TopBar({
  businessName,
  logoUrl,
}: {
  businessName: string | null;
  logoUrl: string | null;
}) {
  return (
    <header className="brand-wash sticky top-0 z-50 isolate border-b border-border-subtle bg-surface-0/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-lg items-center justify-between gap-4 px-4">
        
        <Link
          href="/"
          className="flex min-w-0 shrink-0 items-center gap-3 overflow-hidden"
          aria-label="Home"
        >
          <Image
            src="/UT-Logo.svg" 
            alt="University of Tehran"
            width={32}
            height={32}
            className="h-8 w-auto shrink-0 object-contain"
          />

          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={businessName ?? "Event logo"}
              width={112}
              height={32}
              className="h-8 w-auto max-w-[112px] shrink-0 object-contain"
              unoptimized
            />
          ) : businessName ? (
            <span className="truncate text-sm font-semibold text-text-primary">
              {businessName}
            </span>
          ) : null}
        </Link>

        <div className="relative z-10 flex shrink-0 items-center gap-2">
          <LanguageToggle />
          <AccountBadge />
        </div>
      </div>
    </header>
  );
}