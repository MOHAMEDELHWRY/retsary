"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, X, FileImage, FileText, Eye } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export interface AttachmentFile {
  id: string;
  name: string;
  type: 'image' | 'pdf';
  url: string;
  uploadedAt: Date;
  file?: File; // For newly uploaded files
}

interface AttachmentUploadProps {
  attachments: AttachmentFile[];
  onAttachmentsChange: (attachments: AttachmentFile[]) => void;
  maxFiles?: number;
  maxSize?: number; // in MB
}

export function AttachmentUpload({ 
  attachments, 
  onAttachmentsChange, 
  maxFiles = 5,
  maxSize = 10 
}: AttachmentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    const newAttachments: AttachmentFile[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Check file size
      if (file.size > maxSize * 1024 * 1024) {
        toast({
          title: "حجم الملف كبير جداً",
          description: `الملف ${file.name} يتجاوز الحد الأقصى ${maxSize}MB`,
          variant: "destructive",
        });
        continue;
      }

      // Check file type
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf';
      
      if (!isImage && !isPdf) {
        toast({
          title: "نوع ملف غير مدعوم",
          description: `الملف ${file.name} يجب أن يكون صورة أو PDF`,
          variant: "destructive",
        });
        continue;
      }

      // Check max files limit
      if (attachments.length + newAttachments.length >= maxFiles) {
        toast({
          title: "تم الوصول للحد الأقصى",
          description: `يمكنك رفع ${maxFiles} ملفات كحد أقصى`,
          variant: "destructive",
        });
        break;
      }

      const fileUrl = URL.createObjectURL(file);
      const attachment: AttachmentFile = {
        id: `temp-${Date.now()}-${i}`,
        name: file.name,
        type: isImage ? 'image' : 'pdf',
        url: fileUrl,
        uploadedAt: new Date(),
        file,
      };

      newAttachments.push(attachment);
    }

    if (newAttachments.length > 0) {
      onAttachmentsChange([...attachments, ...newAttachments]);
      toast({
        title: "تم رفع الملفات",
        description: `تم رفع ${newAttachments.length} ملف بنجاح`,
      });
    }
  };

  const handleRemoveAttachment = (id: string) => {
    const attachment = attachments.find(a => a.id === id);
    if (attachment?.url.startsWith('blob:')) {
      URL.revokeObjectURL(attachment.url);
    }
    onAttachmentsChange(attachments.filter(a => a.id !== id));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleViewFile = (attachment: AttachmentFile) => {
    window.open(attachment.url, '_blank');
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-4 sm:p-6 text-center transition-colors ${
          isDragging 
            ? 'border-primary bg-primary/10' 
            : 'border-muted-foreground/25 hover:border-muted-foreground/50'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Upload className="mx-auto h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground mb-4" />
        <div className="text-base sm:text-lg font-medium mb-2">اسحب الملفات هنا أو انقر للاختيار</div>
        <div className="text-xs sm:text-sm text-muted-foreground mb-4">
          يمكنك رفع الصور (JPG, PNG, GIF) أو ملفات PDF
          <br />
          الحد الأقصى: {maxSize}MB لكل ملف، {maxFiles} ملفات إجمالي
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          className="text-sm w-full sm:w-auto"
        >
          <Upload className="h-4 w-4 mr-2" />
          اختيار الملفات
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf"
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />
      </div>

      {/* Attachments List */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">الملفات المرفقة ({attachments.length})</h4>
          <div className="grid gap-2">
            {attachments.map((attachment) => (
              <Card key={attachment.id} className="p-2 sm:p-3">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2 sm:space-x-3 space-x-reverse min-w-0 flex-1">
                      {attachment.type === 'image' ? (
                        <FileImage className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500 flex-shrink-0" />
                      ) : (
                        <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-red-500 flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs sm:text-sm font-medium truncate">{attachment.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {attachment.type === 'image' ? 'صورة' : 'ملف PDF'}
                          {attachment.file && ` • ${(attachment.file.size / 1024 / 1024).toFixed(1)}MB`}
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs flex-shrink-0">
                        {attachment.type === 'image' ? 'صورة' : 'PDF'}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-1 sm:space-x-2 space-x-reverse flex-shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleViewFile(attachment)}
                        className="h-7 w-7 sm:h-8 sm:w-8"
                      >
                        <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveAttachment(attachment.id)}
                        className="h-7 w-7 sm:h-8 sm:w-8 text-destructive hover:text-destructive"
                      >
                        <X className="h-3 w-3 sm:h-4 sm:w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
