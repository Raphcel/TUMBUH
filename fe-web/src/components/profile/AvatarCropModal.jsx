import React, { useEffect, useMemo, useState } from 'react';
import { Crop, Minus, Plus } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

const OUTPUT_SIZE = 512;
const PREVIEW_SIZE = 320;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function getImagePlacement({ naturalWidth, naturalHeight }, size, { zoom, offsetX, offsetY }) {
  const baseScale = Math.max(size / naturalWidth, size / naturalHeight);
  const scale = baseScale * zoom;
  const drawWidth = naturalWidth * scale;
  const drawHeight = naturalHeight * scale;
  const maxX = Math.max(0, (drawWidth - size) / 2);
  const maxY = Math.max(0, (drawHeight - size) / 2);

  return {
    width: drawWidth,
    height: drawHeight,
    left: (size - drawWidth) / 2 + (offsetX / 100) * maxX,
    top: (size - drawHeight) / 2 + (offsetY / 100) * maxY,
  };
}

async function cropImage(file, imageUrl, { zoom, offsetX, offsetY }) {
  const image = await loadImage(imageUrl);
  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

  const placement = getImagePlacement(image, OUTPUT_SIZE, { zoom, offsetX, offsetY });

  ctx.drawImage(image, placement.left, placement.top, placement.width, placement.height);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  if (!blob) throw new Error('Failed to crop image');

  const baseName = file.name.replace(/\.[^.]+$/, '') || 'avatar';
  return new File([blob], `${baseName}-cropped.jpg`, { type: 'image/jpeg' });
}

export function AvatarCropModal({ file, isOpen, onCancel, onConfirm, isId = false, uploading = false }) {
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [imageSize, setImageSize] = useState(null);
  const [processing, setProcessing] = useState(false);

  const imageUrl = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file]);

  useEffect(() => {
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
    setImageSize(null);
  }, [file]);

  useEffect(() => () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  const handleConfirm = async () => {
    if (!file || !imageUrl) return;
    setProcessing(true);
    try {
      const croppedFile = await cropImage(file, imageUrl, { zoom, offsetX, offsetY });
      await onConfirm(croppedFile);
    } finally {
      setProcessing(false);
    }
  };

  const busy = uploading || processing;
  const previewPlacement = imageSize
    ? getImagePlacement(imageSize, PREVIEW_SIZE, { zoom, offsetX, offsetY })
    : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={busy ? () => {} : onCancel}
      title={isId ? 'Sesuaikan Foto' : 'Adjust Photo'}
      size="lg"
    >
      <div className="space-y-5">
        <div
          className="relative mx-auto overflow-hidden rounded-full border border-surface-border bg-surface-muted shadow-inner"
          style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE, maxWidth: '100%' }}
        >
          {imageUrl && (
            <img
              src={imageUrl}
              alt=""
              onLoad={(event) => setImageSize({
                naturalWidth: event.currentTarget.naturalWidth,
                naturalHeight: event.currentTarget.naturalHeight,
              })}
              className="absolute max-w-none select-none"
              draggable={false}
              style={previewPlacement ? {
                left: previewPlacement.left,
                top: previewPlacement.top,
                width: previewPlacement.width,
                height: previewPlacement.height,
              } : { opacity: 0 }}
            />
          )}
          <div className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/80" />
          <div className="pointer-events-none absolute inset-0 rounded-full">
            <span className="absolute left-1/3 top-0 h-full w-px bg-white/70 shadow-[0_0_0_1px_rgba(15,23,42,0.12)]" />
            <span className="absolute left-2/3 top-0 h-full w-px bg-white/70 shadow-[0_0_0_1px_rgba(15,23,42,0.12)]" />
            <span className="absolute left-0 top-1/3 h-px w-full bg-white/70 shadow-[0_0_0_1px_rgba(15,23,42,0.12)]" />
            <span className="absolute left-0 top-2/3 h-px w-full bg-white/70 shadow-[0_0_0_1px_rgba(15,23,42,0.12)]" />
          </div>
        </div>

        <div className="space-y-4">
          <label className="block text-sm font-medium text-[#0A1D3D]/80">
            {isId ? 'Zoom' : 'Zoom'}
            <div className="mt-2 flex items-center gap-3">
              <Minus size={16} className="text-text-muted" />
              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                className="w-full accent-brand"
              />
              <Plus size={16} className="text-text-muted" />
            </div>
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-[#0A1D3D]/80">
              {isId ? 'Geser horizontal' : 'Horizontal position'}
              <input
                type="range"
                min="-100"
                max="100"
                step="1"
                value={offsetX}
                onChange={(event) => setOffsetX(Number(event.target.value))}
                className="mt-2 w-full accent-brand"
              />
            </label>
            <label className="block text-sm font-medium text-[#0A1D3D]/80">
              {isId ? 'Geser vertikal' : 'Vertical position'}
              <input
                type="range"
                min="-100"
                max="100"
                step="1"
                value={offsetY}
                onChange={(event) => setOffsetY(Number(event.target.value))}
                className="mt-2 w-full accent-brand"
              />
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            {isId ? 'Batal' : 'Cancel'}
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={busy}>
            <Crop size={16} className="mr-1.5" />
            {busy ? (isId ? 'Mengunggah...' : 'Uploading...') : isId ? 'Gunakan Foto' : 'Use Photo'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
