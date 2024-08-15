import React from 'react';
import { normalRanges } from '@/data/normalRanges';

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  coordinate?: { x: number; y: number };
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, coordinate }) => {
  if (active && payload && payload.length && coordinate) {
    const { parameter, actualValue, unit, quantile } = payload[0].payload;
    const range = normalRanges[parameter][payload[0].payload.patientType] || normalRanges[parameter].Adults;

    const chartCenterX = 200;
    const chartCenterY = 200;
    const angle = Math.atan2(coordinate.y - chartCenterY, coordinate.x - chartCenterX);
    const distance = 100;

    const tooltipX = coordinate.x + Math.cos(angle) * distance;
    const tooltipY = coordinate.y + Math.sin(angle) * distance;

    const style: React.CSSProperties = {
      backgroundColor: 'white',
      padding: '10px',
      border: '1px solid #ccc',
      borderRadius: '4px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      fontSize: '12px',
      position: 'absolute',
      top: `${tooltipY}px`,
      left: `${tooltipX}px`,
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'none',
      zIndex: 1000,
      minWidth: '200px',
      maxWidth: '350px',
    };

    return (
      <div className="custom-tooltip" style={style}>
        <p className="font-bold text-base mb-1">{parameter}</p>
        <p className="mb-1"><strong>Value:</strong> {actualValue.toFixed(2)} {unit}</p>
        {range && (
          <p className="mb-1"><strong>Range:</strong> {range.min} - {range.max} {unit}</p>
        )}
        <p><strong>Quantile:</strong> {quantile.toFixed(2)}%</p>
      </div>
    );
  }

  return null;
};

export default CustomTooltip;