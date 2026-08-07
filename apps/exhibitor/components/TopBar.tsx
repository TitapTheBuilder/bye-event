import Image from "next/image";
import Link from "next/link";
import { AccountBadge } from "./AccountBadge";
import { UTMark } from "./UTMark";

export function TopBar({
  businessName,
  logoUrl,
}: {
  businessName: string | null;
  logoUrl: string | null;
}) {
  return (
    <header className="brand-wash sticky top-0 z-40 border-b border-border-subtle bg-surface-0/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-lg items-center justify-between px-4">
        <UTMark />
        <Link href="/" className="flex items-center gap-2" aria-label="Home">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={businessName ?? "Event logo"}
              width={112}
              height={32}
              className="h-8 w-auto object-contain"
              unoptimized
            />
          ) : businessName ? (
            <span className="text-sm font-semibold text-text-primary">{businessName}</span>
          ) : null}
        </Link>
        <AccountBadge />
      </div>
    </header>
  );
}
