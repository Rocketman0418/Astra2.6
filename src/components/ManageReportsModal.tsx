import React, { useState } from 'react';
import { X, Plus, Settings, Play, Pause, CreditCard as Edit2, Trash2, Calendar, Clock, Zap } from 'lucide-react';
import { useReports, ReportTemplate, UserReport } from '../hooks/useReports';
import { HourOnlyTimePicker } from './HourOnlyTimePicker';

interface ManageReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ModalView = 'list' | 'create' | 'edit';
type CreateStep = 'template' | 'configure' | 'review';

export const ManageReportsModal: React.FC<ManageReportsModalProps> = ({
  isOpen,
  onClose
}) => {
  const { 
    templates, 
    userReports, 
    loading, 
    error, 
    createReport, 
    updateReport, 
    deleteReport, 
    toggleReportActive, 
    runReportNow,
    runningReports
  } = useReports();

  const [currentView, setCurrentView] = useState<ModalView>('list');
  const [createStep, setCreateStep] = useState<CreateStep>('template');
  const [editingReport, setEditingReport] = useState<UserReport | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    prompt: '',
    schedule_type: 'scheduled' as 'manual' | 'scheduled',
    schedule_frequency: 'daily',
    schedule_time: '07:00'
  });

  // Reset form and view state
  const resetForm = () => {
    setCurrentView('list');
    setCreateStep('template');
    setEditingReport(null);
    setSelectedTemplate(null);
    setFormData({
      title: '',
      prompt: '',
      schedule_type: 'scheduled',
      schedule_frequency: 'daily',
      schedule_time: '07:00'
    });
  };

  // Handle modal close
  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Start creating new report
  const startCreate = () => {
    resetForm();
    setCurrentView('create');
    setCreateStep('template');
  };

  // Start editing report
  const startEdit = (report: UserReport) => {
    setEditingReport(report);
    setFormData({
      title: report.title,
      prompt: report.prompt,
      schedule_type: report.schedule_type,
      schedule_frequency: report.schedule_frequency,
      schedule_time: report.schedule_time
    });
    setCurrentView('edit');
    setCreateStep('configure');
  };

  // Handle template selection
  const handleTemplateSelect = (template: ReportTemplate) => {
    setSelectedTemplate(template);
    setFormData({
      title: template.name,
      prompt: template.prompt_template,
      schedule_type: 'scheduled',
      schedule_frequency: template.default_schedule,
      schedule_time: template.default_time
    });
    setCreateStep('configure');
  };

  // Handle custom report selection
  const handleCustomReport = () => {
    setSelectedTemplate(null);
    setFormData({
      title: '',
      prompt: '',
      schedule_type: 'scheduled',
      schedule_frequency: 'daily',
      schedule_time: '07:00'
    });
    setCreateStep('configure');
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!formData.title.trim() || !formData.prompt.trim()) {
      return;
    }

    const reportData = {
      title: formData.title,
      prompt: formData.prompt,
      schedule_type: formData.schedule_type,
      schedule_frequency: formData.schedule_frequency,
      schedule_time: formData.schedule_time,
      report_template_id: selectedTemplate?.id || null,
      is_active: true
    };

    if (editingReport) {
      await updateReport(editingReport.id, reportData);
    } else {
      await createReport(reportData);
    }

    handleClose();
  };

  // Handle delete with confirmation
  const handleDelete = async (report: UserReport) => {
    if (window.confirm(`Are you sure you want to delete "${report.title}"? This action cannot be undone.`)) {
      await deleteReport(report.id);
    }
  };

  // Handle running a report and closing modal
  const handleRunReport = async (report: UserReport) => {
    if (runningReports.has(report.id)) return;
    
    try {
      await runReportNow(report.id);
      
      // Wait a moment for the report to be saved, then close modal
      setTimeout(() => {
        onClose();
      }, 1500);
      
    } catch (error) {
      console.error('Error running report:', error);
      // Don't close modal if there was an error
    }
  };

  // Format schedule display
  const formatSchedule = (report: UserReport) => {
    if (report.schedule_type === 'manual') {
      return 'Manual only';
    }

    const time = new Date(`2000-01-01T${report.schedule_time}`);
    const timeStr = time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    
    switch (report.schedule_frequency) {
      case 'daily':
        return `Daily at ${timeStr}`;
      case 'weekly':
        return `Weekly at ${timeStr}`;
      case 'monthly':
        return `Monthly at ${timeStr}`;
      default:
        return `${report.schedule_frequency} at ${timeStr}`;
    }
  };

  // Format next run time
  const formatNextRun = (nextRunAt: string | null) => {
    if (!nextRunAt) return 'Not scheduled';
    
    const date = new Date(nextRunAt);
    const now = new Date();
    
    if (date < now) return 'Overdue';
    
    // Format in EST timezone
    return date.toLocaleDateString('en-US', { 
      timeZone: 'America/New_York',
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center space-x-2">
            <Settings className="w-6 h-6 text-blue-500" />
            <h2 className="text-xl font-bold text-white">
              {currentView === 'list' ? 'Manage Reports' : 
               currentView === 'create' ? 'Create New Report' : 'Edit Report'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {/* List View */}
          {currentView === 'list' && (
            <div className="space-y-6">
              {/* Reports List */}
              {userReports.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No reports configured yet.</p>
                  <p className="text-gray-500 text-sm">Create your first report to get started.</p>
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
                            <span className="text-2xl">
                              {report.template?.icon || '📊'}
                            </span>
                            <h3 className="font-medium text-white">{report.title}</h3>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              report.is_active 
                                ? 'bg-green-500/20 text-green-400' 
                                : 'bg-gray-500/20 text-gray-400'
                            }`}>
                              {report.is_active ? 'Active' : 'Paused'}
                            </span>
                          </div>
                          
                          <div className="flex items-center space-x-4 text-xs text-gray-500 mb-3">
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-3 h-3" />
                              <span>{formatSchedule(report)}</span>
                            </div>
                            {report.last_run_at && (
                              <div>
                                Last run: {new Date(report.last_run_at).toLocaleDateString()}
                              </div>
                            )}
                            {report.next_run_at && (
                              <div>
                                Next: {formatNextRun(report.next_run_at)}
                              </div>
                            )}
                          </div>

                          <p className="text-sm text-gray-400 line-clamp-2">
                            {report.prompt}
                          </p>
                        </div>
                        
                        <div className="flex items-center space-x-2 ml-4">
                          <button
                            onClick={() => handleRunReport(report)}
                            disabled={runningReports.has(report.id)}
                            className={`p-2 rounded-lg transition-colors text-white disabled:opacity-50 ${
                              runningReports.has(report.id)
                                ? 'bg-purple-600 cursor-not-allowed animate-pulse'
                                : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                            title="Run now"
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
                            onClick={() => startEdit(report)}
                            className="p-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          
                          <button
                            onClick={() => handleDelete(report)}
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
          )}

          {/* Create/Edit Views */}
          {(currentView === 'create' || currentView === 'edit') && (
            <div className="space-y-6">
              {/* Step 1: Template Selection (Create only) */}
              {currentView === 'create' && createStep === 'template' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-medium text-white">Choose a Template</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Templates */}
                    {templates.map((template) => (
                      <div
                        key={template.id}
                        onClick={() => handleTemplateSelect(template)}
                        className="bg-gray-700/50 hover:bg-gray-700 border border-gray-600 rounded-lg p-4 cursor-pointer transition-colors group"
                      >
                        <div className="flex items-start space-x-3">
                          <span className="text-2xl">{template.icon}</span>
                          <div className="flex-1">
                            <h4 className="font-medium text-white group-hover:text-blue-300 transition-colors">
                              {template.name}
                            </h4>
                            <p className="text-sm text-gray-400 mt-1">
                              {template.description}
                            </p>
                            <div className="flex items-center space-x-2 mt-2 text-xs text-gray-500">
                              <Calendar className="w-3 h-3" />
                              <span className="capitalize">{template.default_schedule}</span>
                              <Clock className="w-3 h-3 ml-2" />
                              <span>{template.default_time}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Custom Report Option */}
                    <div
                      onClick={handleCustomReport}
                      className="bg-gray-700/50 hover:bg-gray-700 border border-gray-600 border-dashed rounded-lg p-4 cursor-pointer transition-colors group"
                    >
                      <div className="flex items-start space-x-3">
                        <span className="text-2xl">⚡</span>
                        <div className="flex-1">
                          <h4 className="font-medium text-white group-hover:text-blue-300 transition-colors">
                            Custom Report
                          </h4>
                          <p className="text-sm text-gray-400 mt-1">
                            Create a custom report with your own prompt and schedule
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Configure Report */}
              {createStep === 'configure' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-white">Configure Report</h3>
                    {currentView === 'create' && (
                      <button
                        onClick={() => setCreateStep('template')}
                        className="text-blue-400 hover:text-blue-300 text-sm"
                      >
                        ← Back to Templates
                      </button>
                    )}
                  </div>

                  <div className="space-y-4">
                    {/* Title */}
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

                    {/* Prompt */}
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
                      <div className="flex space-x-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            value="manual"
                            checked={formData.schedule_type === 'manual'}
                            onChange={(e) => setFormData({ ...formData, schedule_type: e.target.value as 'manual' | 'scheduled' })}
                            className="mr-2"
                          />
                          <span className="text-white">Manual only</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            value="scheduled"
                            checked={formData.schedule_type === 'scheduled'}
                            onChange={(e) => setFormData({ ...formData, schedule_type: e.target.value as 'manual' | 'scheduled' })}
                            className="mr-2"
                          />
                          <span className="text-white">Scheduled</span>
                        </label>
                      </div>
                    </div>

                    {/* Schedule Configuration */}
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
                          label="Time"
                        />
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      onClick={handleClose}
                      className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={!formData.title.trim() || !formData.prompt.trim() || loading}
                      className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                      {editingReport ? 'Update Report' : 'Create Report'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};