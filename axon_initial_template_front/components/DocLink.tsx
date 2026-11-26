// A document reference. AXON stores only metadata and a link, never the content.
// The link comes from the data (doc_references.url); nothing is hardcoded here.
import { ExternalLink } from "lucide-react";
import { SimTag } from "./ui";

/** Only https:// links (e.g. SharePoint from the Doc agent) and the bundled /docs/ demo pages may open. */
function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("/docs/") && !url.includes("..")) return url;
  try { return new URL(url).protocol === "https:" ? url : null; } catch { return null; }
}

export function DocLink({ title, url, className = "small" }: { title: string; url?: string | null; className?: string }) {
  const href = safeUrl(url);
  if (!href) {
    return <div className={className}>{title} <span className="xs muted" style={{ fontWeight: 500 }}>· Link not available</span></div>;
  }
  return (
    <div className={`row gap6 wrap ${className}`}>
      <a href={href} target="_blank" rel="noopener noreferrer" className="doc-link">
        {title}<ExternalLink size={12} aria-hidden /><span className="sr-only"> (opens in a new tab)</span>
      </a>
      {href.startsWith("/docs/") && <SimTag />}
    </div>
  );
}
