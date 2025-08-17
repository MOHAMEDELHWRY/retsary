export default function RootLoading() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-1 w-48 overflow-hidden rounded bg-muted">
          <div className="h-full w-1/3 animate-[indeterminate_1.2s_ease_infinite] bg-primary" />
        </div>
        <p className="text-sm text-muted-foreground">يجري التحميل…</p>
      </div>
      <style jsx>{`
        @keyframes indeterminate {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(50%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}
