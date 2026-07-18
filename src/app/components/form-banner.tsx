/** Flash message from server-action redirects (`?error=` / `?success=`). */
export function FormBanner({
  error,
  success
}: {
  error?: string | null;
  success?: string | null;
}) {
  if (error) {
    return (
      <div
        className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm leading-6 text-paper"
        role="alert"
      >
        <p className="font-black uppercase tracking-wide text-danger">Something went wrong</p>
        <p className="mt-2 whitespace-pre-wrap text-paper/90">{error}</p>
      </div>
    );
  }

  if (success) {
    return (
      <p className="text-sm font-black uppercase text-success" role="status">
        {success}
      </p>
    );
  }

  return null;
}
