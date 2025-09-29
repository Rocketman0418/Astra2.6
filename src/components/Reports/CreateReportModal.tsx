import React, { useState } from 'react';
import { X, Calendar, Clock, FileText, Zap } from 'lucide-react';
import { ReportConfig } from '../../types';

interface CreateReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateReport: (reportData: Omit<ReportConfig, 'id' | 'created_at' | 'next_execution'>) => void;
}

const REPORT_TEMPLATES = [
  {
    title: 'Daily News Brief',
    prompt: 'Provide a brief summary of the AI News and Education emails from the last 24 hours. Focus on the top 3 impacts to our business, and a recommendation of actions for each one. Include a section on new features, upgrades or AI tools that we might consider using and for what areas of the business. Format the response with clear sections and bullet points.',
    frequency: 'daily' as const,
    schedule_time: '07:00',
    start_date: undefined
  },
  {
    title: 'Weekly Action Items',
    prompt: 'From our most recent L10 meeting, please provide a detailed list of action items that I need to complete or focus on this week.',
    frequency: 'weekly' as const,
    schedule_time: '09:00',
    start_date: 'monday'
  },
  {
    title: 'Monthly Financial Analysis',
    prompt: 'Summarize the company financials and generate a cash-flow statement and burn-rate analysis',
    frequency: 'monthly' as const,
    schedule_time: '09:00',
    start_date: '1'
  }
];

export const CreateReportModal: React.FC<CreateReportModalProps> = ({
  isOpen,
  onClose,
  onCreateReport
}) => {
  // Helper function to get ordinal suffix
  const getOrdinalSuffix = (num: number): string => {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
  };

  const [formData, setFormData] = useState({
    title: '',
    prompt: '',
    frequency: 'daily' as 'daily' | 'weekly' | 'monthly',
    schedule_time: '07:00',
    start_date: '',
    enabled: true
  });

  const [activeTab, setActiveTab] = useState<'custom' | 'template'>('template');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.prompt.trim()) return;
    
    // Validate start_date for weekly/monthly frequencies
    if ((formData.frequency === 'weekly' || formData.frequency === 'monthly') && !formData.start_date) {
      return; // Form validation will show required field error
    }

    onCreateReport(formData);
    onClose();
    
    // Reset form
    setFormData({
      title: '',
      prompt: '',
      frequency: 'daily',
      schedule_time: '07:00',
      start_date: '',
      enabled: true
    });
    setActiveTab('template');
  };

  const handleTemplateSelect = (template: typeof REPORT_TEMPLATES[0]) => {
    setFormData({
      ...formData,
      title: template.title,
      prompt: template.prompt,
      frequency: template.frequency,
      schedule_time: template.schedule_time,
      start_date: template.start_date || ''
    });
    setActiveTab('custom');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center space-x-2">
            <Zap className="w-6 h-6 text-blue-500" />
            <h2 className="text-xl font-bold text-white">Create New Report</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setActiveTab('template')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'template'
                ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-500/10'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Templates
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'custom'
                ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-500/10'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Custom Report
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'template' ? (
            <div className="space-y-4">
              <p className="text-gray-300 text-sm mb-4">
                Choose from our pre-built report templates to get started quickly:
              </p>
              
              {REPORT_TEMPLATES.map((template, index) => (
                <div
                  key={index}
                  onClick={() => handleTemplateSelect(template)}
                  className="bg-gray-700/50 hover:bg-gray-700 border border-gray-600 rounded-lg p-4 cursor-pointer transition-colors group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-white group-hover:text-blue-300 transition-colors">
                      {template.title}
                    </h3>
                    <div className="flex items-center space-x-2 text-xs text-gray-400">
                      <Calendar className="w-3 h-3" />
                      <span className="capitalize">{template.frequency}</span>
                      <Clock className="w-3 h-3 ml-2" />
                      <span>{template.schedule_time}</span>
                      {template.start_date && (
                        <>
                          <span className="ml-2">•</span>
                          <span className="capitalize">
                            {template.frequency === 'weekly' ? template.start_date : `${template.start_date}${getOrdinalSuffix(parseInt(template.start_date))}`}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-400 line-clamp-2">
                    {template.prompt}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Report Title */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Report Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Daily AI News Summary"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  required
                />
              </div>

              {/* Report Prompt */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Report Prompt
                </label>
                <textarea
                  value={formData.prompt}
                  onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                  placeholder="Describe what you want Astra to analyze and report on..."
                  rows={4}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none resize-none"
                  required
                />
              </div>

              {/* Frequency and Schedule */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Frequency
                  </label>
                  <select
                    value={formData.frequency}
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value as any })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                {/* Start Date - only show for Weekly and Monthly */}
                {(formData.frequency === 'weekly' || formData.frequency === 'monthly') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {formData.frequency === 'weekly' ? 'Start Day' : 'Start Date'}
                    </label>
                    {formData.frequency === 'weekly' ? (
                      <select
                        value={formData.start_date}
                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                        required
                      >
                        <option value="">Select day</option>
                        <option value="monday">Monday</option>
                        <option value="tuesday">Tuesday</option>
                        <option value="wednesday">Wednesday</option>
                        <option value="thursday">Thursday</option>
                        <option value="friday">Friday</option>
                        <option value="saturday">Saturday</option>
                        <option value="sunday">Sunday</option>
                      </select>
                    ) : (
                      <select
                        value={formData.start_date}
                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                        required
                      >
                        <option value="">Select date</option>
                        {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                          <option key={day} value={day.toString()}>{day}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Schedule Time (EST)
                  </label>
                  <input
                    type="time"
                    value={formData.schedule_time}
                    onChange={(e) => setFormData({ ...formData, schedule_time: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-105"
                >
                  Create Report
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};