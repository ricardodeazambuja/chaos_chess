import React, { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import { hashToImage } from '../network/utils/image-codec';

interface ConnectionImageProps {
  hash: string;
  role: 'offer' | 'answer';
  label: string;
}

const ConnectionImage: React.FC<ConnectionImageProps> = ({ hash, role, label }) => {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (hash) {
      generateImage();
    }
  }, [hash]);

  const generateImage = async () => {
    setIsGenerating(true);
    try {
      const blob = await hashToImage(hash, role);
      const url = URL.createObjectURL(blob);
      setImageUrl(url);
    } catch (error) {
      console.error('Failed to generate image:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!imageUrl) return;

    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `chaos-chess-${role}-code.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!hash) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-slate-800 text-sm">{label}</h4>
        {imageUrl && (
          <button
            onClick={handleDownload}
            className="flex items-center gap-1 px-3 py-1 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Download size={16} />
            Download
          </button>
        )}
      </div>

      {isGenerating ? (
        <div className="flex items-center justify-center p-8 bg-slate-100 rounded-lg">
          <div className="text-slate-600">Generating image...</div>
        </div>
      ) : imageUrl ? (
        <div className="bg-white rounded-lg border-2 border-slate-300 overflow-hidden">
          <img
            src={imageUrl}
            alt={`${role} connection code`}
            className="w-full h-auto"
          />
        </div>
      ) : null}

      <p className="text-xs text-slate-600 text-center">
        Download and share this image via messaging apps
      </p>
    </div>
  );
};

export default ConnectionImage;
