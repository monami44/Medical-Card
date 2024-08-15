import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, Area } from 'recharts';
import { formatDate, calculateQuantile } from '@/utils/chartUtils';
import { normalRanges } from '@/data/normalRanges';
import CustomDot from './CustomDot';

interface LineChartComponentProps {
  data: any[];
  selectedParameter: string;
  patientType: string;
  unit: string;
}

const LineChartComponent: React.FC<LineChartComponentProps> = ({ data, selectedParameter, patientType, unit }) => {
  const range = normalRanges[selectedParameter][patientType] || normalRanges[selectedParameter].Adults;
  const middle = (range.min + range.max) / 2;

  const calculateDomain = (data: any[], parameter: string, range: { min: number, max: number }) => {
    const values = data.map(item => item[parameter]).filter(value => value !== undefined);
    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);
    const domainMin = Math.min(dataMin, range.min);
    const domainMax = Math.max(dataMax, range.max);
    const padding = (domainMax - domainMin) * 0.1;
    return [domainMin - padding, domainMax + padding];
  };

  const domain = calculateDomain(data, selectedParameter, range);

  return (
    <div style={{ width: '100%', height: '400px' }}>
      <ResponsiveContainer key={selectedParameter} width="100%" height="100%">
        <LineChart
          data={data}
          margin={{
            top: 5, right: 30, left: 20, bottom: 25,
          }}
        >
          <XAxis 
            dataKey="Date & Time" 
            tickFormatter={formatDate}
            angle={-45}
            textAnchor="end"
            height={60}
            interval={0}
            tick={{ fontSize: 12 }}
          />
          <YAxis 
            domain={domain}
            ticks={[range.min, middle, range.max]}
            tickFormatter={(value) => value.toFixed(2)}
            tick={{ fontSize: 12 }}
            label={{ 
              value: unit, 
              angle: -90,
              position: 'insideLeft',
              style: { textAnchor: 'middle', fill: '#666' }
            }}
          />
          <Tooltip 
            labelFormatter={formatDate}
            formatter={(value: number, name: string, props: any) => {
              const quantile = calculateQuantile(value, range.min, range.max);
              return [
                <span>
                  {value.toFixed(2)} {unit}
                  <br />
                  <span style={{ color: 'black' }}>
                    Quantile: {quantile.toFixed(2).replace('.', ',')}%
                  </span>
                  <br />
                  <span style={{ color: 'black' }}>
                    Range: {range.min} - {range.max} {unit}
                  </span>
                </span>,
                selectedParameter
              ];
            }}
          />
          <ReferenceLine y={range.min} stroke="red" strokeDasharray="3 3" />
          <ReferenceLine y={range.max} stroke="red" strokeDasharray="3 3" />
          <Area
            type="monotone"
            dataKey={selectedParameter}
            fill="rgba(255, 0, 0, 0.2)"
            stroke="transparent"
          />
          <Line
            type="monotone"
            dataKey={selectedParameter}
            stroke="#ff0000"
            strokeWidth={2}
            dot={<CustomDot parameter={selectedParameter} range={range} cx={0} cy={0} value={0} />}
            activeDot={<CustomDot parameter={selectedParameter} range={range} isActive={true} cx={0} cy={0} value={0} />}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default LineChartComponent;