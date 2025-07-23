import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Eye, 
  FileText, 
  BarChart3, 
  Calendar, 
  User, 
  CheckCircle, 
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Database
} from 'lucide-react';

const DataPreview = ({ data, onConfirm, onBack }) => {
  const [activeTab, setActiveTab] = useState('overview');

  if (!data) return null;

  const { dataStructure, preview, fileName, totalRecords, fullData } = data;
  const { columns, columnTypes, hasDateColumns, hasStatusColumns, hasUserColumns } = dataStructure;
  
  // Use totalRecords if available, otherwise fall back to preview length
  const actualTotalRows = totalRecords || fullData?.length || preview?.length || 0;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Eye },
    { id: 'sample', label: 'Sample Data', icon: FileText },
    { id: 'structure', label: 'Structure', icon: Database }
  ];

  const insights = [
    {
      icon: BarChart3,
      label: 'Total Rows',
      value: actualTotalRows.toLocaleString(),
      status: actualTotalRows > 100 ? 'good' : actualTotalRows > 10 ? 'warning' : 'error',
      description: actualTotalRows > 100 ? 'Good sample size for analysis' : 'Small dataset may limit insights'
    },
    {
      icon: Database,
      label: 'Columns',
      value: columns.length,
      status: columns.length > 3 ? 'good' : 'warning',
      description: columns.length > 3 ? 'Rich data structure' : 'Consider more data dimensions'
    },
    {
      icon: Calendar,
      label: 'Time Data',
      value: hasDateColumns ? 'Detected' : 'None',
      status: hasDateColumns ? 'good' : 'neutral',
      description: hasDateColumns ? 'Trend analysis possible' : 'No temporal analysis available'
    },
    {
      icon: User,
      label: 'User Data',
      value: hasUserColumns ? 'Detected' : 'None',
      status: hasUserColumns ? 'good' : 'neutral',
      description: hasUserColumns ? 'Performance analysis possible' : 'No user-based analysis'
    }
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'good': return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'warning': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'error': return 'text-red-400 bg-red-400/10 border-red-400/20';
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'good': return CheckCircle;
      case 'warning': return AlertTriangle;
      case 'error': return AlertTriangle;
      default: return Database;
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-white mb-2">Data Analysis Ready</h3>
              <p className="text-gray-300">
                Your data has been successfully processed and is ready for AI analysis.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {insights.map((insight, index) => {
                const Icon = insight.icon;
                const StatusIcon = getStatusIcon(insight.status);
                
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`
                      p-6 rounded-xl border backdrop-blur-sm
                      ${getStatusColor(insight.status)}
                    `}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <Icon className="h-8 w-8" />
                      <StatusIcon className="h-5 w-5" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-baseline justify-between">
                        <h4 className="font-semibold">{insight.label}</h4>
                        <span className="text-2xl font-bold">{insight.value}</span>
                      </div>
                      <p className="text-sm opacity-80">{insight.description}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="bg-gray-900/50 rounded-xl p-6">
              <h4 className="text-lg font-semibold text-white mb-4">Analysis Capabilities</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                  <span className="text-gray-300">Performance Metrics</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                  <span className="text-gray-300">Trend Analysis</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                  <span className="text-gray-300">Problem Identification</span>
                </div>
                {hasDateColumns && (
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-400" />
                    <span className="text-gray-300">Time-based Insights</span>
                  </div>
                )}
                {hasUserColumns && (
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-400" />
                    <span className="text-gray-300">User Performance</span>
                  </div>
                )}
                {hasStatusColumns && (
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-400" />
                    <span className="text-gray-300">Status Analysis</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'sample':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-bold text-white mb-2">Sample Data Preview</h3>
              <p className="text-gray-300">First 5 rows of your dataset</p>
            </div>

            <div className="bg-gray-900/50 rounded-xl p-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    {columns.map((col, index) => (
                      <th key={index} className="text-left py-3 px-4 font-semibold text-gray-300">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 5).map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b border-gray-800 hover:bg-gray-800/30">
                      {columns.map((col, colIndex) => (
                        <td key={colIndex} className="py-3 px-4 text-gray-300">
                          {row[col] !== null && row[col] !== undefined 
                            ? String(row[col]) 
                            : <span className="text-gray-500 italic">null</span>
                          }
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="text-center text-gray-400">
              Showing 5 of {actualTotalRows.toLocaleString()} total rows
            </div>
          </div>
        );

      case 'structure':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-bold text-white mb-2">Data Structure Analysis</h3>
              <p className="text-gray-300">Column types and data distribution</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {columns.map((col, index) => {
                const type = columnTypes[col];
                const getTypeColor = (type) => {
                  switch (type) {
                    case 'string': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
                    case 'number': return 'bg-green-500/20 text-green-300 border-green-500/30';
                    case 'boolean': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
                    case 'mixed': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
                    default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
                  }
                };

                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`
                      p-4 rounded-lg border backdrop-blur-sm
                      ${getTypeColor(type)}
                    `}
                  >
                    <div className="font-medium text-white mb-1">{col}</div>
                    <div className="text-sm capitalize">{type}</div>
                  </motion.div>
                );
              })}
            </div>

            <div className="bg-gray-900/50 rounded-xl p-6">
              <h4 className="text-lg font-semibold text-white mb-4">Data Quality Assessment</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Column Consistency</span>
                  <span className="text-green-400 font-semibold">Good</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Data Volume</span>
                  <span className={`font-semibold ${actualTotalRows > 100 ? 'text-green-400' : 'text-yellow-400'}`}>
                    {actualTotalRows > 100 ? 'Excellent' : 'Adequate'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Analysis Readiness</span>
                  <span className="text-green-400 font-semibold">Ready</span>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-4">
          Data Preview: {fileName}
        </h2>
        <p className="text-gray-300 text-lg">
          Review your data before generating AI-powered insights
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

      {/* Action Buttons */}
      <div className="flex justify-between pt-8">
        <button
          onClick={onBack}
          className="flex items-center space-x-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Upload</span>
        </button>
        
        <button
          onClick={onConfirm}
          className="flex items-center space-x-2 px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg transition-all duration-200 font-semibold"
        >
          <span>Continue to Analysis</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default DataPreview;