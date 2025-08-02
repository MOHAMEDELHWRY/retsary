"use client"

import * as React from "react"
import { useState } from "react"
import { Upload } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./dialog"
import { Button } from "./button"
import { Progress } from "./progress"
import { uploadFile } from "@/lib/utils"

interface UploadDialogProps {
  onUploadComplete?: (url: string) => void
  acceptTypes?: string // e.g. "image/*,.pdf"
  maxSize?: number // in bytes
  uploadPath?: string // path in firebase storage
  children?: React.ReactNode // custom trigger button
}

export function UploadDialog({ 
  onUploadComplete, 
  acceptTypes = "image/*",
  maxSize = 5 * 1024 * 1024, // 5MB default
  uploadPath = "uploads",
  children
}: UploadDialogProps) {
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
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90))
      }, 500)

      const path = `${uploadPath}/${file.name}`
      const downloadURL = await uploadFile(file, path)

      clearInterval(progressInterval)
      setProgress(100)
      
      if (onUploadComplete) {
        onUploadComplete(downloadURL)
      }

      // Close dialog after 1 second of showing 100% progress
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
        {children || (
          <Button variant="outline">
            <Upload className="ml-2 h-4 w-4" />
            رفع ملف
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>رفع ملف</DialogTitle>
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
