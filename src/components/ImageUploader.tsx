import React, { useState, useRef } from 'react';
import { Upload, Image as ImageIcon, X } from 'lucide-react';
import { imageToHash } from '../network/utils/image-codec';

interface ImageUploaderProps {
  onHashExtracted: (hash: string) => void;
  label: string;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onHashExtracted, label }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isDecoding, setIsDecoding] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    setError('');
    setIsDecoding(true);

    // Show preview
    const preview = URL.createObjectURL(file);
    setPreviewUrl(preview);

    try {
      const hash = await imageToHash(file);
      onHashExtracted(hash);
      setError('');
    } catch (err) {
      setError('Failed to decode image. Make sure it\'s a valid connection image.');
      console.error('Decode error:', err);
    } finally {
      setIsDecoding(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          handleFile(file);
        }
        break;
      }
    }
  };

  const clearPreview = () => {
    setPreviewUrl('');
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <h4 className="font-bold text-slate-800 text-sm">{label}</h4>

      {previewUrl ? (
        <div className="relative">
          <div className="bg-white rounded-lg border-2 border-slate-300 overflow-hidden">
            <img src={previewUrl} alt="Uploaded connection code" className="w-full h-auto" />
          </div>
          <button
            onClick={clearPreview}
            className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
          >
            <X size={16} />
          </button>
          {isDecoding && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
              <div className="text-white font-bold">Decoding...</div>
            </div>
          )}
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onPaste={handlePaste}
          tabIndex={0}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
            ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:border-blue-400'}`}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="mx-auto mb-2 text-slate-400" size={32} />
          <p className="text-sm text-slate-600 font-semibold mb-1">
            Upload Connection Image
          </p>
          <p className="text-xs text-slate-500">
            Click, drag & drop, or paste (Ctrl+V)
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInput}
            className="hidden"
          />
        </div>
      )}

      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
          {error}
        </div>
      )}

      <p className="text-xs text-slate-600 text-center">
        Upload the image you received to auto-fill the code
      </p>
    </div>
  );
};

export default ImageUploader;
