import React, { useState } from 'react';
import { FileText, Settings, Calendar, Clock, Play, BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { useReports } from '../hooks/useReports';
import { useVisualization } from '../hooks/useVisualization';
import { ManageReportsModal } from '../components/ManageReportsModal';
import { VisualizationView } from '../components/VisualizationView';

export const ReportsPage: React.FC = () => {
  const {
    reportHistory,
    userReports,
    loading,
    error,
    runningReports,
    runReportNow,
    setError
  } = useReports();

  const {
    generateVisualization,
    showVisualization,
    hideVisualization,
    getVisualization,
    currentVisualization,
    setVisualizationContent
  } = useVisualization();

  const [showManageModal, setShowManageModal] = useState(false);
  const [expandedReports, setExpandedReports] = useState<Set<string>>(new Set());
  const [visualizationStates, setVisualizationStates] = useState<Record<string, any>>({});

  const toggleExpanded = (reportId: string) => {
    setExpandedReports(prev => {
      const newSet = new Set(prev);
      if (newSet.has(reportId)) {
        newSet.delete(reportId);
      } else {
        newSet.add(reportId);
      }
      return newSet;
    });
  };

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString([], { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getExecutionTypeLabel = (metadata: any): string => {
    if (metadata?.is_manual_run) {
      return 'Manual Run';
    }
    return 'Scheduled';
  };

  const getExecutionTypeColor = (metadata: any): string => {
    if (metadata?.is_manual_run) {
      return 'bg-blue-500/20 text-blue-300';
    }
    return 'bg-green-500/20 text-green-300';
  };

  // Handle visualization creation
  const handleCreateVisualization = async (messageId: string, messageContent: string) => {
    console.log('🎯 Reports: Starting visualization generation for messageId:', messageId);
    
    setVisualizationStates(prev => ({
      ...prev,
      [messageId]: {
        isGenerating: true,
        content: null,
        hasVisualization: false
      }
    }));

    try {
      await generateVisualization(messageId, messageContent);
      
      setVisualizationStates(prev => ({
        ...prev,
        [messageId]: {
          isGenerating: false,
          content: 'generated',
          hasVisualization: true
        }
      }));
      
      console.log('✅ Reports: Visualization generation completed for message:', messageId);
    } catch (error) {
      console.error('❌ Reports: Error during visualization generation:', error);
      setVisualizationStates(prev => ({
        ...prev,
        [messageId]: {
          isGenerating: false,
          content: null,
          hasVisualization: false
        }
      }));
    }
  };

  // Handle viewing visualization
  const handleViewVisualization = (messageId: string) => {
    console.log('👁️ Reports: handleViewVisualization called for messageId:', messageId);
    
    // Check local state first
    const localState = visualizationStates[messageId];
    if (localState?.content && localState.content !== 'generated') {
      console.log('📊 Reports: Using local state visualization data');
      setVisualizationContent(messageId, localState.content);
      showVisualization(messageId);
      return;
    }
    
    // Check hook state for visualization content
    const hookVisualization = getVisualization(messageId);
    if (hookVisualization?.content) {
      console.log('📊 Reports: Using hook visualization data');
      showVisualization(messageId);
      return;
    }
    
    console.log('❌ Reports: No visualization data found for message:', messageId);
  };

  // Show visualization view if one is currently active
  if (currentVisualization) {
    const visualizationContent = getVisualization(currentVisualization)?.content;
    
    if (visualizationContent && visualizationContent !== 'generated') {
      return (
        <VisualizationView
          content={visualizationContent}
          onBack={hideVisualization}
        />
      );
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Astra Reports</h1>
              <p className="text-gray-400 text-sm">AI insights delivered on schedule</p>
            </div>
          </div>
          
          <button
            onClick={() => setShowManageModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-all duration-200 transform hover:scale-105"
          >
            <Settings className="w-4 h-4" />
            <span>Manage Reports</span>
            {userReports.filter(r => r.is_active).length > 0 && (
              <span className="bg-white/20 px-2 py-1 rounded-full text-xs">
                {userReports.filter(r => r.is_active).length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-6xl mx-auto">
          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
              <p className="text-red-400">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-red-300 hover:text-red-200 text-sm mt-2"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Loading State */}
          {loading && reportHistory.length === 0 && (
            <div className="flex justify-center items-center py-12">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-400">Loading reports...</p>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && reportHistory.length === 0 && (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <FileText className="w-10 h-10 text-blue-500" />
              </div>
              
              <h2 className="text-2xl font-bold text-white mb-4">Welcome to AI Reports</h2>
              <p className="text-gray-400 mb-8 max-w-md mx-auto">
                Create automated reports that deliver insights on your schedule. 
                Get daily news summaries, weekly market analysis, or custom research reports.
              </p>
              
              <button
                onClick={() => setShowManageModal(true)}
                className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-105"
              >
                <Settings className="w-5 h-5" />
                <span>Create Your First Report</span>
              </button>
              
              {/* Example Reports */}
              <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
                  <div className="text-2xl mb-3">📰</div>
                  <h3 className="font-medium text-white mb-2">Daily News</h3>
                  <p className="text-sm text-gray-400">Stay updated with AI and tech news every morning</p>
                </div>
                
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
                  <div className="text-2xl mb-3">✅</div>
                  <h3 className="font-medium text-white mb-2">Action Items</h3>
                  <p className="text-sm text-gray-400">Weekly insights on tasks and priorities</p>
                </div>
                
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
                  <div className="text-2xl mb-3">💰</div>
                  <h3 className="font-medium text-white mb-2">Financial Analysis</h3>
                  <p className="text-sm text-gray-400">Monthly deep dives into financial performance</p>
                </div>
              </div>
            </div>
          )}

          {/* Report History */}
          {reportHistory.length > 0 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Report History</h2>
                <p className="text-sm text-gray-400">{reportHistory.length} reports generated</p>
              </div>

              {reportHistory.map((report) => {
                const isExpanded = expandedReports.has(report.id);
                const isLongContent = report.message.length > 500;
                const previewText = isLongContent && !isExpanded 
                  ? report.message.substring(0, 500) + '...'
                  : report.message;

                return (
                  <div
                    key={report.id}
                    className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl border border-gray-700 shadow-lg overflow-hidden"
                  >
                    {/* Report Header */}
                    <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-b border-gray-700 p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="text-2xl">📊</span>
                            <h3 className="text-lg font-bold text-white">
                              {report.metadata?.report_title || 'AI Report'}
                            </h3>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              getExecutionTypeColor(report.metadata)
                            }`}>
                              {getExecutionTypeLabel(report.metadata)}
                            </span>
                          </div>
                          
                          <div className="flex items-center space-x-4 text-sm text-gray-400">
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-4 h-4" />
                              <span className="capitalize">{report.metadata?.report_frequency || 'One-time'}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Clock className="w-4 h-4" />
                              <span>{formatTime(report.created_at)}</span>
                            </div>
                            {report.metadata?.report_schedule && (
                              <div className="flex items-center space-x-1">
                                <span>Scheduled: {report.metadata.report_schedule} EST</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Report Content */}
                    <div className="p-6">
                      <div className="prose prose-invert max-w-none">
                        <div className="whitespace-pre-wrap text-gray-300 leading-relaxed">
                          {previewText}
                        </div>
                      </div>
                      
                      {/* Show More/Less Button */}
                      {isLongContent && (
                        <button
                          onClick={() => toggleExpanded(report.id)}
                          className="flex items-center space-x-1 mt-4 text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-4 h-4" />
                              <span>Show Less</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-4 h-4" />
                              <span>Show More</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Report Footer */}
                    <div className="bg-gray-800/50 border-t border-gray-700 p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-gray-500">
                          Generated by Astra Intelligence • {formatTime(report.created_at)}
                        </div>
                        
                        {/* Visualization Button */}
                        <div className="flex items-center space-x-2">
                          {visualizationStates[report.id]?.hasVisualization || visualizationStates[report.id]?.content ? (
                            <button
                              onClick={() => handleViewVisualization(report.id)}
                              className="flex items-center space-x-2 bg-gradient-to-r from-green-500 via-blue-500 to-purple-500 bg-[length:200%_100%] animate-[gradient_3s_ease-in-out_infinite] text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 transform hover:scale-105 shadow-lg"
                            >
                              <BarChart3 className="w-4 h-4" />
                              <span>View Visualization</span>
                            </button>
                          ) : visualizationStates[report.id]?.isGenerating ? (
                            <button
                              disabled
                              className="flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-purple-600 animate-pulse cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium"
                            >
                              <BarChart3 className="w-4 h-4 animate-spin" />
                              <span>Generating...</span>
                              <div className="flex space-x-1 ml-1">
                                <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                              </div>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleCreateVisualization(report.id, report.message)}
                              className="flex items-center space-x-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 transform hover:scale-105"
                            >
                              <BarChart3 className="w-4 h-4" />
                              <span>Create Visualization</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Manage Reports Modal */}
      <ManageReportsModal
        isOpen={showManageModal}
        onClose={() => setShowManageModal(false)}
      />
    </div>
  );
};