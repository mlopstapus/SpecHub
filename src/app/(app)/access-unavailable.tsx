export function AccessUnavailable() {
  return (
    <main className="grid min-h-screen place-items-center bg-bg px-6">
      <section className="max-w-md rounded-card border border-border bg-surface p-8 text-center">
        <p className="font-mono text-[11px] tracking-[0.12em] text-a uppercase">
          Access unavailable
        </p>
        <h1 className="mt-3 font-display text-2xl font-semibold">
          This workspace is not enabled
        </h1>
        <p className="mt-3 leading-6 text-dim">
          Your account is still signed in, but this organization does not
          currently have access to the application.
        </p>
      </section>
    </main>
  );
}
