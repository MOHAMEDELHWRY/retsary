"use client"

import * as React from "react"
import { useState } from "react"
import { Upload } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./dialog"
import { Button } from "./button"
import { Progress } from "./progress"
import { uploadFile } from "@/lib/utils"
import { getFunctions, httpsCallable } from 'firebase/functions'
import { app } from "@/lib/firebase"

interface FtpUploadDialogProps {
  onUploadComplete?: (url: string) => void
  acceptTypes?: string
  maxSize?: number
  ftpConfig: {
    host: string
    port: number
    user: string
    password: string
    secure: boolean
  }
  remotePath: string
}

export function FtpUploadDialog({
  onUploadComplete,
  acceptTypes = "*/*",
  maxSize = 100 * 1024 * 1024, // 100MB default
  ftpConfig,
  remotePath
}: FtpUploadDialogProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Check file size
    if (file.size > maxSize) {
      setError(`File size must be less than ${maxSize / (1024 * 1024)}MB`)
      return
    }

    // Preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => setPreview(e.target?.result as string)
      reader.readAsDataURL(file)
    }

    setError(null)
    setIsUploading(true)
    setProgress(0)

    try {
      // First upload to Firebase Storage
      setProgress(20)
      const path = `ftp-temp/${file.name}`
      const downloadURL = await uploadFile(file, path)
      
      setProgress(50)

      // Then transfer to FTP server
      const functions = getFunctions(app)
      type FtpUploadPayload = {
        fileUrl: string;
        remotePath: string;
        ftpConfig: {
          host: string;
          port: number;
          user: string;
          password: string;
          secure: boolean;
        };
      };
      type FtpUploadResult = { path: string; url?: string };
      const ftpUpload = httpsCallable<FtpUploadPayload, FtpUploadResult>(functions, 'ftpUpload')
      
      const result = await ftpUpload({
        fileUrl: downloadURL,
        remotePath: `${remotePath}/${file.name}`,
        ftpConfig
      })

      setProgress(100)
      
  if (onUploadComplete) onUploadComplete(result.data.path)

      // Close dialog after 1 second
      setTimeout(() => {
        setOpen(false)
        setIsUploading(false)
        setProgress(0)
        setPreview(null)
      }, 1000)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setIsUploading(false)
      setProgress(0)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="ml-2 h-4 w-4" />
          رفع ملف FTP
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>FTP رفع ملف</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {error && (
            <div className="bg-red-50 text-red-500 p-2 rounded text-sm">
              {error}
            </div>
          )}

          {preview && (
            <div className="relative aspect-square w-full max-w-sm mx-auto">
              <img
                src={preview}
                alt="Preview"
                className="rounded-lg object-cover w-full h-full"
              />
            </div>
          )}

          {isUploading && (
            <Progress value={progress} className="w-full" />
          )}

          <div className="flex justify-center">
            <label className="cursor-pointer">
              <input
                type="file"
                className="hidden"
                onChange={handleFileSelect}
                accept={acceptTypes}
                disabled={isUploading}
              />
              <div className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md">
                {isUploading ? 'جاري الرفع...' : 'اختر ملف'}
              </div>
            </label>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
