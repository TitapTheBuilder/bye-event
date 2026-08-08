import Image from "next/image";
import Link from "next/link";
import { AccountBadge } from "./AccountBadge";
import { LanguageToggle } from "./LanguageToggle";
import { UTMark } from "./UTMark";

export function TopBar({
  businessName,
  logoUrl,
}: {
  businessName: string | null;
  logoUrl: string | null;
}) {
  return (
    <header className="brand-wash sticky top-0 z-50 isolate border-b border-border-subtle bg-surface-0/80 backdrop-blur">
      <div className="mx-auto grid h-16 max-w-lg grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-4">
        <UTMark className="shrink-0" />
        <Link
          href="/"
          className="flex min-w-0 items-center justify-center overflow-hidden"
          aria-label="Home"
        >
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={businessName ?? "Event logo"}
              width={112}
              height={32}
              className="h-8 max-w-full w-auto object-contain"
              unoptimized
            />
          ) : businessName ? (
            <span className="truncate text-sm font-semibold text-text-primary">{businessName}</span>
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
