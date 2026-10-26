import { useState, useRef } from 'react';
import { Modal } from './Modal';

interface PhotoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPhotoUrl?: string;
  onUpload: (base64Data: string) => Promise<void>;
  onRemove: () => Promise<void>;
  isUploading: boolean;
}

export function PhotoUploadModal({
  isOpen,
  onClose,
  currentPhotoUrl,
  onUpload,
  onRemove,
  isUploading,
}: PhotoUploadModalProps) {
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(currentPhotoUrl);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_WIDTH = 300;
  const MAX_HEIGHT = 300;
  const JPEG_QUALITY = 0.7;

  function compressImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');

          let width = img.width;
          let height = img.height;

          if (width > MAX_WIDTH || height > MAX_HEIGHT) {
            if (width > height) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            } else {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const base64 = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
          resolve(base64);
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      alert('File too large. Please select an image under 20MB.');
      return;
    }

    try {
      const compressed = await compressImage(file);
      setPreviewUrl(compressed);
      await onUpload(compressed);
      onClose();
    } catch {
      alert('Failed to process image. Please try another file.');
    }
  }

  async function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      await handleFile(file);
    }
    e.target.value = '';
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      await handleFile(file);
    }
  }

  async function handleRemove() {
    try {
      await onRemove();
      setPreviewUrl(undefined);
      onClose();
    } catch {
      alert('Failed to remove photo.');
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Profile Photo" size="sm">
      <div className="space-y-4">
        {/* Preview area */}
        <div
          className={`w-32 h-32 mx-auto rounded-full overflow-hidden border-2 border-slate-600 flex items-center justify-center ${
            isDragOver ? 'border-accent ring-2 ring-accent/30' : ''
          }`}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
        >
          {previewUrl ? (
            <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full rounded-full bg-slate-700 flex items-center justify-center text-slate-500 text-3xl font-semibold">
              ?
            </div>
          )}
        </div>

        {/* Upload button */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-4 py-2 bg-accent hover:bg-accent-400 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
          >
            {isUploading ? 'Uploading...' : 'Choose Photo'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInput}
            className="hidden"
          />
        </div>

        {/* Remove button */}
        {previewUrl && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={isUploading}
            className="w-full py-2 text-rose-400 hover:text-rose-300 text-sm border border-rose-700/50 hover:border-rose-600 rounded-lg transition-colors disabled:opacity-50"
          >
            Remove Photo
          </button>
        )}

        {/* Tips */}
        <p className="text-xs text-slate-500 text-center">
          JPEG, PNG, or WebP. Max 20MB. Auto-resized to 300x300.
        </p>
      </div>
    </Modal>
  );
}
