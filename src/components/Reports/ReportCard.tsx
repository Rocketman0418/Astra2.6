import React from 'react';
import { Calendar, Clock, Play, Trash2, ChevronDown, ChevronUp, FileText, BarChart3 } from 'lucide-react';
import { ReportMessage } from '../../types';

interface ReportCardProps {
  message: ReportMessage;
  onCreateVisualization?: (messageId: string, messageText: string) => void;
  onViewVisualization?: (messageId: string) => void;
  onRunReport?: (reportTitle: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  visualizationState?: any;
  isReportRunning?: boolean;
}

const formatMessageText = (text: string): JSX.Element => {
  const lines = text.split('\n');
  const elements: JSX.Element[] = [];

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      elements.push(<br key={`br-${index}`} />);
      return;
    }

    // Handle numbered lists
    const numberedListMatch = trimmedLine.match(/^(\d+)\.\s*\*\*(.*?)\*\*:\s*(.*)$/);
    if (numberedListMatch) {
      const [, number, title, content] = numberedListMatch;
      elements.push(
        <div key={index} className="mb-4">
          <div className="flex items-start space-x-2">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
              {number}
            </span>
            <div className="flex-1">
              <div className="font-bold text-blue-300 mb-1">{title}</div>
              <div className="text-gray-300 leading-relaxed">{content}</div>
            </div>
          </div>
        </div>
      );
      return;
    }

    // Handle bold text
    const boldRegex = /\*\*(.*?)\*\*/g;
    if (boldRegex.test(trimmedLine)) {
      const parts = trimmedLine.split(boldRegex);
      const formattedParts = parts.map((part, partIndex) => {
        if (partIndex % 2 === 1) {
          return <strong key={partIndex} className="font-bold text-blue-300">{part}</strong>;
        }
        return part;
      });
      elements.push(<div key={index} className="mb-2">{formattedParts}</div>);
      return;
    }

    // Handle bullet points
    if (trimmedLine.startsWith('•') || trimmedLine.startsWith('-')) {
      elements.push(
        <div key={index} className="flex items-start space-x-2 mb-2 ml-4">
          <span className="text-blue-400 mt-1">•</span>
          <span className="text-gray-300">{trimmedLine.substring(1).trim()}</span>
        </div>
      );
      return;
    }

    elements.push(<div key={index} className="mb-2 text-gray-300">{trimmedLine}</div>);
  });

  return <div>{elements}</div>;
};

const formatTime = (timestamp: Date): string => {
  return timestamp.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getFrequencyIcon = (frequency: string) => {
  switch (frequency) {
    case 'daily': return '📅';
    case 'weekly': return '📊';
    case 'monthly': return '📈';
    default: return '📋';
  }
};

export const ReportCard: React.FC<ReportCardProps> = ({
  message,
  onCreateVisualization,
  onViewVisualization,
  onRunReport,
  onDeleteMessage,
  visualizationState,
  isReportRunning = false
}) => {
  const [showTextSummary, setShowTextSummary] = React.useState(false);
  const [isVisualizationExpanded, setIsVisualizationExpanded] = React.useState(false);

  if (message.isUser) return null;

  const reportMeta = message.reportMetadata;
  const isManualRun = reportMeta?.is_manual_run;
  const hasVisualization = !!message.visualization_data || visualizationState?.hasVisualization;
  const isGenerating = visualizationState?.isGenerating || reportMeta?.visualization_generating;
  const vizError = reportMeta?.visualization_error;

  const handleDeleteMessage = () => {
    if (window.confirm('Are you sure you want to delete this report instance? This will not affect your scheduled report configuration.')) {
      onDeleteMessage?.(message.id);
    }
  };

  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl border border-gray-700 shadow-lg overflow-hidden">
      {/* Report Header */}
      <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-b border-gray-700 p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-2xl">{getFrequencyIcon(reportMeta?.report_frequency || 'daily')}</span>
              <h3 className="text-lg font-bold text-white">
                {reportMeta?.report_title || 'AI Report'}
              </h3>
              {isManualRun && (
                <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full text-xs font-medium">
                  Manual Run
                </span>
              )}
            </div>

            <div className="flex items-center space-x-4 text-sm text-gray-400">
              <div className="flex items-center space-x-1">
                <Calendar className="w-4 h-4" />
                <span className="capitalize">{reportMeta?.report_frequency || 'Daily'}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Clock className="w-4 h-4" />
                <span>{formatTime(message.timestamp)}</span>
              </div>
              {reportMeta?.report_schedule && (
                <div className="flex items-center space-x-1">
                  <span>Scheduled: {reportMeta.report_schedule} EST</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {onDeleteMessage && (
              <button
                onClick={handleDeleteMessage}
                className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                title="Delete this report instance"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            {onRunReport && reportMeta?.report_title && (
              <button
                onClick={() => !isReportRunning && onRunReport(reportMeta.report_title)}
                disabled={isReportRunning}
                className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isReportRunning
                    ? 'bg-purple-600 cursor-not-allowed animate-pulse'
                    : 'bg-blue-600 hover:bg-blue-700'
                } text-white`}
                title={isReportRunning ? 'Report is running...' : 'Run this report again'}
              >
                <Play className={`w-4 h-4 ${isReportRunning ? 'animate-spin' : ''}`} />
                <span>{isReportRunning ? 'Running...' : 'Run Again'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Report Content */}
      <div className="p-6">
        {/* Error State */}
        {vizError && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-700 rounded-lg text-red-300 text-sm">
            <strong>Visualization failed:</strong> {vizError}
            {onCreateVisualization && message.chatId && (
              <button
                onClick={() => onCreateVisualization(message.chatId!, message.text)}
                className="ml-2 text-red-200 hover:text-red-100 underline"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {/* Generating State */}
        {isGenerating && (
          <div className="text-center py-8">
            <div className="inline-flex items-center space-x-3 px-6 py-4 bg-blue-600/20 border border-blue-500/30 rounded-xl">
              <svg className="animate-spin h-6 w-6 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-white font-medium">Generating...</span>
            </div>
          </div>
        )}

        {/* Show Text Summary View */}
        {showTextSummary && !isGenerating && (
          <div className="space-y-4">
            <div className="prose prose-invert max-w-none">
              {formatMessageText(message.text)}
            </div>

            {/* Show Less Button */}
            <div className="flex justify-center pt-4">
              <button
                onClick={() => setShowTextSummary(false)}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm font-medium"
              >
                <ChevronUp className="w-4 h-4" />
                <span>Show Less</span>
              </button>
            </div>
          </div>
        )}

        {/* Show Visualization Preview/Full View */}
        {!showTextSummary && !isGenerating && hasVisualization && (
          <div className="space-y-4">
            {/* Visualization Preview */}
            <div className={`relative ${isVisualizationExpanded ? '' : 'max-h-96 overflow-hidden'}`}>
              <iframe
                srcDoc={message.visualization_data}
                className="w-full bg-gray-900 rounded-lg border border-gray-700"
                style={{ height: isVisualizationExpanded ? '800px' : '300px' }}
                title="Visualization Preview"
                sandbox="allow-scripts"
              />
              {!isVisualizationExpanded && (
                <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-gray-900 to-transparent pointer-events-none" />
              )}
            </div>

            {/* Expand/Collapse Button */}
            <div className="flex justify-center">
              <button
                onClick={() => setIsVisualizationExpanded(!isVisualizationExpanded)}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm font-medium"
              >
                {isVisualizationExpanded ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    <span>Show Less</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    <span>Show Full Visualization</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Report Footer */}
      <div className="bg-gray-800/50 border-t border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500">
            Generated by Astra Intelligence • {formatTime(message.timestamp)}
          </div>

          <div className="flex items-center space-x-2">
            {/* Toggle between Visualization and Text Summary */}
            {hasVisualization && !isGenerating && (
              <button
                onClick={() => setShowTextSummary(!showTextSummary)}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm font-medium"
              >
                {showTextSummary ? (
                  <>
                    <BarChart3 className="w-4 h-4" />
                    <span>Show Visualization</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    <span>Show Text Summary</span>
                  </>
                )}
              </button>
            )}

            {/* View Full Screen Button */}
            {hasVisualization && !isGenerating && !showTextSummary && onViewVisualization && message.chatId && (
              <button
                onClick={() => onViewVisualization(message.chatId!)}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-all text-sm font-medium"
              >
                <BarChart3 className="w-4 h-4" />
                <span>View Full Screen</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
