import { Sidebar } from "@/components/Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex">
      <Sidebar />
      <main className="min-h-dvh flex-1 overflow-x-auto p-8">{children}</main>
    </div>
  );
}
