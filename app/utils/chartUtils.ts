import { BloodTestResult } from '@/types/BloodTestResult';
import { normalRanges, NormalRangeKey } from '@/data/normalRanges';


export const formatDate = (input: string | Date) => {
  let date: Date;
  if (input instanceof Date) {
    date = input;
  } else if (typeof input === 'string') {
    if (input.includes("/")) {
      const [day, month, year] = input.split("/")
      date = new Date(2000 + parseInt(year), parseInt(month) - 1, parseInt(day))
    } else {
      date = new Date(input.split(" ")[0].split(".").reverse().join("-"))
    }
  } else {
    return "Invalid Date";
  }

  if (isNaN(date.getTime())) {
    return "Invalid Date"
  }

  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export const sortByDate = (data: BloodTestResult[]) => {
  return data.sort((a, b) => {
    const dateA = new Date(a.Date.split(".").reverse().join("-"));
    const dateB = new Date(b.Date.split(".").reverse().join("-"));
    return dateA.getTime() - dateB.getTime();
  });
}

export const calculateQuantile = (value: number, min: number, max: number) => {
  return ((value - min) / (max - min)) * 100;
}

export const calculateMiddle = (min: number, max: number) => {
  return (min + max) / 2;
}

export const calculateDomain = (data: BloodTestResult[], parameter: NormalRangeKey, range: { min: number, max: number }) => {
  const values = data.map(item => item[parameter] as number).filter(value => value !== undefined);
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const domainMin = Math.min(dataMin, range.min);
  const domainMax = Math.max(dataMax, range.max);
  const padding = (domainMax - domainMin) * 0.1; // 10% padding
  return [domainMin - padding, domainMax + padding];
}

export const calculateTrend = (data: BloodTestResult[], parameter: NormalRangeKey) => {
  if (data.length < 2) return 0;
  const lastValue = data[data.length - 1][parameter] as number;
  const secondLastValue = data[data.length - 2][parameter] as number;
  return ((lastValue - secondLastValue) / secondLastValue) * 100;
}

export const normalizeValue = (value: number, min: number, max: number) => {
  const range = max - min;
  const extendedMin = min - range * 0.5; // Extend the range below the minimum
  const extendedMax = max + range * 0.5; // Extend the range above the maximum
  return ((value - extendedMin) / (extendedMax - extendedMin)) * 100;
};