import { useState, useEffect } from 'react';
import { X, ExternalLink, Loader2 } from 'lucide-react';

export default function DocumentPreview({ url, fileType, onClose }) {
  const [embedUrl, setEmbedUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const prepare = async () => {
      setLoading(true);
      try {
        let resolved = url;

        // Private hosted URIs are no longer used; URLs are always public Supabase Storage links

        if (fileType === 'pdf') {
          // Use Google Docs viewer to avoid cross-origin iframe PDF blocking
          setEmbedUrl(`https://docs.google.com/viewer?url=${encodeURIComponent(resolved)}&embedded=true`);
        } else if (fileType === 'word' || fileType === 'excel') {
          setEmbedUrl(`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(resolved)}`);
        } else if (resolved?.includes('docs.google.com')) {
          setEmbedUrl(resolved.replace(/\/edit.*$/, '/preview').replace(/\/view.*$/, '/preview'));
        } else {
          setEmbedUrl(resolved);
        }
      } catch (e) {
        console.error('Preview prep failed', e);
        setEmbedUrl(url); // fallback to raw url
      } finally {
        setLoading(false);
      }
    };
    prepare();
  }, [url, fileType]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card border border-border w-full max-w-4xl h-[90vh] flex flex-col mx-4" style={{ borderRadius: 2 }}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <span className="text-sm font-semibold">Document Preview</span>
          <div className="flex items-center gap-2">
            <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 border border-border hover:bg-accent transition-colors" style={{ borderRadius: 2 }}>
              <ExternalLink className="w-3 h-3" /> Open Original
            </a>
            <button onClick={onClose} className="p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" style={{ borderRadius: 2 }}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden flex items-center justify-center">
          {loading ? (
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          ) : embedUrl ? (
            <iframe
              src={embedUrl}
              className="w-full h-full border-0"
              title="Document Preview"
              allow="fullscreen"
            />
          ) : (
            <div className="text-muted-foreground text-sm">
              Preview not available. <a href={url} target="_blank" className="text-primary ml-1 hover:underline">Open in new tab</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}