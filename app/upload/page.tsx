"use client"

import React, { useState, useEffect } from "react"
import { useUser } from "@clerk/nextjs"
import { storeFile, getAllFiles } from '@/utils/fileUtils'
import { EncryptedFile } from "@/types/EncryptedFile"

export default function Upload() {
  const [files, setFiles] = useState<EncryptedFile[]>([])
  const [encryptionPassword, setEncryptionPassword] = useState<string>('')
  const { user } = useUser()

  useEffect(() => {
    loadFiles()
  }, [])

  const loadFiles = async () => {
    const allFiles = await getAllFiles()
    setFiles(allFiles)
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && user) {
      await storeFile(file, user.id, encryptionPassword)
      await loadFiles()
    }
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Upload Files</h1>
      <input
        type="password"
        value={encryptionPassword}
        onChange={(e) => setEncryptionPassword(e.target.value)}
        placeholder="Enter encryption password"
        className="mb-4 p-2 border rounded"
      />
      <input
        type="file"
        onChange={handleFileUpload}
        className="mb-4"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {files.map((file) => (
          <div key={file.id} className="border p-4 rounded">
            <p>{file.name}</p>
          </div>
        ))}
      </div>
    </div>
  )
}