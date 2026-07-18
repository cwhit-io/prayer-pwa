type ScriptureReferenceProps = {
  reference: string;
  href?: string | null;
  text?: string | null;
  className?: string;
  showText?: boolean;
};

/**
 * Displays a scripture reference hyperlinked to YouVersion English ESV when possible.
 */
export function ScriptureReference({
  reference,
  href,
  text,
  className = "",
  showText = true
}: ScriptureReferenceProps) {
  const linkClass =
    "text-sm font-black uppercase text-yellow transition hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow";

  return (
    <div className={className}>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
          title="Open this passage in the English Standard Version on YouVersion"
        >
          {reference}
        </a>
      ) : (
        <p className="text-sm font-black uppercase text-yellow">{reference}</p>
      )}
      {showText && text ? (
        <blockquote className="plc-scripture mt-3 border-l-4 border-yellow/80 py-1 pl-5 pr-1">
          {text}
        </blockquote>
      ) : null}
    </div>
  );
}
