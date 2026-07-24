import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-16">
      <div>
        <p className="mb-2 font-mono text-[12.5px] tracking-[0.1em] text-a uppercase">Scaffold</p>
        <h1 className="font-display text-[36px] font-bold tracking-[-.03em]">
          Skill<span className="text-a">Canon</span>
        </h1>
        <p className="mt-2 max-w-md text-[14px] leading-[1.6] text-dim">
          Design tokens from docs/context/design-system.md are live: type families, dark-theme
          surfaces, accent, and semantic status colors.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="accent">web</Badge>
        <Badge variant="blue">api</Badge>
        <Badge variant="violet">cli</Badge>
        <Badge variant="neutral">system</Badge>
        <Badge variant="green" dot>
          created
        </Badge>
        <Badge variant="blue" dot>
          updated
        </Badge>
        <Badge variant="red" dot>
          deleted
        </Badge>
      </div>

      <div className="overflow-hidden rounded-card border border-border bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell dense className="font-mono text-[12px] text-dim">
                14:22:07
              </TableCell>
              <TableCell dense>
                <Badge variant="blue" dot>
                  policy.updated
                </Badge>
              </TableCell>
              <TableCell dense>
                <Badge variant="accent">web</Badge>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
