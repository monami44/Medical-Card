import React from 'react';

interface CustomRadarDotProps {
  cx: number;
  cy: number;
  value: number;
  payload: {
    isOutOfRange: boolean;
  };
}

const CustomRadarDot: React.FC<CustomRadarDotProps> = ({ cx, cy, payload }) => {
  const isOutOfRange = payload && payload.isOutOfRange;
  const fill = isOutOfRange ? "#fece00" : "#fe302f";
  const radius = 4;

  return (
    <g>
      {isOutOfRange && (
        <circle cx={cx} cy={cy} r={radius + 1} fill="none" stroke="#fe302f" strokeWidth={1} />
      )}
      <circle cx={cx} cy={cy} r={radius} fill={fill} />
    </g>
  );
};

export default CustomRadarDot;