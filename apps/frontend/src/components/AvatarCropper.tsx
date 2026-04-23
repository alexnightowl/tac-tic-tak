'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Cropper, { Area } from 'react-easy-crop';
import { Check, Loader2, Upload, X, ZoomIn } from 'lucide-react';

type Props = {
  open: boolean;
  file: File | null;
  onCancel: () => void;
  onConfirm: (dataUrl: string) => Promise<void> | void;
  size?: number; // output size in px (square)
};

export function AvatarCropper({ open, file, onCancel, onConfirm, size = 256 }: Props) {
  const [mounted, setMounted] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!file) { setImageSrc(null); return; }
    const reader = new FileReader();
    reader.onload = () => setImageSrc(reader.result as string);
    reader.onerror = () => setErr('Failed to read file');
    reader.readAsDataURL(file);
  }, [file]);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedArea(pixels);
  }, []);

  const confirm = async () => {
    if (!imageSrc || !croppedArea) return;
    setSubmitting(true);
    setErr(null);
    try {
      const dataUrl = await renderCrop(imageSrc, croppedArea, size);
      await onConfirm(dataUrl);
    } catch (e: any) {
      setErr(e?.message ?? 'Upload failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!mounted || !open || !file) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
         onClick={onCancel}>
      <div className="glass rounded-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-soft)]">
          <div className="text-sm font-semibold">Crop avatar</div>
          <button onClick={onCancel} aria-label="Close" className="text-zinc-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="relative w-full aspect-square bg-black">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
        </div>

        <div className="px-4 py-3 space-y-3">
          <div className="flex items-center gap-3">
            <ZoomIn size={16} className="text-zinc-400 shrink-0" />
            <input
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="ticks w-full"
              style={{ ['--pct' as any]: `${((zoom - 1) / 3) * 100}%` }}
              aria-label="Zoom"
            />
          </div>
          {err && <div className="text-xs text-rose-400">{err}</div>}
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="flex-1 h-11 rounded-xl border border-[var(--border)] text-sm"
            >
              Cancel
            </button>
            <button
              onClick={confirm}
              disabled={submitting || !croppedArea}
              className="flex-1 h-11 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Save
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Picks a file and hands it off to an `AvatarCropper` via controlled state.
 */
export function AvatarPickerButton({
  onUploaded,
  disabled,
  label = 'Change avatar',
}: {
  onUploaded: (dataUrl: string) => Promise<void> | void;
  disabled?: boolean;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);

  const pick = () => inputRef.current?.click();
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
    e.target.value = '';
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={onFile}
        className="hidden"
      />
      <button
        type="button"
        onClick={pick}
        disabled={disabled}
        className="h-10 rounded-lg bg-white/5 hover:bg-white/10 border border-[var(--border)] px-3 text-sm flex items-center gap-2 disabled:opacity-50"
      >
        <Upload size={14} /> {label}
      </button>
      <AvatarCropper
        open={!!file}
        file={file}
        onCancel={() => setFile(null)}
        onConfirm={async (dataUrl) => {
          await onUploaded(dataUrl);
          setFile(null);
        }}
      />
    </>
  );
}

async function renderCrop(src: string, area: Area, size: number): Promise<string> {
  const image = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas context unavailable');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    image,
    area.x, area.y, area.width, area.height,
    0, 0, size, size,
  );
  // JPEG at 0.88 keeps the payload compact while still looking clean.
  return canvas.toDataURL('image/jpeg', 0.88);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
