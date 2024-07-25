"use client"

import { useState, useEffect, useRef } from "react"
import { TrendingUp, TrendingDown, ChevronDown } from "lucide-react"
import { Area, Line, LineChart, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"
import Papa from "papaparse"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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
  const [patientType, setPatientType] = useState("Women")
  const [selectedParameter, setSelectedParameter] = useState<keyof BloodTestResult>("RBC")
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [dropdownRef])

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

  if (loading) return <div className="w-screen h-screen flex items-center justify-center">Loading...</div>
  if (error) return <div className="w-screen h-screen flex items-center justify-center text-red-500">Error: {error}</div>

  const range = normalRanges[selectedParameter][patientType] || normalRanges[selectedParameter].Adults;
  const unit = normalRanges[selectedParameter].unit;
  const middle = calculateMiddle(range.min, range.max);
  const domain = calculateDomain(data, selectedParameter, range);

  return (
    <div className="w-screen min-h-screen bg-gray-100 flex justify-center items-start pt-10">
      <Card className="w-1/2 bg-white rounded-lg shadow-lg overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between px-6 py-4">
          <CardTitle className="text-2xl font-bold">{selectedParameter} Over Time</CardTitle>
          <div className="relative" ref={dropdownRef}>
            <button
              className={`flex items-center justify-between w-32 px-3 py-2 text-sm font-medium text-gray-700 bg-white border ${isDropdownOpen ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm hover:bg-gray-50 focus:outline-none ${isDropdownOpen ? 'focus:ring-2 focus:ring-red-500 focus:ring-offset-2' : ''}`}
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              {selectedParameter}
              <ChevronDown className="w-5 h-5 ml-2 -mr-1" aria-hidden="true" />
            </button>
            {isDropdownOpen && (
              <div className="absolute right-0 w-32 py-1 mt-1 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-10">
                {parameters.map((param) => (
                  <a
                    key={param}
                    href="#"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    style={{ color: param === selectedParameter ? '#fe302f' : undefined }}
                    onClick={(e) => {
                      e.preventDefault();
                      setSelectedParameter(param);
                      setIsDropdownOpen(false);
                    }}
                  >
                    {param}
                  </a>
                ))}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-6 pt-0 pb-6">
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
                  dot={<CustomDot parameter={selectedParameter} range={range} />}
                  activeDot={<CustomDot parameter={selectedParameter} range={range} isActive={true} />}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 text-sm">
            <div className="flex items-center gap-2 font-medium">
              Trending Analysis {calculateTrend(selectedParameter) > 0 ? <TrendingUp className="h-5 w-5 text-green-500" /> : <TrendingDown className="h-5 w-5 text-red-500" />}
            </div>
            <div className="text-gray-600">
              Trending {calculateTrend(selectedParameter) > 0 ? 'up' : 'down'} by {Math.abs(calculateTrend(selectedParameter)).toFixed(1)}% this month
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
