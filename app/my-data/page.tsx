'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { getAttachments } from '@/utils/indexedDB';
import { formatDate } from '@/utils/chartUtils';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/lib/components/ui/card";
import { Button } from "@/lib/components/ui/button";
import { CalendarIcon, DownloadIcon } from "lucide-react";
import FileUpload from '@/components/FileUpload';

interface Attachment {
  filename: string;
  data: string;
  uploadDate?: string;
  testDate?: string;
}

export default function MyData() {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isLoaded, userId, getToken } = useAuth();

  const fetchAttachments = async () => {
    try {
      if (!userId) {
        throw new Error("User not authenticated");
      }
      const storedAttachments = await getAttachments();
      const uniqueAttachments = storedAttachments.reduce((acc, current) => {
        const x = acc.find(item => item.filename === current.filename);
        if (!x) {
          return acc.concat([current]);
        } else {
          return acc;
        }
      }, []);

      const attachmentsWithDates = uniqueAttachments.map(att => ({
        ...att,
        uploadDate: formatDate(new Date()),
        testDate: att.testDate ? new Date(att.testDate) : new Date(0)
      }));
      
      const sortedAttachments = attachmentsWithDates.sort((a, b) => b.testDate.getTime() - a.testDate.getTime());
      
      const formattedAttachments = sortedAttachments.map(att => ({
        ...att,
        testDate: att.testDate instanceof Date ? formatDate(att.testDate) : 'Unknown'
      }));
      
      setAttachments(formattedAttachments);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching attachments:", err);
      setError("Failed to load attachments");
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoaded && userId) {
      fetchAttachments();
    } else if (isLoaded && !userId) {
      setError("User not authenticated");
      setLoading(false);
    }
  }, [isLoaded, userId]);

  const handleDownload = async (filename: string, encryptedData: string) => {
    try {
      const token = await getToken();
      const response = await fetch('/api/decrypt-attachment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ encryptedData }),
      });

      if (!response.ok) {
        throw new Error('Failed to decrypt attachment');
      }

      const { data } = await response.json();
      const blob = new Blob([Buffer.from(data, 'base64')], { type: 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading attachment:", err);
      setError("Failed to download attachment");
    }
  };

  if (!isLoaded || loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!userId) return <div>Please sign in to access this page.</div>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">My Data</h1>
      <FileUpload onUploadComplete={fetchAttachments} />
      {attachments.length === 0 ? (
        <p>No attachments found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {attachments.map((attachment, index) => (
            <Card key={index} className="flex flex-col min-h-[200px]">
              <CardHeader className="pb-2 pt-6 px-6">
                <CardTitle className="text-lg">{attachment.filename}</CardTitle>
              </CardHeader>
              <CardContent className="flex-grow px-6">
                <div className="flex flex-col text-sm text-gray-500 mb-2">
                  <div className="flex items-center mb-1">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    <span>Uploaded on: {attachment.uploadDate}</span>
                  </div>
                  <div className="flex items-center">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    <span>Test done on: {attachment.testDate}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="px-6 pb-6">
                <Button 
                  onClick={() => handleDownload(attachment.filename, attachment.data)}
                  className="w-full flex items-center justify-center"
                  variant="outline"
                >
                  <DownloadIcon className="mr-2 h-4 w-4" />
                  <span>Download</span>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}