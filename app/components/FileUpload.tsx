import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from "@/lib/components/ui/button";
import { storeProcessedData, storeAttachments } from '@/utils/indexedDB';
import { getBloodTestResults } from '@/utils/indexedDB';

interface FileUploadProps {
  onFileUpload?: (file: File) => void;
  onUploadComplete: () => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload, onUploadComplete }) => {
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      const formData = new FormData();
      formData.append('file', file);

      try {
        // Fetch existing encrypted data from IndexedDB
        const existingEncryptedData = await getBloodTestResults();
        formData.append('existingData', existingEncryptedData || '');

        const response = await fetch('/api/process-upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Failed to upload file');
        }

        const result = await response.json();

        // Store the new combined encrypted data
        await storeProcessedData(result.bloodTestResults);

        // Store only the new attachments
        await storeAttachments(result.rawAttachments);

        onUploadComplete();
      } catch (error) {
        console.error('Error uploading file:', error);
        // Handle error (e.g., show error message to user)
      }
    }
  }, [onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'application/pdf': ['.pdf'] } });

  return (
    <div className="mb-6">
      <div {...getRootProps()} className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400">
        <input {...getInputProps()} />
        {isDragActive ? (
          <p>Drop the file here ...</p>
        ) : (
          <p>Drag 'n' drop a PDF file here, or click to select a file</p>
        )}
      </div>
      <div className="mt-4">
        <Button {...getRootProps()} variant="outline">
          Select File
        </Button>
      </div>
    </div>
  );
};

export default FileUpload;