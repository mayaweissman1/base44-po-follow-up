import React, { useState } from 'react';
import { ImageIcon } from 'lucide-react';

/**
 * Small/medium thumbnail of a style_color from Cloudinary.
 * Falls back to a placeholder when the image fails to load or styleColor is missing.
 */
export default function StyleThumbnail({ styleColor, size = 32, className = '' }) {
  // Reset error state when styleColor changes (component instance can be reused
  // across rows when the filtered list shrinks, causing a stale `errored=true`
  // to hide a valid image for a different style_color).
  const [errored, setErrored] = useState(false);
  React.useEffect(() => { setErrored(false); }, [styleColor]);

  const url = styleColor
    ? `https://res.cloudinary.com/edikted/image/upload/v1610271170/samples/${styleColor}.jpg`
    : null;

  const dim = { width: size, height: size };

  if (!url || errored) {
    return (
      <div
        style={dim}
        title={styleColor ? `No image for ${styleColor}` : 'No style color'}
        className={`flex items-center justify-center bg-white border border-dashed border-[#D4D4D4] rounded-[6px] text-[#A3A3A3] flex-shrink-0 ${className}`}
      >
        <ImageIcon size={Math.max(10, size * 0.4)} />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={styleColor}
      style={dim}
      onError={() => setErrored(true)}
      className={`object-cover border border-[#E5E5E5] rounded-[6px] bg-[#FAFAFA] flex-shrink-0 ${className}`}
    />
  );
}