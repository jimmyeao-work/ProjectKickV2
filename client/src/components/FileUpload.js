import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion } from 'framer-motion';
import { Upload, FileText, AlertCircle, CheckCircle, X } from 'lucide-react';
import { toast } from 'react-hot-toast';

const FileUpload = ({ onFileUpload, isLoading }) => {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragActive, setIsDragActive] = useState(false);

  const processFile = async (file) => {
    try {
      setUploadProgress(10);
      
      const formData = new FormData();
      formData.append('csvFile', file);

      setUploadProgress(30);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      setUploadProgress(70);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      setUploadProgress(100);

      setTimeout(() => {
        onFileUpload(result);
        setUploadProgress(0);
      }, 500);

    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload file');
      setUploadProgress(0);
    }
  };

  const onDrop = useCallback(async (acceptedFiles, rejectedFiles) => {
    setIsDragActive(false);

    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      if (rejection.errors.some(e => e.code === 'file-too-large')) {
        toast.error('File is too large. Maximum size is 10MB.');
      } else if (rejection.errors.some(e => e.code === 'file-invalid-type')) {
        toast.error('Invalid file type. Please upload a CSV file.');
      } else {
        toast.error('File upload failed. Please try again.');
      }
      return;
    }

    if (acceptedFiles.length > 0) {
      await processFile(acceptedFiles[0]);
    }
  }, [onFileUpload]);

  const { getRootProps, getInputProps, isDragActive: dropzoneActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/csv': ['.csv']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false)
  });

  const requirements = [
    { text: 'CSV format only', icon: FileText },
    { text: 'Maximum 10MB file size', icon: AlertCircle },
    { text: 'Column headers required', icon: CheckCircle }
  ];

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-4">
          Upload Your Data File
        </h2>
        <p className="text-gray-300 text-lg max-w-2xl mx-auto">
          Upload a CSV file to begin your AI-powered analysis. Claude will analyze your data 
          and generate actionable insights and professional reports.
        </p>
      </div>

      {/* Upload Area */}
      <motion.div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer
          transition-all duration-300 ease-in-out
          ${dropzoneActive || isDragActive
            ? 'border-purple-400 bg-purple-500/10 scale-105'
            : 'border-gray-600 hover:border-gray-500 hover:bg-gray-800/30'
          }
        `}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <input {...getInputProps()} />
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="flex justify-center">
            <motion.div
              className={`
                p-4 rounded-full transition-colors duration-300
                ${dropzoneActive || isDragActive
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-700 text-gray-300'
                }
              `}
              animate={{ 
                rotate: dropzoneActive ? 360 : 0,
                scale: dropzoneActive ? 1.1 : 1 
              }}
              transition={{ duration: 0.3 }}
            >
              <Upload className="h-12 w-12" />
            </motion.div>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-white mb-2">
              {dropzoneActive ? 'Drop your file here!' : 'Choose your CSV file'}
            </h3>
            <p className="text-gray-400">
              Drag and drop your file here, or click to browse
            </p>
          </div>

          {uploadProgress > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="max-w-md mx-auto"
            >
              <div className="flex items-center justify-between text-sm text-gray-300 mb-2">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="bg-gray-700 rounded-full h-2">
                <motion.div
                  className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </motion.div>
          )}
        </motion.div>
      </motion.div>

      {/* Requirements */}
      <div className="bg-gray-900/50 rounded-xl p-6">
        <h4 className="text-lg font-semibold text-white mb-4">File Requirements</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {requirements.map((req, index) => {
            const Icon = req.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center space-x-3 text-gray-300"
              >
                <Icon className="h-5 w-5 text-green-400 flex-shrink-0" />
                <span>{req.text}</span>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Example Data Format */}
      <div className="bg-gray-900/50 rounded-xl p-6">
        <h4 className="text-lg font-semibold text-white mb-4">Example Data Format</h4>
        <div className="bg-gray-800 rounded-lg p-4 font-mono text-sm overflow-x-auto">
          <div className="text-gray-300">
            <div className="text-green-400">Date,Category,Agent,Status,Priority</div>
            <div>2025-01-15,Support,John Smith,Resolved,High</div>
            <div>2025-01-16,Access,Jane Doe,Open,Medium</div>
            <div>2025-01-17,Hardware,Bob Johnson,In Progress,Low</div>
          </div>
        </div>
        <p className="text-gray-400 text-sm mt-3">
          Ensure your CSV has clear column headers and consistent data formatting for best results.
        </p>
      </div>
    </div>
  );
};

export default FileUpload;