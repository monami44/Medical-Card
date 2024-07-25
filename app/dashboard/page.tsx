"use client"

import { useState, useEffect } from "react"
import { TrendingUp, TrendingDown } from "lucide-react"
import { Area, Line, LineChart, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"
import Papa from "papaparse"

const CustomDot = (props: any) => {
  const { cx, cy, value, parameter, range, isActive } = props;
  const isOutOfRange = value < range.min || value > range.max;
  const fill = isOutOfRange ? "#fece00" : "#fe302f";
  const normalRadius = 4;
  const activeRadius = 6;
  const radius = isActive ? activeRadius : normalRadius;
  
  return (
    <g>
      {isOutOfRange && (
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#fe302f" strokeWidth={1} />
      )}
      <circle cx={cx} cy={cy} r={radius} fill={fill} />
    </g>
  );
};

interface BloodTestResult {
  "Date & Time": string;
  WBC?: number;
  RBC?: number;
  HGB?: number;
  HCT?: number;
  MCV?: number;
  MCH?: number;
  MCHC?: number;
  PLT?: number;
  "LYM%"?: number;
  "MXD%"?: number;
  "NEUT%"?: number;
  "LYM#"?: number;
  "MXD#"?: number;
  "NEUT#"?: number;
  "RDW-SD"?: number;
  "RDW-CV"?: number;
  PDW?: number;
  MPV?: number;
  "P-LCR"?: number;
  PCT?: number;
}

const normalRanges = {
  WBC: { 
    Adults: { min: 4000, max: 11000 },
    Children: { min: 5000, max: 10000 },
    Newborns: { min: 9000, max: 30000 },
    unit: "cells/µL"
  },
  RBC: { 
    Men: { min: 4.7, max: 6.1 },
    Women: { min: 4.2, max: 5.4 },
    Children: { min: 4.1, max: 5.5 },
    Newborns: { min: 4.8, max: 7.2 },
    unit: "million cells/µL"
  },
  HGB: { 
    Men: { min: 13.8, max: 17.2 },
    Women: { min: 12.1, max: 15.1 },
    Children: { min: 11, max: 16 },
    Newborns: { min: 14, max: 24 },
    unit: "g/dL"
  },
  HCT: { 
    Men: { min: 41, max: 50 },
    Women: { min: 36, max: 48 },
    Children: { min: 35, max: 45 },
    Newborns: { min: 44, max: 64 },
    unit: "%"
  },
  MCV: { 
    Adults: { min: 80, max: 100 },
    Children: { min: 70, max: 86 },
    Newborns: { min: 95, max: 120 },
    unit: "fL"
  },
  MCH: { 
    Adults: { min: 27, max: 33 },
    Children: { min: 24, max: 30 },
    Newborns: { min: 30, max: 37 },
    unit: "pg/cell"
  },
  // ... add other parameters as needed
};

const fetchData = async (): Promise<BloodTestResult[]> => {
  try {
    const response = await fetch("/blood_test_results.csv")
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const text = await response.text()
    const parsedData = Papa.parse<BloodTestResult>(text, { header: true, dynamicTyping: true })
    return parsedData.data
  } catch (error) {
    console.error("Error fetching or parsing data:", error)
    throw error
  }
}

const formatDate = (dateString: string) => {
  let date;
  if (dateString.includes("/")) {
    const [day, month, year] = dateString.split("/")
    date = new Date(2000 + parseInt(year), parseInt(month) - 1, parseInt(day))
  } else {
    date = new Date(dateString.split(" ")[0].split(".").reverse().join("-"))
  }

  if (isNaN(date.getTime())) {
    return "Invalid Date"
  }

  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

const sortByDate = (data: BloodTestResult[]) => {
  return data.sort((a, b) => {
    const dateA = new Date(a["Date & Time"].split(" ")[0].split(".").reverse().join("-"))
    const dateB = new Date(b["Date & Time"].split(" ")[0].split(".").reverse().join("-"))
    return dateA.getTime() - dateB.getTime()
  })
}

const calculateQuantile = (value: number, min: number, max: number) => {
  return ((value - min) / (max - min)) * 100;
}

export default function Dashboard() {
  const [data, setData] = useState<BloodTestResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [patientType, setPatientType] = useState("Women") // Hardcoded for now, can be made dynamic later

  useEffect(() => {
    fetchData()
      .then(fetchedData => {
        const sortedData = sortByDate(fetchedData)
        setData(sortedData)
        setLoading(false)
      })
      .catch(err => {
        console.error("Error in useEffect:", err)
        setError(`Failed to load data: ${err.message}`)
        setLoading(false)
      })
  }, [])

  const parameters: (keyof BloodTestResult)[] = [
    "WBC", "RBC", "HGB", "HCT", "MCV", "MCH"
  ]

  const calculateTrend = (parameter: keyof BloodTestResult) => {
    if (data.length < 2) return 0;
    const lastValue = data[data.length - 1][parameter] as number;
    const secondLastValue = data[data.length - 2][parameter] as number;
    return ((lastValue - secondLastValue) / secondLastValue) * 100;
  }

  const calculateMiddle = (min: number, max: number) => {
    return (min + max) / 2;
  }

  const calculateDomain = (data: BloodTestResult[], parameter: keyof BloodTestResult, range: { min: number, max: number }) => {
    const values = data.map(item => item[parameter] as number).filter(value => value !== undefined);
    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);
    const domainMin = Math.min(dataMin, range.min);
    const domainMax = Math.max(dataMax, range.max);
    const padding = (domainMax - domainMin) * 0.1; // 10% padding
    return [domainMin - padding, domainMax + padding];
  }

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div className="flex flex-col gap-24 w-screen px-5">
      {parameters.map(parameter => {
        const range = normalRanges[parameter][patientType] || normalRanges[parameter].Adults;
        const unit = normalRanges[parameter].unit;
        const middle = calculateMiddle(range.min, range.max);
        const domain = calculateDomain(data, parameter, range);

        return (
          <div key={parameter} className="w-full">
            <h2 className="text-2xl font-bold mb-1">{parameter} Levels Over Time</h2>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={data}
                  margin={{
                    top: 40, right: 30, left: 70, bottom: 30,
                  }}
                >
                  <XAxis 
                    dataKey="Date & Time" 
                    tickFormatter={formatDate}
                    angle={-60}
                    textAnchor="end"
                    height={80}
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
                      angle: 0,
                      position: 'insideTopLeft',
                      offset: parameter === 'RBC' ? -20 : -10,
                      style: { textAnchor: 'start', fill: '#666' }
                    }}
                    width={60}
                  />
                  <Tooltip 
                    labelFormatter={formatDate}
                    formatter={(value: number, name: string) => {
                      const quantile = calculateQuantile(value, range.min, range.max);
                      return [
                        <span>
                          {value.toFixed(2)} {unit}
                          <br />
                          <span style={{ color: 'black' }}>
                            Quantile: {quantile.toFixed(2).replace('.', ',')}%
                          </span>
                        </span>,
                        parameter
                      ];
                    }}
                  />
                  <ReferenceLine y={range.min} stroke="red" strokeDasharray="3 3" />
                  <ReferenceLine y={range.max} stroke="red" strokeDasharray="3 3" />
                  <Area
                    type="monotone"
                    dataKey={parameter}
                    fill="rgba(255, 0, 0, 0.2)"
                    stroke="transparent"
                  />
                  <Line
                    type="monotone"
                    dataKey={parameter}
                    stroke="#ff0000"
                    strokeWidth={2}
                    dot={<CustomDot parameter={parameter} range={range} />}
                    activeDot={<CustomDot parameter={parameter} range={range} isActive={true} />}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="-mt-5 text-sm">
              <div className="flex gap-2 font-medium">
                Trending Analysis {calculateTrend(parameter) > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              </div>
              <div className="text-gray-600">
                Trending {calculateTrend(parameter) > 0 ? 'up' : 'down'} by {Math.abs(calculateTrend(parameter)).toFixed(1)}% this month
              </div>
              <div className="text-gray-600">
                Normal range for {patientType}: {range.min.toFixed(2)} - {range.max.toFixed(2)} {unit}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}