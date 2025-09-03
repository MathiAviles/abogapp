import React from 'react';
/**
 * value: número (ej. 4.2), size: px opcional
 */
export default function StarRating({ value = 0, size = 18, showValue = false }) {
  const percentage = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative', width: size * 5, height: size, lineHeight: 0 }}>
        <div style={{ color: '#ddd', position: 'absolute', inset: 0, whiteSpace: 'nowrap', overflow: 'hidden' }}>
          {'★★★★★'}
        </div>
        <div style={{ color: '#FFC107', position: 'absolute', inset: 0, whiteSpace: 'nowrap', width: `${percentage}%`, overflow: 'hidden' }}>
          {'★★★★★'}
        </div>
      </div>
      {showValue && <span style={{ fontSize: 12, color: '#555' }}>{value.toFixed(2)}</span>}
    </div>
  );
}