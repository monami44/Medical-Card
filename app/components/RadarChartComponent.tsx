import React from 'react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from 'recharts';
import CustomRadarDot from './CustomRadarDot';
import CustomTooltip from './CustomTooltip';
import { normalRanges, NormalRangeKey } from '@/data/normalRanges';
import { normalizeValue, calculateQuantile } from '@/utils/chartUtils';

interface RadarChartComponentProps {
  data: any[];
  selectedDate: string;
  patientType: string;
}

const RadarChartComponent: React.FC<RadarChartComponentProps> = ({ data, selectedDate, patientType }) => {
  const parameters: NormalRangeKey[] = [
    "WBC", "RBC", "HGB", "HCT", "MCV", "MCH"
  ];

  const radarData = parameters.map((param) => {
    const value = data.find(item => item.Date === selectedDate)?.[param] as number ?? 0;
    const range = normalRanges[param] && (normalRanges[param][patientType] || normalRanges[param]['Adults']);
    const normalizedValue = range ? normalizeValue(value, range.min, range.max) : 50;
    const normalizedMin = range ? normalizeValue(range.min, range.min, range.max) : 0;
    const normalizedMax = range ? normalizeValue(range.max, range.min, range.max) : 100;
    const quantile = range ? calculateQuantile(value, range.min, range.max) : 50;
    return { 
      parameter: param, 
      value: normalizedValue,
      min: normalizedMin,
      max: normalizedMax,
      actualValue: value,
      unit: normalRanges[param] ? normalRanges[param].unit : '',
      isOutOfRange: range ? (value < range.min || value > range.max) : false,
      quantile: quantile,
      patientType: patientType
    };
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart data={radarData}>
        <PolarGrid />
        <PolarAngleAxis dataKey="parameter" />
        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} />
        <Radar 
          name="Value" 
          dataKey="value" 
          stroke="#fe302f" 
          fill="#fe302f" 
          fillOpacity={0.3}
          dot={(props) => <CustomRadarDot {...props} />}
        />
        <Radar 
          name="Min" 
          dataKey="min" 
          stroke="#ff0000" 
          strokeWidth={2} 
          fill="none" 
          strokeDasharray="5 5"
        />
        <Radar 
          name="Max" 
          dataKey="max" 
          stroke="#ff0000" 
          strokeWidth={2} 
          fill="none"
          strokeDasharray="5 5"
        />
        <Tooltip content={<CustomTooltip />} />
      </RadarChart>
    </ResponsiveContainer>
  );
};

export default RadarChartComponent;