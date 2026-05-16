export function JsonViewer({ value }: { value: unknown }) {
  return (
    <pre className="max-h-[420px] overflow-auto rounded-2xl border bg-slate-950 p-4 text-xs text-cyan-100">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
