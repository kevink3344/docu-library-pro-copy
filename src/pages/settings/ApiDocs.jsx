import { ExternalLink } from 'lucide-react';

export default function ApiDocs() {
  const apiDocsUrl = `${window.location.origin}/api-docs`;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        The API documentation provides a complete reference for all backend endpoints,
        including request/response schemas, authentication details, and an interactive
        "Try it out" feature to execute API calls directly from the browser.
      </p>

      <a
        href={apiDocsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        <ExternalLink className="w-4 h-4" />
        Open API Documentation
      </a>

      <div className="mt-4">
        <p className="text-xs text-muted-foreground">
          Raw spec available at{' '}
          <code className="bg-accent px-1.5 py-0.5 rounded text-xs font-mono">
            {apiDocsUrl}.json
          </code>
        </p>
      </div>
    </div>
  );
}