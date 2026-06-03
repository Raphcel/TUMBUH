import React, { useMemo, useState } from 'react';
import { Building2 } from 'lucide-react';
import { resolveUploadUrl } from '../../api/client';

function getInitials(name) {
  return (name || 'Company')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'C';
}

export function CompanyLogo({
  company,
  name,
  logo,
  alt,
  className = 'h-10 w-10 rounded-lg border border-[#E6ECF5] bg-white p-1',
  imageClassName = 'h-full w-full object-contain',
  fallbackClassName = 'text-sm font-bold text-[#0A1D3D]/40',
  fallbackIcon = Building2,
  useIconFallback = false,
}) {
  const companyName = company?.name || name || 'Company';
  const rawLogo = logo ?? company?.logo;
  const src = useMemo(() => resolveUploadUrl(rawLogo), [rawLogo]);
  const [failedSrc, setFailedSrc] = useState(null);
  const canShowImage = src && failedSrc !== src;

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden ${className}`}
      aria-label={`${companyName} logo`}
    >
      {canShowImage ? (
        <img
          src={src}
          alt={alt ?? companyName}
          className={imageClassName}
          loading="lazy"
          onError={() => setFailedSrc(src)}
        />
      ) : useIconFallback ? (
        React.createElement(fallbackIcon, { size: 18, className: fallbackClassName })
      ) : (
        <span className={fallbackClassName}>{getInitials(companyName)}</span>
      )}
    </div>
  );
}

export default CompanyLogo;
