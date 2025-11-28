'use client'

import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, FileSpreadsheet } from 'lucide-react'
import { cn, formatFileSize } from '@/lib/utils'

interface FileUploaderProps {
  files: File[]
  onFilesChange: (files: File[]) => void
  maxFiles?: number
  disabled?: boolean
}

export function FileUploader({
  files,
  onFilesChange,
  maxFiles = 10,
  disabled = false,
}: FileUploaderProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (disabled) return
      const newFiles = [...files, ...acceptedFiles].slice(0, maxFiles)
      onFilesChange(newFiles)
    },
    [files, maxFiles, onFilesChange, disabled]
  )

  const removeFile = (index: number) => {
    if (disabled) return
    const newFiles = files.filter((_, i) => i !== index)
    onFilesChange(newFiles)
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv'],
    },
    maxFiles: maxFiles - files.length,
    disabled,
  })

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
          disabled
            ? 'bg-gray-50 border-gray-200 cursor-not-allowed'
            : isDragActive
            ? 'border-primary bg-primary-50 cursor-pointer'
            : 'border-gray-300 hover:border-primary hover:bg-gray-50 cursor-pointer'
        )}
      >
        <input {...getInputProps()} />
        <Upload className={cn('w-10 h-10 mx-auto mb-4', disabled ? 'text-gray-300' : 'text-gray-400')} />
        {isDragActive ? (
          <p className="text-primary font-medium">Suelta los archivos aqui...</p>
        ) : (
          <div>
            <p className={cn('font-medium', disabled ? 'text-gray-400' : 'text-gray-600')}>
              Arrastra archivos CSV aqui o haz clic para seleccionar
            </p>
            <p className="text-sm text-gray-400 mt-1">Maximo {maxFiles} archivos</p>
          </div>
        )}
      </div>

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-dark">{file.name}</p>
                  <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
                </div>
              </div>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="p-1 hover:bg-gray-200 rounded transition"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
