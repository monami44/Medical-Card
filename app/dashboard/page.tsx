"use client"

import React, { useState, useEffect } from "react"
import { TrendingUp, TrendingDown } from "lucide-react"
import { LineChart, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Line, Area } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/lib/components/ui/card"
import { BloodTestResult } from '@/types/BloodTestResult'
import { normalRanges, NormalRangeKey } from '@/data/normalRanges'
import { formatDate, sortByDate, calculateMiddle, calculateDomain, calculateTrend } from '@/utils/chartUtils'
import ParameterDropdown from '@/components/ParameterDropdown'
import RadarChartComponent from '@/components/RadarChartComponent'
import DateDropdown from '@/components/DateDropdown'
import { CustomDot } from '@/components/CustomDot'
import { useAuth } from '@clerk/nextjs'
import { storeProcessedData, getBloodTestResults } from '@/utils/indexedDB'



export default function Dashboard() {
  const [data, setData] = useState<BloodTestResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [patientType, setPatientType] = useState("Women")
  const [selectedParameter, setSelectedParameter] = useState<NormalRangeKey>("RBC")
  const [isParameterDropdownOpen, setIsParameterDropdownOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const { getToken } = useAuth()

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        // Try to get encrypted data from IndexedDB
        let encryptedData = await getBloodTestResults();

        if (!encryptedData) {
          // If not in IndexedDB, fetch from server
          const token = await getToken();
          const response = await fetch('/api/process-emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!response.ok) throw new Error('Failed to fetch data');
          const result = await response.json();
          encryptedData = result.bloodTestResults;
          // Store in IndexedDB for future use
          await storeProcessedData(encryptedData);
        }

        // Decrypt the data
        const token = await getToken();
        console.log('Encrypted data before decryption:', encryptedData);
        const decryptResponse = await fetch('/api/decrypt-data', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}` 
          },
          body: JSON.stringify({ encryptedData }),
        });
        if (!decryptResponse.ok) throw new Error('Failed to decrypt data');
        const decryptedResult = await decryptResponse.json();
        console.log('Decrypted result:', decryptedResult);

        try {
          const sortedData = sortByDate(decryptedResult.data);
          setData(sortedData);
          if (sortedData.length > 0 && sortedData[sortedData.length - 1].Date) {
            setSelectedDate(sortedData[sortedData.length - 1].Date);
          } else {
            console.warn("No valid dates found in the data");
            setSelectedDate(null);
          }
        } catch (error) {
          console.error("Error sorting data:", error);
          setError(`Failed to process data: ${error.message}`);
        }

        setLoading(false);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError(`Failed to load data: ${err.message}`);
        setLoading(false);
      }
    }

    fetchData();
  }, [getToken]);

  const parameters: NormalRangeKey[] = [
    "WBC", "RBC", "HGB", "HCT", "MCV", "MCH"
  ]

  const dates = data.map(item => item.Date).reverse()

  if (loading) return <div className="w-screen h-screen flex items-center justify-center">Loading...</div>
  if (error) return <div className="w-screen h-screen flex items-center justify-center text-red-500">Error: {error}</div>

  const range = normalRanges[selectedParameter][patientType] || (normalRanges[selectedParameter] as any).Adults;
  const unit = normalRanges[selectedParameter].unit;
  const middle = calculateMiddle(range.min, range.max);
  const domain = calculateDomain(data, selectedParameter, range);

  return (
    <div className="w-screen min-h-screen bg-gray-100 flex justify-center items-start pt-10">
      <div className="flex w-full max-w-6xl space-x-4">
        <Card className="flex-1 bg-white rounded-lg shadow-lg overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between px-6 py-4">
            <CardTitle className="text-2xl font-bold">{selectedParameter} Over Time</CardTitle>
            <ParameterDropdown
              selectedParameter={selectedParameter}
              isOpen={isParameterDropdownOpen}
              setIsOpen={setIsParameterDropdownOpen}
              setSelectedParameter={setSelectedParameter}
              parameters={parameters}
            />
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
                    dataKey="Date" 
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
                      const paramRange = normalRanges[selectedParameter][patientType] || (normalRanges[selectedParameter] as any).Adults;
                      const quantile = ((value - paramRange.min) / (paramRange.max - paramRange.min)) * 100;
                      return [
                        <span>
                          {value.toFixed(2)} {unit}
                          <br />
                          <span style={{ color: 'black' }}>
                            Quantile: {quantile.toFixed(2).replace('.', ',')}%
                          </span>
                          <br />
                          <span style={{ color: 'black' }}>
                            Range: {paramRange.min} - {paramRange.max} {unit}
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
                    dot={(props) => (
                      <CustomDot
                        {...props}
                        parameter={selectedParameter}
                        range={range}
                      />
                    )}
                    activeDot={(props) => (
                      <CustomDot
                        {...props}
                        parameter={selectedParameter}
                        range={range}
                        isActive={true}
                      />
                    )}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 text-sm">
              <div className="flex items-center gap-2 font-medium">
                Trending Analysis {calculateTrend(data, selectedParameter) > 0 ? <TrendingUp className="h-5 w-5 text-green-500" /> : <TrendingDown className="h-5 w-5 text-red-500" />}
              </div>
              <div className="text-gray-600">
                Trending {calculateTrend(data, selectedParameter) > 0 ? 'up' : 'down'} by {Math.abs(calculateTrend(data, selectedParameter)).toFixed(1)}% this month
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="flex-1 bg-white rounded-lg shadow-lg overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between px-6 py-4">
            <CardTitle className="text-2xl font-bold">Radar Chart</CardTitle>
            <DateDropdown
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              dates={dates}
            />
          </CardHeader>
          <CardContent className="pb-0">
            <div className="mx-auto aspect-square max-h-[400px]">
              <RadarChartComponent 
                data={data} 
                selectedDate={selectedDate} 
                patientType={patientType}
              />
            </div>
          </CardContent>
          <CardFooter className="flex-col gap-2 text-sm">
            <div className="flex items-center gap-2 font-medium leading-none">
              Data as of {formatDate(selectedDate)}
            </div>
            <div className="flex items-center gap-2 leading-none text-muted-foreground">
              Updated regularly
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}