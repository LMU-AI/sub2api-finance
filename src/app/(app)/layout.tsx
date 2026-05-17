import { Nav } from "@/components/Nav";
import { getLatestSnapshot } from "@/lib/aggregate";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let generatedAt: string | null = null;
  try {
    generatedAt = (await getLatestSnapshot())?.generatedAt ?? null;
  } catch {
    generatedAt = null;
  }
  return (
    <div className="flex min-h-dvh">
      <Nav generatedAt={generatedAt} />
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1360px] px-6 py-7">{children}</div>
      </main>
    </div>
  );
}
