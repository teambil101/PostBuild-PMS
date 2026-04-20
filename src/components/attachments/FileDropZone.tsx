import { useCallback, useRef, useState, ReactNode } from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileDropZoneProps {
  accept?: string;
  multiple?: boolean;
  maxBytes?: number;
  onFiles: (files: File[]) => void;
  helperText?: ReactNode;
  compact?: boolean;
  className?: string;
}

export function FileDropZone({
  accept,
  multiple = true,
  maxBytes,
  onFiles,
  helperText,
  compact,
  className,
}: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = useCallback((fl: FileList | null) => {
    if (!fl) return;
    const arr = Array.from(fl);
    if (arr.length === 0) return;
    onFiles(arr);
  }, [onFiles]);

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragActive(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        "border hairline border-dashed rounded-sm bg-muted/30 cursor-pointer transition-colors",
        "flex flex-col items-center justify-center text-center gap-2 text-true-taupe",
        compact ? "px-4 py-6" : "px-8 py-12",
        dragActive && "bg-gold/10 border-gold/60 text-architect",
        className,
      )}
    >
      <UploadCloud className={cn(compact ? "h-5 w-5" : "h-7 w-7")} strokeWidth={1.4} />
      <div className={cn("text-sm", compact && "text-xs")}>
        <span className="text-architect font-medium">Click to upload</span>
        <span className="text-muted-foreground"> or drag &amp; drop</span>
      </div>
      {helperText && (
        <div className="text-[11px] text-muted-foreground max-w-md leading-relaxed">{helperText}</div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/** Validate a file against allowed mime list and max bytes. Returns error message or null. */
export function validateFile(file: File, allowedMimes: Set<string> | null, maxBytes: number): string | null {
  if (allowedMimes && !allowedMimes.has(file.type) && !(allowedMimes.has("image/*") && file.type.startsWith("image/"))) {
    return `${file.name}: unsupported file type.`;
  }
  if (file.size > maxBytes) {
    return `${file.name}: exceeds ${(maxBytes / 1024 / 1024).toFixed(0)} MB limit.`;
  }
  return null;
}