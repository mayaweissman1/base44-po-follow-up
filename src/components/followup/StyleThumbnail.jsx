import React, { useState } from 'react';
import { ImageIcon, X, ZoomIn } from 'lucide-react';

export default function StyleThumbnail({ styleColor, imageUrl, size = 32, className = '' }) {
  const [errored, setErrored] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  React.useEffect(() => { setErrored(false); }, [styleColor, imageUrl]);

  const url = imageUrl
    || (styleColor
      ? `https://res.cloudinary.com/edikted/image/upload/v1610271170/samples/${styleColor}.jpg`
      : null);

  const dim = { width: size, height: size };

  if (!url || errored) {
    return (
      <div
        style={dim}
        title={styleColor ? `No image for ${styleColor}` : 'No style color'}
        className={`flex items-center justify-center bg-[#FAFAFA] border border-[#E5E5E5] rounded-[6px] text-[#D4D4D4] flex-shrink-0 ${className}`}
      >
        <ImageIcon size={Math.max(12, size * 0.5)} />
      </div>
    );
  }

  return (
    <>
      <div
        className={`relative group flex-shrink-0 cursor-zoom-in ${className}`}
        style={dim}
        onClick={e => { e.stopPropagation(); setLightboxOpen(true); }}
        title={`Click to zoom — ${styleColor}`}
      >
        <img
          src={url}
          alt={styleColor}
          style={dim}
          onError={() => setErrored(true)}
          className="object-cover border border-[#E5E5E5] rounded-[6px] bg-[#FAFAFA] w-full h-full"
        />
        <div className="absolute inset-0 rounded-[6px] bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <ZoomIn size={Math.max(10, size * 0.35)} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
        </div>
      </div>

      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            onClick={() => setLightboxOpen(false)}
          >
            <X size={20} />
          </button>
          <img
            src={url}
            alt={styleColor}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-[8px] shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          {styleColor && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs font-mono px-3 py-1.5 rounded-full">
              {styleColor}
            </div>
          )}
        </div>
      )}
    </>
  );
}
