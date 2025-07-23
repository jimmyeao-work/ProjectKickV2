import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster, toast } from 'react-hot-toast';
import { 
  Upload, 
  FileText, 
  BarChart3, 
  TrendingUp, 
  Download, 
  Loader2,
  CheckCircle,
  AlertCircle,
  Eye,
  Sparkles
} from 'lucide-react';
import FileUpload from './components/FileUpload';
import DataPreview from './components/DataPreview';
import ReportGeneration from './components/ReportGeneration';
import ReportViewer from './components/ReportViewer';
import './App.css';

const steps = [
  { id: 'upload', title: 'Upload CSV', icon: Upload, description: 'Upload your data file' },
  { id: 'preview', title: 'Preview Data', icon: Eye, description: 'Review data structure' },
  { id: 'generate', title: 'Generate Report', icon: Sparkles, description: 'AI-powered analysis' },
  { id: 'view', title: 'View Results', icon: BarChart3, description: 'Interactive reports' }
];

function App() {
  const [currentStep, setCurrentStep] = useState('upload');
  const [uploadedData, setUploadedData] = useState(null);
  const [generatedReport, setGeneratedReport] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleFileUpload = useCallback((data) => {
    setUploadedData(data);
    setCurrentStep('preview');
    toast.success('File uploaded successfully!');
  }, []);

  const handleDataConfirm = useCallback(() => {
    setCurrentStep('generate');
  }, []);

  const handleReportGenerate = useCallback(async (reportType) => {
    setIsGenerating(true);
    try {
      // Use fullData if available, otherwise fall back to preview
      const dataToAnalyze = uploadedData.fullData || uploadedData.preview;
      
      console.log(`Generating report with ${dataToAnalyze.length} records`);

      const response = await fetch('/api/generate-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: dataToAnalyze, // Send complete dataset
          reportType,
          fileName: uploadedData.fileName
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate report');
      }

      const result = await response.json();
      setGeneratedReport(result);
      setCurrentStep('view');
      toast.success('Report generated successfully!');
    } catch (error) {
      console.error('Report generation error:', error);
      toast.error('Failed to generate report. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [uploadedData]);

  const handleReset = useCallback(() => {
    setCurrentStep('upload');
    setUploadedData(null);
    setGeneratedReport(null);
    setIsGenerating(false);
  }, []);

  const renderStepContent = () => {
    switch (currentStep) {
      case 'upload':
        return (
          <FileUpload 
            onFileUpload={handleFileUpload}
            isLoading={false}
          />
        );
      case 'preview':
        return (
          <DataPreview 
            data={uploadedData}
            onConfirm={handleDataConfirm}
            onBack={() => setCurrentStep('upload')}
          />
        );
      case 'generate':
        return (
          <ReportGeneration 
            data={uploadedData}
            onGenerate={handleReportGenerate}
            isGenerating={isGenerating}
            onBack={() => setCurrentStep('preview')}
          />
        );
      case 'view':
        return (
          <ReportViewer 
            report={generatedReport}
            onReset={handleReset}
            onBack={() => setCurrentStep('generate')}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1f2937',
            color: '#f3f4f6',
            border: '1px solid #374151'
          }
        }}
      />
      
      {/* Header */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-900/50 backdrop-blur-xl border-b border-gray-700/50"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
                <TrendingUp className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Claude Analytics</h1>
                <p className="text-gray-300 text-sm">AI-Powered Data Analysis Platform</p>
              </div>
            </div>
            
            {uploadedData && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={handleReset}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                New Analysis
              </motion.button>
            )}
          </div>
        </div>
      </motion.header>

      {/* Progress Steps */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center space-x-8 mb-12">
          {steps.map((step, index) => {
            const isActive = step.id === currentStep;
            const isCompleted = steps.findIndex(s => s.id === currentStep) > index;
            const Icon = step.icon;

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex flex-col items-center space-y-2"
              >
                <div className={`
                  p-3 rounded-full border-2 transition-all duration-300
                  ${isActive 
                    ? 'bg-purple-500 border-purple-500 text-white' 
                    : isCompleted 
                      ? 'bg-green-500 border-green-500 text-white'
                      : 'bg-gray-700 border-gray-600 text-gray-300'
                  }
                `}>
                  {isCompleted ? (
                    <CheckCircle className="h-6 w-6" />
                  ) : (
                    <Icon className="h-6 w-6" />
                  )}
                </div>
                <div className="text-center">
                  <p className={`font-medium ${isActive ? 'text-white' : 'text-gray-300'}`}>
                    {step.title}
                  </p>
                  <p className="text-sm text-gray-400">{step.description}</p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Main Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-8"
          >
            {renderStepContent()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Loading Overlay */}
      <AnimatePresence>
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="bg-gray-800 rounded-2xl p-8 text-center max-w-md mx-4"
            >
              <div className="flex justify-center mb-4">
                <Loader2 className="h-12 w-12 text-purple-500 animate-spin" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Generating Your Report
              </h3>
              <p className="text-gray-300">
                Claude AI is analyzing your data and creating insights...
              </p>
              <div className="mt-6 bg-gray-700 rounded-full h-2">
                <motion.div
                  className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;