import React, { useState, useEffect } from 'react';
import { Plus, Settings, FileText, Zap, Calendar, BarChart3 } from 'lucide-react';
import { useReportsContext } from '../../contexts/ReportsContext';
import { useVisualization } from '../../hooks/useVisualization';
import { ReportCard } from './ReportCard';
import { CreateReportModal } from '../Reports/CreateReportModal';
import { VisualizationView } from '../VisualizationView';
import { ManageReportsModal } from '../ManageReportsModal';
import { supabase } from '../../lib/supabase';

export const ReportsView: React.FC = () => {
  const {
    reportMessages,
    userReports,
    loading: isLoading,
    error,
    runningReports,
    runReportNow,
    createReport,
    updateReport,
    deleteReport,
    checkScheduledReports,
    setError,
    deleteReportMessage
  } = useReportsContext();

  const {
    generateVisualization,
    showVisualization,
    hideVisualization,
    getVisualization,
    currentVisualization,
    setVisualizationContent
  } = useVisualization();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [visualizationStates, setVisualizationStates] = useState<Record<string, any>>({});

  // Initialize visualization states from database when messages load
  useEffect(() => {
    const newStates: Record<string, any> = {};

    reportMessages.forEach(message => {
      const messageId = message.chatId || message.id;
      const metadata = message.reportMetadata || {};

      // If visualization is generating according to database, set that state
      if (metadata.visualization_generating) {
        console.log('📊 ReportsView: Found generating visualization in DB for message:', messageId);
        newStates[messageId] = {
          isGenerating: true,
          content: null,
          hasVisualization: false
        };
      }
    });

    // Only update if we found generating visualizations
    if (Object.keys(newStates).length > 0) {
      console.log('📊 ReportsView: Initializing visualization states from DB:', newStates);
      setVisualizationStates(prev => ({ ...prev, ...newStates }));
    }
  }, [reportMessages]);

  // Auto-generate visualizations for all reports
  useEffect(() => {
    reportMessages.forEach(message => {
      const messageId = message.chatId || message.id;
      const metadata = message.reportMetadata || {};

      // Check if this message needs auto-visualization
      const needsAutoVisualization =
        !message.visualization_data &&
        !metadata.visualization_generating &&
        !metadata.visualization_error &&
        !visualizationStates[messageId]?.isGenerating;

      if (needsAutoVisualization) {
        console.log(`🚀 Auto-generating visualization for message:`, messageId);
        handleCreateVisualization(messageId, message.text);
      }
    });
  }, [reportMessages, visualizationStates]);

  // Set up scheduler to check for reports every minute
  useEffect(() => {
    const interval = setInterval(() => {
      checkScheduledReports();
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [checkScheduledReports]);

  // Polling mechanism: Check for visualization completion every 3 seconds
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      for (const message of reportMessages) {
        const messageId = message.chatId || message.id;
        const metadata = message.reportMetadata || {};
        const state = visualizationStates[messageId];

        // If we think it's generating, check if it actually completed in the database
        if (state?.isGenerating || metadata.visualization_generating) {
          console.log('🔄 Polling: Checking if visualization completed for message:', messageId);

          // Check if visualization_data exists - if so, the visualization is done
          if (message.visualization_data) {
            console.log('✅ Polling: Found completed visualization, clearing database flag');

            // Clear the visualization_generating flag in the database
            try {
              const { visualization_generating, visualization_error, ...cleanMetadata } = metadata;
              await supabase
                .from('astra_chats')
                .update({
                  metadata: cleanMetadata
                })
                .eq('id', messageId);
              console.log('✅ Polling: Cleared visualization_generating flag in database');
            } catch (error) {
              console.error('❌ Polling: Error clearing flag:', error);
            }

            // Update local state
            setVisualizationStates(prev => ({
              ...prev,
              [messageId]: {
                isGenerating: false,
                content: message.visualization_data,
                hasVisualization: true
              }
            }));
          }
        }
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [reportMessages, visualizationStates]);

  // Handle visualization creation
  const handleCreateVisualization = async (messageId: string, messageContent: string) => {
    console.log(`🎯 Reports: Starting visualization generation for messageId:`, messageId);

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

      console.log(`✅ Reports: Visualization generation completed for message:`, messageId);
    } catch (error) {
      console.error(`❌ Reports: Error during visualization generation:`, error);
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
    
    // Find the message to get visualization data
    const message = reportMessages.find(m => m.chatId === messageId || m.id === messageId);
    
    if (message?.visualization_data) {
      console.log('📊 Reports: Using message visualization_data directly');
      setVisualizationContent(messageId, message.visualization_data);
      showVisualization(messageId);
      return;
    }
    
    // Check local state
    const localState = visualizationStates[messageId];
    if (localState?.content) {
      console.log('📊 Reports: Using local state visualization data');
      if (localState.content !== 'generated') {
        setVisualizationContent(messageId, localState.content);
      }
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

  // Handle deleting a report message instance
  const handleDeleteReportMessage = async (messageId: string) => {
    try {
      await deleteReportMessage(messageId);
    } catch (error) {
      console.error('Error deleting report message:', error);
      setError('Failed to delete report. Please try again.');
    }
  };

  // Handle running a report again
  const handleRunReport = (reportTitle: string) => {
    const config = userReports.find(c => c.title === reportTitle);
    if (config) {
      runReportNow(config.id); // Manual run
    }
  };

  // Show visualization view if one is currently active
  if (currentVisualization) {
    const message = reportMessages.find(m => m.chatId === currentVisualization || m.id === currentVisualization);
    const visualizationContent = message?.visualization_data || getVisualization(currentVisualization)?.content;
    
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
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowManageModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span>Manage</span>
            </button>

            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-all duration-200 transform hover:scale-105"
            >
              <Plus className="w-4 h-4" />
              <span>New Report</span>
            </button>
          </div>
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
          {isLoading && reportMessages.length === 0 && (
            <div className="flex justify-center items-center py-12">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-400">Loading reports...</p>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && reportMessages.length === 0 && (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Zap className="w-10 h-10 text-blue-500" />
              </div>
              
              <h2 className="text-2xl font-bold text-white mb-4">Welcome to AI Reports</h2>
              <p className="text-gray-400 mb-8 max-w-md mx-auto">
                Create automated reports that deliver insights on your schedule. 
                Get daily news summaries, weekly market analysis, or custom research reports.
              </p>
              
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-105"
              >
                <Plus className="w-5 h-5" />
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
                  <div className="text-2xl mb-3">📊</div>
                  <h3 className="font-medium text-white mb-2">Market Analysis</h3>
                  <p className="text-sm text-gray-400">Weekly insights on market trends and opportunities</p>
                </div>
                
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
                  <div className="text-2xl mb-3">🔍</div>
                  <h3 className="font-medium text-white mb-2">Custom Research</h3>
                  <p className="text-sm text-gray-400">Monthly deep dives into topics that matter to you</p>
                </div>
              </div>
            </div>
          )}

          {/* Report Cards */}
          {reportMessages.length > 0 && (
            <div className="space-y-6">
              {reportMessages.map((message) => {
                const messageId = message.chatId || message.id;

                // Compute visualization state - check database first, then local state
                let visualizationState = visualizationStates[messageId];

                // If no local state, check database metadata for generating status
                // reportMetadata is the chat.metadata field from database
                if (!visualizationState) {
                  const metadata = message.reportMetadata || {};

                  if (metadata.visualization_generating) {
                    visualizationState = {
                      isGenerating: true,
                      content: null,
                      hasVisualization: false
                    };
                  } else if (message.visualization_data) {
                    // If visualization_data exists in database, use that
                    visualizationState = {
                      isGenerating: false,
                      content: message.visualization_data,
                      hasVisualization: true
                    };
                  }
                }

                return (
                  <ReportCard
                    key={message.id}
                    message={message}
                    onCreateVisualization={handleCreateVisualization}
                    onViewVisualization={handleViewVisualization}
                    onRunReport={handleRunReport}
                    onDeleteMessage={handleDeleteReportMessage}
                    visualizationState={visualizationState}
                    isReportRunning={message.reportMetadata?.report_title ? runningReports.has(
                      userReports.find(c => c.title === message.reportMetadata?.report_title)?.id || ''
                    ) : false}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <CreateReportModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreateReport={createReport}
      />
      
      <ManageReportsModal
        isOpen={showManageModal}
        onClose={() => setShowManageModal(false)}
      />
    </div>
  );
};