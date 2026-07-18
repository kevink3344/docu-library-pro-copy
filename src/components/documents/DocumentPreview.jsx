import { X, Loader2, Download } from 'lucide-react';

export default function DocumentPreview({ url, downloadUrl, fileName, fileType, loading, error, onClose }) {
  const isPdf = fileType === 'pdf';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card border border-border w-full max-w-4xl h-[90vh] flex flex-col mx-4" style={{ borderRadius: 2 }}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <span className="text-sm font-semibold">Document Preview</span>
          <div className="flex items-center gap-2">
            <a href={downloadUrl} target="_blank" rel="noopener noreferrer" download={fileName} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 border border-border hover:bg-accent transition-colors" style={{ borderRadius: 2 }}>
              <Download className="w-3 h-3" /> Download
            </a>
            <button onClick={onClose} className="p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" style={{ borderRadius: 2 }}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden flex items-center justify-center">
          {loading ? (
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          ) : error ? (
            <div className="text-muted-foreground text-sm">
              {error} <a href={downloadUrl} target="_blank" className="text-primary ml-1 hover:underline">Download file</a>
            </div>
          ) : isPdf && url ? (
            <iframe
              src={url}
              className="w-full h-full border-0"
              title="Document Preview"
              allow="fullscreen"
            />
          ) : (
            <div className="text-center space-y-3">
              <p className="text-sm text-muted-foreground">Preview isn&apos;t available for this file type.</p>
              <a href={downloadUrl} target="_blank" rel="noopener noreferrer" download={fileName} className="inline-flex items-center gap-1.5 text-sm px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors" style={{ borderRadius: 2 }}>
                <Download className="w-4 h-4" /> Download {fileName}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
