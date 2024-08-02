"use client"
import React, { useState, useEffect } from "react"
import { TrendingUp, TrendingDown } from "lucide-react"
import { LineChart, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Line, Area } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/lib/components/ui/card"
import { BloodTestResult } from '@/types/BloodTestResult'
import { normalRanges, NormalRangeKey } from '@/data/normalRanges'
import { sortByDate, calculateMiddle, calculateDomain, calculateTrend, fetchData, fetchAndEncryptData } from '@/utils/chartUtils'
import { storeFile, retrieveFile, getAllFiles } from '@/utils/fileUtils'
import { CustomDot, DateDropdown, ParameterDropdown, RadarChartComponent } from '@/components/index'
import { EncryptedFile } from "@/types/EncryptedFile"
import { useUser } from "@clerk/nextjs";
import { getStoredKey } from "@/utils/encryption"

export default function Dashboard() {
  const [data, setData] = useState<BloodTestResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [patientType, setPatientType] = useState("Women")
  const [selectedParameter, setSelectedParameter] = useState<NormalRangeKey>("RBC")
  const [isParameterDropdownOpen, setIsParameterDropdownOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [files, setFiles] = useState<EncryptedFile[]>([]);
  const [encryptionPassword, setEncryptionPassword] = useState<string>('');
  const [isDecrypted, setIsDecrypted] = useState(false);
  const [encryptionPasswordSetup, setEncryptionPasswordSetup] = useState(false);
  const [newEncryptionPassword, setNewEncryptionPassword] = useState('');

  const { user } = useUser();

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString;
    }
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleDecrypt = async () => {
    try {
      if (!user) throw new Error("User not authenticated");
      console.log("Attempting to decrypt data for user:", user.id);
      const key = await getStoredKey(user.id, encryptionPassword);
      console.log("Key retrieved successfully");
      const decryptedData = await fetchData(user.id, encryptionPassword);
      console.log("Data decrypted successfully:", decryptedData.length, "items");
      const uniqueDates = new Set(decryptedData.map(item => formatDate(item.Date)));
      const sortedData = sortByDate(decryptedData.filter((item, index) => 
        index === decryptedData.findIndex(t => formatDate(t.Date) === formatDate(item.Date))
      ));
      setData(sortedData.map(item => ({...item, Date: formatDate(item.Date)})));
      setSelectedDate(formatDate(sortedData[sortedData.length - 1]?.Date) || null);
      setIsDecrypted(true);
      setLoading(false);
    } catch (error) {
      console.error("Decryption failed:", error);
      setError(`Failed to decrypt data: ${error.message}`);
      setLoading(false);
    }
  };

  const handleEncryptionPasswordSetup = async () => {
    if (!user || !newEncryptionPassword) return;
    try {
      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      console.log('Generated salt:', salt);
      
      const response = await fetch('/api/setup-encryption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salt: Array.from(salt), password: newEncryptionPassword }),
      });
      
      const responseData = await response.json();
      
      if (!response.ok) {
        console.error('API error:', responseData);
        throw new Error(responseData.error || 'Failed to set up encryption');
      }
      
      console.log('Encryption setup successful:', responseData);
      setEncryptionPassword(newEncryptionPassword);
      setEncryptionPasswordSetup(true);

      await fetchAndEncryptData(user.id, newEncryptionPassword);
      setIsDecrypted(true);
    } catch (error) {
      console.error('Error setting up encryption password:', error);
      setError(`Failed to set up encryption password. ${error.message}`);
    }
  };

  useEffect(() => {
    if (user && encryptionPassword && !isDecrypted) {
      fetchAndEncryptData(user.id, encryptionPassword)
        .then(() => handleDecrypt())
        .catch(error => {
          console.error('Error fetching and encrypting data:', error);
          setError(`Failed to fetch and encrypt data. ${error.message}`);
        });
    }
  }, [user, encryptionPassword, isDecrypted]);

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    const allFiles = await getAllFiles();
    setFiles(allFiles);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && user) {
      await storeFile(file, user.id, encryptionPassword);
      await loadFiles();
    }
  };

  const handleFileDownload = async (id: number, type: 'original' | 'processed') => {
    if (!user) return;
    const file = await retrieveFile(id, user.id, encryptionPassword);
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const parameters: NormalRangeKey[] = [
    "WBC", "RBC", "HGB", "HCT", "MCV", "MCH"
  ]

  const dates = data.map(item => item.Date).reverse()

  if (!encryptionPasswordSetup) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center">
        <input
          type="password"
          value={newEncryptionPassword}
          onChange={(e) => setNewEncryptionPassword(e.target.value)}
          placeholder="Set your encryption password"
          className="mb-4 p-2 border rounded"
        />
        <button
          onClick={handleEncryptionPasswordSetup}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Set Encryption Password
        </button>
        {error && <p className="mt-2 text-red-500">{error}</p>}
      </div>
    );
  }

  if (!isDecrypted) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center">
        <input
          type="password"
          value={encryptionPassword}
          onChange={(e) => setEncryptionPassword(e.target.value)}
          placeholder="Enter encryption password"
          className="mb-4 p-2 border rounded"
        />
        <button
          onClick={handleDecrypt}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Decrypt Data
        </button>
        {error && <p className="mt-2 text-red-500">{error}</p>}
      </div>
    );
  }

  if (loading) return <div className="w-screen h-screen flex items-center justify-center">Loading...</div>
  if (error) return <div className="w-screen h-screen flex items-center justify-center text-red-500">Error: {error}</div>

  const range = normalRanges[selectedParameter][patientType] || (normalRanges[selectedParameter] as any).Adults;
  const unit = normalRanges[selectedParameter].unit;
  const middle = calculateMiddle(range.min, range.max);
  const domain = calculateDomain(data, selectedParameter, range);

  return (
    <div className="w-screen min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row justify-center items-stretch gap-6">
        <Card className="w-full lg:w-1/2 bg-white rounded-lg shadow-lg overflow-hidden flex flex-col">
          <CardHeader className="px-6 py-4">
            <div className="flex justify-between items-center">
              <CardTitle className="text-2xl font-bold">{selectedParameter} Over Time</CardTitle>
              <ParameterDropdown
                selectedParameter={selectedParameter}
                isOpen={isParameterDropdownOpen}
                setIsOpen={setIsParameterDropdownOpen}
                setSelectedParameter={setSelectedParameter}
                parameters={parameters}
              />
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
                    dataKey="Date" 
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    interval="preserveStartEnd"
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
                    labelFormatter={(value) => value}
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
            <div className="mt-4">
            <div className="flex items-center gap-2 font-medium">
                Trending Analysis {calculateTrend(data, selectedParameter) > 0 ? <TrendingUp className="h-5 w-5 text-green-500" /> : <TrendingDown className="h-5 w-5 text-red-500" />}
              </div>
              <div className="text-gray-600">
                Trending {calculateTrend(data, selectedParameter) > 0 ? 'up' : 'down'} by {Math.abs(calculateTrend(data, selectedParameter)).toFixed(1)}% this month
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="w-full lg:w-1/2 bg-white rounded-lg shadow-lg overflow-hidden flex flex-col">
          <CardHeader className="px-6 py-4">
            <div className="flex justify-between items-center">
              <CardTitle className="text-2xl font-bold">Radar Chart</CardTitle>
              <DateDropdown
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                dates={dates}
              />
            </div>
          </CardHeader>
          <CardContent className="px-6 pt-0 pb-6 flex-grow">
            <div className="h-full" style={{ minHeight: '400px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChartComponent 
                  data={data} 
                  selectedDate={selectedDate} 
                  patientType={patientType}
                />
              </ResponsiveContainer>
            </div>
          </CardContent>
          <CardFooter className="px-6 py-4">
            <div className="text-sm">
              <div className="font-medium">Data as of {selectedDate}</div>
              <div className="text-gray-600">Updated regularly</div>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}