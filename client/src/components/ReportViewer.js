import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Download, 
  Eye, 
  FileText, 
  CheckCircle, 
  ArrowLeft, 
  RefreshCw,
  ExternalLink,
  Copy,
  Share
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const ReportViewer = ({ report, onReset, onBack }) => {
  const [activeTab, setActiveTab] = useState('preview');
  const [isDownloading, setIsDownloading] = useState(false);

  if (!report) return null;

  const { reportId, analysis, downloadUrl } = report;

  const tabs = [
    { id: 'preview', label: 'Report Preview', icon: Eye },
    { id: 'analysis', label: 'AI Analysis', icon: FileText }
  ];

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch(`${downloadUrl}?download=true`);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `analysis-report-${reportId}.html`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Report downloaded successfully!');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download report');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Link copied to clipboard!');
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Analysis Report',
        text: 'Check out this AI-generated analysis report',
        url: window.location.href
      });
    } else {
      handleCopyLink();
    }
  };

  const parseAnalysis = () => {
    try {
      return JSON.parse(analysis);
    } catch (error) {
      return { summary: analysis };
    }
  };

  const parsedAnalysis = parseAnalysis();

  const renderPreviewTab = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-white mb-2">Report Generated Successfully</h3>
        <p className="text-gray-300">
          Your AI-powered analysis is ready for download and sharing
        </p>
      </div>

      {/* Success Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-500/10 border border-green-500/20 rounded-xl p-6 text-center"
        >
          <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
          <h4 className="text-lg font-semibold text-white mb-2">Analysis Complete</h4>
          <p className="text-green-300 text-sm">Claude AI has processed your data</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-6 text-center"
        >
          <FileText className="h-12 w-12 text-blue-400 mx-auto mb-4" />
          <h4 className="text-lg font-semibold text-white mb-2">Report Ready</h4>
          <p className="text-blue-300 text-sm">Professional HTML format</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-6 text-center"
        >
          <Download className="h-12 w-12 text-purple-400 mx-auto mb-4" />
          <h4 className="text-lg font-semibold text-white mb-2">Ready to Share</h4>
          <p className="text-purple-300 text-sm">Download and distribute</p>
        </motion.div>
      </div>

      {/* Report Summary */}
      {parsedAnalysis.title && (
        <div className="bg-gray-900/50 rounded-xl p-6">
          <h4 className="text-lg font-semibold text-white mb-4">Report Summary</h4>
          <div className="space-y-4">
            <div>
              <h5 className="font-medium text-purple-300 mb-2">{parsedAnalysis.title}</h5>
              <p className="text-gray-300">{parsedAnalysis.summary}</p>
            </div>
            
            {parsedAnalysis.keyMetrics && (
              <div>
                <h5 className="font-medium text-purple-300 mb-2">Key Findings</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {parsedAnalysis.keyMetrics.slice(0, 4).map((metric, index) => (
                    <div key={index} className="bg-gray-800/50 rounded-lg p-3">
                      <div className="text-lg font-bold text-white">{metric.value}</div>
                      <div className="text-sm text-gray-300">{metric.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 disabled:opacity-50 text-white rounded-lg transition-all duration-200 font-semibold"
        >
          {isDownloading ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Downloading...</span>
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              <span>Download Report</span>
            </>
          )}
        </button>

        <a
          href={`http://localhost:5000${downloadUrl}?download=false`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold"
        >
          <ExternalLink className="h-4 w-4" />
          <span>Open in Browser</span>
        </a>

        <button
          onClick={handleDownload}
          className="flex items-center justify-center space-x-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-semibold"
        >
          <Share className="h-4 w-4" />
          <span>Share Report</span>
        </button>
      </div>
    </div>
  );

  const renderAnalysisTab = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-white mb-2">AI Analysis Details</h3>
        <p className="text-gray-300">
          Raw insights and recommendations from Claude AI
        </p>
      </div>

      <div className="bg-gray-900/50 rounded-xl p-6">
        <div className="space-y-6">
          {/* Key Metrics */}
          {parsedAnalysis.keyMetrics && (
            <div>
              <h4 className="text-lg font-semibold text-purple-300 mb-4">Key Metrics</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {parsedAnalysis.keyMetrics.map((metric, index) => (
                  <div key={index} className="bg-gray-800/50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-white mb-1">{metric.value}</div>
                    <div className="text-sm text-gray-300 mb-2">{metric.label}</div>
                    {metric.trend && (
                      <div className={`text-xs px-2 py-1 rounded-full inline-block ${
                        metric.trend === 'up' ? 'bg-green-500/20 text-green-300' :
                        metric.trend === 'down' ? 'bg-red-500/20 text-red-300' :
                        'bg-gray-500/20 text-gray-300'
                      }`}>
                        {metric.trend}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Critical Findings */}
          {parsedAnalysis.criticalFindings && (
            <div>
              <h4 className="text-lg font-semibold text-purple-300 mb-4">Critical Findings</h4>
              <div className="space-y-3">
                {parsedAnalysis.criticalFindings.map((finding, index) => (
                  <div key={index} className="bg-gray-800/50 rounded-lg p-4 border-l-4 border-yellow-500">
                    <h5 className="font-semibold text-white mb-2">{finding.finding}</h5>
                    <p className="text-gray-300 text-sm mb-2">{finding.impact}</p>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      finding.priority === 'high' ? 'bg-red-500/20 text-red-300' :
                      finding.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
                      'bg-green-500/20 text-green-300'
                    }`}>
                      {finding.priority} priority
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {parsedAnalysis.recommendations && (
            <div>
              <h4 className="text-lg font-semibold text-purple-300 mb-4">Recommendations</h4>
              <div className="space-y-3">
                {parsedAnalysis.recommendations.map((rec, index) => (
                  <div key={index} className="bg-gray-800/50 rounded-lg p-4 border-l-4 border-blue-500">
                    <h5 className="font-semibold text-white mb-2">{rec.action}</h5>
                    <div className="flex items-center space-x-4 text-sm text-gray-300">
                      <span>Timeline: {rec.timeline}</span>
                      <span>•</span>
                      <span>Impact: {rec.impact}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Raw Analysis (fallback) */}
          {!parsedAnalysis.keyMetrics && !parsedAnalysis.criticalFindings && (
            <div>
              <h4 className="text-lg font-semibold text-purple-300 mb-4">Analysis Output</h4>
              <div className="bg-gray-800/50 rounded-lg p-4 font-mono text-sm text-gray-300 whitespace-pre-wrap max-h-96 overflow-y-auto">
                {analysis}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'preview':
        return renderPreviewTab();
      case 'analysis':
        return renderAnalysisTab();
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="inline-flex items-center justify-center w-16 h-16 bg-green-500 rounded-full mb-4"
        >
          <CheckCircle className="h-8 w-8 text-white" />
        </motion.div>
        <h2 className="text-3xl font-bold text-white mb-4">
          Report Generated Successfully!
        </h2>
        <p className="text-gray-300 text-lg">
          Your AI-powered analysis is complete and ready for use
        </p>
      </div>

      {/* Tabs */}
      <div className="flex justify-center">
        <div className="bg-gray-900/50 rounded-xl p-1 flex space-x-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all duration-200
                  ${activeTab === tab.id
                    ? 'bg-purple-500 text-white shadow-lg'
                    : 'text-gray-300 hover:text-white hover:bg-gray-700'
                  }
                `}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {renderTabContent()}
      </motion.div>

      {/* Navigation */}
      <div className="flex justify-between pt-8">
        <button
          onClick={onBack}
          className="flex items-center space-x-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Generation</span>
        </button>
        
        <button
          onClick={onReset}
          className="flex items-center space-x-2 px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg transition-all duration-200 font-semibold"
        >
          <RefreshCw className="h-4 w-4" />
          <span>New Analysis</span>
        </button>
      </div>
    </div>
  );
};

export default ReportViewer;