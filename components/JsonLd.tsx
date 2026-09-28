import type { ReactElement } from "react";

/**
 * Serialised structured data.
 *
 * Rendered from the server so crawlers see it in the initial HTML, and escaped
 * defensively: a stray "</script>" inside any string would otherwise break out of
 * the tag.
 */
export default function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }): ReactElement {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
