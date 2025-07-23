import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart3, 
  FileText, 
  Presentation, 
  TrendingUp, 
  Users, 
  Clock, 
  ArrowLeft, 
  Sparkles,
  Loader2,
  CheckCircle
} from 'lucide-react';

const ReportGeneration = ({ data, onGenerate, isGenerating, onBack }) => {
  const [selectedReport, setSelectedReport] = useState('');

  const reportTypes = [
    {
      id: 'executive',
      title: 'Executive Summary',
      icon: TrendingUp,
      description: 'High-level insights and key metrics for leadership',
      features: [
        'Key performance indicators',
        'Critical findings and trends',
        'Strategic recommendations',
        'Business impact assessment'
      ],
      audience: 'C-level executives, managers',
      duration: '2-3 minutes',
      style: 'Clean, metric-focused design',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      id: 'detailed',
      title: 'Detailed Analysis',
      icon: BarChart3,
      description: 'Comprehensive operational report with deep insights',
      features: [
        'Volume and trend analysis',
        'Performance metrics breakdown',
        'Problem area identification',
        'Process improvement opportunities'
      ],
      audience: 'Operations teams, analysts',
      duration: '3-5 minutes',
      style: 'Dark theme, data-rich layout',
      color: 'from-purple-500 to-pink-500'
    },
    {
      id: 'presentation',
      title: 'Presentation Report',
      icon: Presentation,
      description: 'Stakeholder-ready slides with visual storytelling',
      features: [
        'Slide-based format',
        'Visual metrics and charts',
        'Clear narrative flow',
        'Action-oriented conclusions'
      ],
      audience: 'Stakeholders, board members',
      duration: '5-7 minutes',
      style: 'Professional presentation design',
      color: 'from-green-500 to-teal-500'
    }
  ];

  const handleGenerateReport = () => {
    if (selectedReport) {
      onGenerate(selectedReport);
    }
  };

  if (!data) return null;

  const { dataStructure, totalRecords, fullData } = data;
  const actualTotalRows = totalRecords || fullData?.length || dataStructure.totalRows || 0;

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-4">
          Choose Your Report Type
        </h2>
        <p className="text-gray-300 text-lg max-w-3xl mx-auto">
          Select the type of analysis report that best fits your needs. 
          Claude AI will generate actionable insights tailored to your audience.
        </p>
      </div>

      {/* Data Summary */}
              <div className="bg-gray-900/50 rounded-xl p-6">
        <div className="flex items-center justify-center space-x-8 text-center">
          <div>
            <div className="text-2xl font-bold text-purple-400">
              {actualTotalRows.toLocaleString()}
            </div>
            <div className="text-gray-300 text-sm">Records</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-400">
              {dataStructure.columns.length}
            </div>
            <div className="text-gray-300 text-sm">Columns</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-400">
              {dataStructure.hasDateColumns ? '✓' : '–'}
            </div>
            <div className="text-gray-300 text-sm">Time Data</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-400">
              {dataStructure.hasUserColumns ? '✓' : '–'}
            </div>
            <div className="text-gray-300 text-sm">User Data</div>
          </div>
        </div>
      </div>

      {/* Report Type Selection */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {reportTypes.map((report, index) => {
          const Icon = report.icon;
          const isSelected = selectedReport === report.id;
          
          return (
            <motion.div
              key={report.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`
                relative cursor-pointer rounded-2xl p-6 border-2 transition-all duration-300
                ${isSelected
                  ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20'
                  : 'border-gray-700 bg-gray-800/50 hover:border-gray-600 hover:bg-gray-800/70'
                }
              `}
              onClick={() => setSelectedReport(report.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Selection Indicator */}
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-4 right-4"
                >
                  <CheckCircle className="h-6 w-6 text-purple-400" />
                </motion.div>
              )}

              {/* Header */}
              <div className="flex items-center space-x-3 mb-4">
                <div className={`
                  p-3 rounded-xl bg-gradient-to-r ${report.color}
                `}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{report.title}</h3>
                </div>
              </div>

              {/* Description */}
              <p className="text-gray-300 mb-6">{report.description}</p>

              {/* Features */}
              <div className="space-y-3 mb-6">
                <h4 className="font-semibold text-white text-sm">Key Features:</h4>
                <ul className="space-y-2">
                  {report.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start space-x-2 text-sm text-gray-300">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-2 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Metadata */}
              <div className="space-y-2 text-xs text-gray-400">
                <div className="flex items-center space-x-2">
                  <Users className="h-3 w-3" />
                  <span>{report.audience}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="h-3 w-3" />
                  <span>~{report.duration} to generate</span>
                </div>
                <div className="flex items-center space-x-2">
                  <FileText className="h-3 w-3" />
                  <span>{report.style}</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* AI Analysis Preview */}
      {selectedReport && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 rounded-xl p-6 border border-purple-500/20"
        >
          <div className="flex items-center space-x-3 mb-4">
            <Sparkles className="h-6 w-6 text-purple-400" />
            <h4 className="text-lg font-semibold text-white">AI Analysis Preview</h4>
          </div>
          <div className="text-gray-300">
            Claude AI will analyze your {actualTotalRows.toLocaleString()} records across {dataStructure.columns.length} data dimensions to generate:
            <ul className="mt-3 space-y-1 ml-4">
              <li>• Performance trends and patterns</li>
              <li>• Critical insights and problem areas</li>
              <li>• Actionable recommendations</li>
              <li>• Professional visual presentation</li>
            </ul>
          </div>
        </motion.div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between pt-8">
        <button
          onClick={onBack}
          disabled={isGenerating}
          className="flex items-center space-x-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Preview</span>
        </button>
        
        <button
          onClick={handleGenerateReport}
          disabled={!selectedReport || isGenerating}
          className={`
            flex items-center space-x-2 px-8 py-3 rounded-lg font-semibold transition-all duration-200
            ${selectedReport && !isGenerating
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white'
              : 'bg-gray-600 text-gray-300 cursor-not-allowed'
            }
          `}
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Generating Report...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              <span>Generate Report</span>
            </>
          )}
        </button>
      </div>

      {/* Loading State */}
      {isGenerating && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="bg-gray-900/50 rounded-xl p-8">
            <div className="flex justify-center items-center space-x-3 mb-4">
              <Loader2 className="h-8 w-8 text-purple-500 animate-spin" />
              <span className="text-xl font-semibold text-white">
                Claude AI is analyzing your data...
              </span>
            </div>
            <p className="text-gray-300 mb-6">
              This may take a few moments as we process {actualTotalRows.toLocaleString()} records 
              and generate actionable insights.
            </p>
            <div className="bg-gray-700 rounded-full h-2 max-w-md mx-auto">
              <motion.div
                className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 3, repeat: Infinity }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default ReportGeneration;