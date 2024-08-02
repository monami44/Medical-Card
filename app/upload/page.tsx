"use client"
import React, { useState, useEffect } from "react"
import { useUser } from "@clerk/nextjs"
import { storeFile, getAllFiles, retrieveFile, fetchEmailAttachments } from '@/utils/fileUtils'
import { EncryptedFile } from "@/types/EncryptedFile"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/lib/components/ui/card"
import { Input } from "@/lib/components/ui/input"
import { Button } from "@/lib/components/ui/button"
import { Calendar, Upload as UploadIcon, Download } from "lucide-react"
import { fetchData, decryptBloodTestResult } from '@/utils/chartUtils'
import { BloodTestResult } from '@/types/BloodTestResult'
import { getStoredKey } from '@/utils/encryption'

export default function Upload() {
  const [bloodTestResults, setBloodTestResults] = useState<BloodTestResult[]>([])
  const [encryptedFiles, setEncryptedFiles] = useState<EncryptedFile[]>([])
  const [encryptionPassword, setEncryptionPassword] = useState<string>('')
  const { user } = useUser()
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifiedEncryptionPassword, setVerifiedEncryptionPassword] = useState<string>('');

  console.log("Current encrypted files:", encryptedFiles.length);

  useEffect(() => {
    if (user && verifiedEncryptionPassword) {
      loadFiles();
    }
  }, [user, verifiedEncryptionPassword])

  const loadFiles = async () => {
    if (user && verifiedEncryptionPassword) {
      try {
        setIsLoading(true);
        let emailAttachments: EncryptedFile[] = [];
        try {
          emailAttachments = await fetchEmailAttachments(user.id, verifiedEncryptionPassword);
        } catch (error) {
          console.error("Error fetching email attachments:", error);
        }
        const manuallyUploadedFiles = await getAllFiles();
        const allFiles = [...manuallyUploadedFiles, ...emailAttachments];
        setEncryptedFiles(allFiles);
        const results = await fetchData(user.id, verifiedEncryptionPassword);
        setBloodTestResults(results);
        console.log("Loaded files:", allFiles.length);
      } catch (error) {
        console.error("Error loading files:", error);
        setError("Failed to load files. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && user) {
      try {
        await storeFile(file, user.id, verifiedEncryptionPassword)
        await loadFiles()
      } catch (error) {
        console.error("Error uploading file:", error)
        // Handle error (e.g., show error message to user)
      }
    }
  }

  const handleFileDownload = async (fileId: number | string) => {
    if (!user) return;
    try {
      const downloadedFile = await retrieveFile(fileId, user.id, verifiedEncryptionPassword);
      
      const url = URL.createObjectURL(new Blob([downloadedFile], { type: 'application/octet-stream' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadedFile.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading file:", error);
      // Handle error (e.g., show error message to user)
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown Date';
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? dateString : date.toISOString().split('T')[0];
  }

  const verifyEncryptionPassword = async (password: string) => {
    if (!user) return;
    try {
      // Attempt to get the stored key using the provided password
      await getStoredKey(user.id, password);
      
      // If getStoredKey doesn't throw an error, the password is correct
      setVerifiedEncryptionPassword(password);
      loadFiles();
    } catch (error) {
      console.error("Error verifying encryption password:", error);
      setError("Invalid encryption password. Please try again.");
    }
  };

  return (
    <div className="container mx-auto p-4">
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Upload Files</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col space-y-4">
            <Input
              type="password"
              value={encryptionPassword}
              onChange={(e) => setEncryptionPassword(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  verifyEncryptionPassword(encryptionPassword);
                }
              }}
              placeholder="Enter encryption password and press Enter"
            />
            <div className="flex items-center space-x-2">
              <Input
                type="file"
                onChange={handleFileUpload}
                disabled={!verifiedEncryptionPassword}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <Button size="icon" disabled={isLoading || !verifiedEncryptionPassword}>
                <UploadIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {isLoading && <div className="text-center">Loading files...</div>}
      {error && <div className="text-center text-red-500">{error}</div>}
      
      {verifiedEncryptionPassword && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {encryptedFiles.map((file) => {
            const bloodTestResult = bloodTestResults.find(r => formatDate(r.Date) === formatDate(file.testDate));
            return (
              <Card key={file.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold truncate">{file.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow">
                  <div className="flex items-center text-sm text-gray-500 mb-2">
                    <Calendar className="mr-2 h-4 w-4" />
                    <span>Test Date: {formatDate(file.testDate)}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-500 mb-2">
                    <Calendar className="mr-2 h-4 w-4" />
                    <span>Upload Date: {formatDate(file.uploadDate)}</span>
                  </div>
                  <div className="text-sm text-gray-500 mb-2">
                    <span>Source: {file.source === 'email' ? 'Email Attachment' : 'Manual Upload'}</span>
                  </div>
                  {bloodTestResult && (
                    <div className="text-sm mt-2">
                      <p>WBC: {bloodTestResult.WBC}</p>
                      <p>RBC: {bloodTestResult.RBC}</p>
                      <p>HGB: {bloodTestResult.HGB}</p>
                      <p>HCT: {bloodTestResult.HCT}</p>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex flex-col space-y-2">
                  <Button variant="outline" onClick={() => handleFileDownload(file.id!)} className="w-full">
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  )
}