import React, { useState } from 'react';
import { X, Plus, CreditCard as Edit2, Trash2, Play, Pause, Calendar, Clock, Zap } from 'lucide-react';
import { useReports, ReportTemplate, UserReport } from '../hooks/useReports';
import { HourOnlyTimePicker } from './HourOnlyTimePicker';

interface ManageReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CreateReportFormData {
  title: string;
  prompt: string;
  schedule_type: 'manual' | 'scheduled';
  schedule_frequency: string;
  schedule_time: string;
  report_template_id?: string;
}

export const ManageReportsModal: React.FC<ManageReportsModalProps> = ({
  isOpen,
  onClose
}) => {
  const {
    templates,
    userReports,
    loading,
    runningReports,
    createReport,
    updateReport,
    deleteReport,
    toggleReportActive,
    runReportNow
  } = useReports();

  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [editingReport, setEditingReport] = useState<UserReport | null>(null);
  const [formData, setFormData] = useState<CreateReportFormData>({
    title: '',
    prompt: '',
    schedule_type: 'scheduled',
    schedule_frequency: 'daily',
    schedule_time: '07:00'
  });

  const resetForm = () => {
    setFormData({
      title: '',
      prompt: '',
      schedule_type: 'scheduled',
      schedule_frequency: 'daily',
      schedule_time: '07:00'
    });
    setSelectedTemplate(null);
    setEditingReport(null);
  };

  const handleClose = () => {
    resetForm();
    setActiveTab('list');
    onClose();
  };

  const handleTemplateSelect = (template: ReportTemplate) => {
    setSelectedTemplate(template);
    setFormData({
      title: template.name,
      prompt: template.prompt_template,
      schedule_type: 'scheduled',
      schedule_frequency: template.default_schedule,
      schedule_time: template.default_time,
      report_template_id: template.id
    });
    setActiveTab('create');
  };

  const handleCreateCustom = () => {
    resetForm();
    setActiveTab('create');
  };

  const handleEditReport = (report: UserReport) => {
    setEditingReport(report);
    setFormData({
      title: report.title,
      prompt: report.prompt,
      schedule_type: report.schedule_type,
      schedule_frequency: report.schedule_frequency,
      schedule_time: report.schedule_time,
      report_template_id: report.report_template_id || undefined
    });
    setActiveTab('create');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.prompt.trim()) return;

    try {
      if (editingReport) {
        // Update existing report
        await updateReport(editingReport.id, formData);
      } else {
        // Create new report
        await createReport(formData);
      }
      
      resetForm();
      setActiveTab('list');
    } catch (error) {
      console.error('Error saving report:', error);
    }
  };

  const handleDeleteReport = async (reportId: string, title: string) => {
    if (window.confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
      await deleteReport(reportId);
    }
  };

  const formatNextRun = (nextRunAt: string | null): string => {
    if (!nextRunAt) return 'Not scheduled';
    
    const date = new Date(nextRunAt);
    const now = new Date();
    
    if (date < now) return 'Overdue';
    
    return date.toLocaleDateString([], { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatLastRun = (lastRunAt: string | null): string => {
    if (!lastRunAt) return 'Never';
    
    const date = new Date(lastRunAt);
    return date.toLocaleDateString([], { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSchedulePreview = (): string => {
    if (formData.schedule_type === 'manual') {
      return 'Manual execution only';
    }
    
    const time = formData.schedule_time;
    const hour = parseInt(time.split(':')[0]);
    const displayTime = hour === 0 ? '12:00 AM' : 
                       hour < 12 ? `${hour}:00 AM` : 
                       hour === 12 ? '12:00 PM' : 
                       `${hour - 12}:00 PM`;
    
    return `This report will run ${formData.schedule_frequency} at ${displayTime} EST`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center space-x-2">
            <Zap className="w-6 h-6 text-blue-500" />
            <h2 className="text-xl font-bold text-white">
              {activeTab === 'list' ? 'Manage Reports' : editingReport ? 'Edit Report' : 'Create New Report'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'list' ? (
            /* Reports List */
            <div className="space-y-6">
              {/* Create New Button */}
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-white">Your Reports</h3>
                <button
                  onClick={handleCreateCustom}
                  className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-105"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create New Report</span>
                </button>
              </div>

              {/* Reports List */}
              {userReports.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400 mb-4">No reports configured yet.</p>
                  
                  {/* Template Quick Start */}
                  <div className="space-y-3">
                    <p className="text-sm text-gray-500">Get started with a template:</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {templates.map((template) => (
                        <button
                          key={template.id}
                          onClick={() => handleTemplateSelect(template)}
                          className="bg-gray-700/50 hover:bg-gray-700 border border-gray-600 rounded-lg p-3 text-left transition-colors group"
                        >
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-lg">{template.icon}</span>
                            <span className="font-medium text-white group-hover:text-blue-300 text-sm">
                              {template.name}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 line-clamp-2">
                            {template.description}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {userReports.map((report) => (
                    <div
                      key={report.id}
                      className="bg-gray-700/50 border border-gray-600 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h4 className="font-medium text-white">{report.title}</h4>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              report.is_active 
                                ? 'bg-green-500/20 text-green-400' 
                                : 'bg-gray-500/20 text-gray-400'
                            }`}>
                              {report.is_active ? 'Active' : 'Paused'}
                            </span>
                            {report.template && (
                              <span className="text-lg" title={report.template.name}>
                                {report.template.icon}
                              </span>
                            )}
                          </div>
                          
                          <p className="text-sm text-gray-400 mb-3 line-clamp-2">
                            {report.prompt}
                          </p>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-gray-500">
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-3 h-3" />
                              <span className="capitalize">
                                {report.schedule_type === 'manual' ? 'Manual' : report.schedule_frequency}
                              </span>
                            </div>
                            {report.schedule_type === 'scheduled' && (
                              <div className="flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>{report.schedule_time} EST</span>
                              </div>
                            )}
                            <div>
                              <span className="text-gray-600">Last run:</span> {formatLastRun(report.last_run_at)}
                            </div>
                            {report.schedule_type === 'scheduled' && (
                              <div>
                                <span className="text-gray-600">Next run:</span> {formatNextRun(report.next_run_at)}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex items-center space-x-2 ml-4">
                          <button
                            onClick={() => !runningReports.has(report.id) && runReportNow(report.id)}
                            disabled={runningReports.has(report.id)}
                            className={`p-2 rounded-lg transition-colors text-white ${
                              runningReports.has(report.id)
                                ? 'bg-purple-600 cursor-not-allowed animate-pulse'
                                : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                            title={runningReports.has(report.id) ? 'Running...' : 'Run now'}
                          >
                            <Play className={`w-4 h-4 ${runningReports.has(report.id) ? 'animate-spin' : ''}`} />
                          </button>
                          
                          <button
                            onClick={() => toggleReportActive(report.id, !report.is_active)}
                            className={`p-2 rounded-lg transition-colors ${
                              report.is_active
                                ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                                : 'bg-green-600 hover:bg-green-700 text-white'
                            }`}
                            title={report.is_active ? 'Pause' : 'Resume'}
                          >
                            {report.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </button>
                          
                          <button
                            onClick={() => handleEditReport(report)}
                            className="p-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          
                          <button
                            onClick={() => handleDeleteReport(report.id, report.title)}
                            className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Create/Edit Form */
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Back Button */}
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
              >
                ← Back to Reports
              </button>

              {/* Template Selection (only for new reports) */}
              {!editingReport && !selectedTemplate && (
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Choose a Template or Create Custom</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {templates.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => handleTemplateSelect(template)}
                        className="bg-gray-700/50 hover:bg-gray-700 border border-gray-600 rounded-lg p-4 text-left transition-colors group"
                      >
                        <div className="flex items-center space-x-3 mb-2">
                          <span className="text-2xl">{template.icon}</span>
                          <h4 className="font-medium text-white group-hover:text-blue-300">
                            {template.name}
                          </h4>
                        </div>
                        <p className="text-sm text-gray-400 mb-3">
                          {template.description}
                        </p>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span className="capitalize">{template.default_schedule}</span>
                          <span>{template.default_time} EST</span>
                        </div>
                      </button>
                    ))}
                  </div>
                  
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={handleCreateCustom}
                      className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
                    >
                      Or create a custom report from scratch
                    </button>
                  </div>
                </div>
              )}

              {/* Form Fields (show when template selected or creating custom) */}
              {(selectedTemplate || editingReport || (!selectedTemplate && activeTab === 'create')) && (
                <>
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

                  {/* Schedule Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Schedule Type
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, schedule_type: 'manual' })}
                        className={`p-3 rounded-lg border transition-colors ${
                          formData.schedule_type === 'manual'
                            ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                            : 'border-gray-600 bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        <div className="font-medium">Manual</div>
                        <div className="text-xs opacity-80">Run on demand only</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, schedule_type: 'scheduled' })}
                        className={`p-3 rounded-lg border transition-colors ${
                          formData.schedule_type === 'scheduled'
                            ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                            : 'border-gray-600 bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        <div className="font-medium">Scheduled</div>
                        <div className="text-xs opacity-80">Run automatically</div>
                      </button>
                    </div>
                  </div>

                  {/* Schedule Configuration (only for scheduled reports) */}
                  {formData.schedule_type === 'scheduled' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Frequency
                        </label>
                        <select
                          value={formData.schedule_frequency}
                          onChange={(e) => setFormData({ ...formData, schedule_frequency: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>

                      <HourOnlyTimePicker
                        value={formData.schedule_time}
                        onChange={(time) => setFormData({ ...formData, schedule_time: time })}
                        label="Schedule Time"
                      />
                    </div>
                  )}

                  {/* Schedule Preview */}
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                    <p className="text-blue-300 text-sm">
                      📅 {getSchedulePreview()}
                    </p>
                  </div>

                  {/* Submit Buttons */}
                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setActiveTab('list')}
                      className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Saving...' : editingReport ? 'Update Report' : 'Create Report'}
                    </button>
                  </div>
                </>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};