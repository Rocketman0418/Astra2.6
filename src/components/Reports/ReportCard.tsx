import React from 'react';
import { Calendar, Clock, Play, BarChart3, Trash2 } from 'lucide-react';
import { ReportMessage } from '../../types';
import { VisualizationButton } from '../VisualizationButton';

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
  const [isExpanded, setIsExpanded] = React.useState(false);
  
  if (message.isUser) return null; // Don't show user prompts in report cards

  const reportMeta = message.reportMetadata;
  const isManualRun = reportMeta?.is_manual_run;
  
  // Extract summary (first paragraph or first 300 characters)
  const fullText = message.text;
  const firstParagraphEnd = fullText.indexOf('\n\n');
  const summaryText = firstParagraphEnd > 0 && firstParagraphEnd < 300 
    ? fullText.substring(0, firstParagraphEnd)
    : fullText.substring(0, 300);
  
  const needsExpansion = fullText.length > summaryText.length;
  const displayText = isExpanded ? fullText : summaryText;
  
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
                {isReportRunning && (
                  <div className="flex space-x-1 ml-1">
                    <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Report Content */}
      <div className="p-6">
        <div className="prose prose-invert max-w-none">
          {formatMessageText(displayText + (needsExpansion && !isExpanded ? '...' : ''))}
        </div>
        
        {/* Show More/Less Button */}
        {needsExpansion && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-4 text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
          >
            {isExpanded ? 'Show Less' : 'Show More'}
          </button>
        )}
      </div>

      {/* Report Footer */}
      <div className="bg-gray-800/50 border-t border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500">
            Generated by Astra Intelligence • {formatTime(message.timestamp)}
          </div>
          
          {/* Visualization Button */}
          {message.chatId && onCreateVisualization && onViewVisualization && (
            <VisualizationButton
              messageId={message.chatId}
              messageText={message.text}
              onCreateVisualization={onCreateVisualization}
              onViewVisualization={onViewVisualization}
              visualizationState={visualizationState}
            />
          )}
        </div>
      </div>
    </div>
  );
};