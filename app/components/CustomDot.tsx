import React from 'react';

export interface CustomDotProps {
  cx: number;
  cy: number;
  value: number;
  parameter: string;
  range: { min: number; max: number };
  isActive?: boolean;
  // Make these props optional
  chartWidth?: number;
  chartHeight?: number;
}

export const CustomDot: React.FC<CustomDotProps> = ({ 
  cx, 
  cy, 
  value, 
  parameter, 
  range, 
  isActive,
  // Provide default values
  chartWidth = Infinity,
  chartHeight = Infinity
}) => {
  const isOutOfRange = value < range.min || value > range.max;
  const fill = isOutOfRange ? "#fece00" : "#fe302f";
  const normalRadius = 4;
  const activeRadius = 6;
  const radius = isActive ? activeRadius : normalRadius;
  
  // Check if the dot is at the edge of the chart
  const isAtEdge = cx <= radius || cy <= radius || cx >= chartWidth - radius || cy >= chartHeight - radius;

  // Don't render if the dot is at the edge
  if (isAtEdge) return null;

  return (
    <g>
      {isOutOfRange && (
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#fe302f" strokeWidth={1} />
      )}
      <circle cx={cx} cy={cy} r={radius} fill={fill} />
    </g>
  );
};

export default CustomDot;