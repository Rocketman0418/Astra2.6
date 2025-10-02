import React, { useState } from 'react';
import { X, Plus, Settings, Play, Pause, Pencil, Trash2, Calendar, Clock, Zap, CheckCircle } from 'lucide-react';
import { useReportsContext, ReportTemplate, UserReport } from '../contexts/ReportsContext';
import { HourOnlyTimePicker } from './HourOnlyTimePicker';

interface ManageReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ModalView = 'list' | 'create' | 'edit' | 'success';
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
  } = useReportsContext();

  const [currentView, setCurrentView] = useState<ModalView>('list');
  const [createStep, setCreateStep] = useState<CreateStep>('template');
  const [editingReport, setEditingReport] = useState<UserReport | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdReportTitle, setCreatedReportTitle] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    prompt: '',
    schedule_type: 'scheduled' as 'manual' | 'scheduled',
    schedule_frequency: 'daily',
    schedule_time: '07:00',
    schedule_day: null as number | null
  });

  // Reset form and view state
  const resetForm = () => {
    setCurrentView('list');
    setCreateStep('template');
    setEditingReport(null);
    setSelectedTemplate(null);
    setIsSubmitting(false);
    setCreatedReportTitle('');
    setFormData({
      title: '',
      prompt: '',
      schedule_type: 'scheduled',
      schedule_frequency: 'daily',
      schedule_time: '07:00',
      schedule_day: null
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
      schedule_time: report.schedule_time,
      schedule_day: report.schedule_day
    });
    setCurrentView('edit');
    setCreateStep('configure');
  };

  // Handle template selection
  const handleTemplateSelect = (template: ReportTemplate) => {
    setSelectedTemplate(template);
    const scheduleDay = template.default_schedule === 'weekly' ? 1 : template.default_schedule === 'monthly' ? 1 : null;
    setFormData({
      title: template.name,
      prompt: template.prompt_template,
      schedule_type: 'scheduled',
      schedule_frequency: template.default_schedule,
      schedule_time: template.default_time,
      schedule_day: scheduleDay
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
      schedule_time: '07:00',
      schedule_day: null
    });
    setCreateStep('configure');
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!formData.title.trim() || !formData.prompt.trim()) {
      return;
    }

    setIsSubmitting(true);
    setCreatedReportTitle(formData.title);

    const reportData = {
      title: formData.title,
      prompt: formData.prompt,
      schedule_type: formData.schedule_type,
      schedule_frequency: formData.schedule_frequency,
      schedule_time: formData.schedule_time,
      schedule_day: formData.schedule_day,
      report_template_id: selectedTemplate?.id || null,
      is_active: true
    };

    try {
      if (editingReport) {
        await updateReport(editingReport.id, reportData);
        // For edits, close immediately
        await new Promise(resolve => setTimeout(resolve, 500));
        setIsSubmitting(false);
        handleClose();
      } else {
        await createReport(reportData);
        // For new reports, show success screen
        setIsSubmitting(false);
        setCurrentView('success');

        // Auto-close after showing success for 2.5 seconds
        setTimeout(() => {
          handleClose();
        }, 2500);
      }
    } catch (error) {
      console.error('Error submitting report:', error);
      setIsSubmitting(false);
    }
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

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    switch (report.schedule_frequency) {
      case 'daily':
        return `Daily at ${timeStr}`;
      case 'weekly':
        const dayOfWeek = report.schedule_day ?? 1;
        return `Weekly on ${dayNames[dayOfWeek]} at ${timeStr}`;
      case 'monthly':
        const dayOfMonth = report.schedule_day ?? 1;
        const suffix = dayOfMonth === 1 ? 'st' : dayOfMonth === 2 ? 'nd' : dayOfMonth === 3 ? 'rd' : 'th';
        return `Monthly on the ${dayOfMonth}${suffix} at ${timeStr}`;
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
    
    // Format in Eastern Time with proper timezone detection
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short'
    });
    
    return formatter.format(date);
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
                            onClick={() => startEdit(report)}
                            className="p-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
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
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              Frequency
                            </label>
                            <select
                              value={formData.schedule_frequency}
                              onChange={(e) => {
                                const freq = e.target.value;
                                const defaultDay = freq === 'weekly' ? 1 : freq === 'monthly' ? 1 : null;
                                setFormData({ ...formData, schedule_frequency: freq, schedule_day: defaultDay });
                              }}
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

                        {/* Day of Week Selector for Weekly Reports */}
                        {formData.schedule_frequency === 'weekly' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              Day of Week
                            </label>
                            <select
                              value={formData.schedule_day ?? 1}
                              onChange={(e) => setFormData({ ...formData, schedule_day: parseInt(e.target.value) })}
                              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                            >
                              <option value="0">Sunday</option>
                              <option value="1">Monday</option>
                              <option value="2">Tuesday</option>
                              <option value="3">Wednesday</option>
                              <option value="4">Thursday</option>
                              <option value="5">Friday</option>
                              <option value="6">Saturday</option>
                            </select>
                          </div>
                        )}

                        {/* Day of Month Selector for Monthly Reports */}
                        {formData.schedule_frequency === 'monthly' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              Day of Month
                            </label>
                            <select
                              value={formData.schedule_day ?? 1}
                              onChange={(e) => setFormData({ ...formData, schedule_day: parseInt(e.target.value) })}
                              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                            >
                              {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                                <option key={day} value={day}>{day}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      onClick={handleClose}
                      disabled={isSubmitting}
                      className="px-4 py-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={!formData.title.trim() || !formData.prompt.trim() || loading || isSubmitting}
                      className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center space-x-2"
                    >
                      {isSubmitting ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>{editingReport ? 'Updating...' : 'Creating...'}</span>
                        </>
                      ) : (
                        <span>{editingReport ? 'Update Report' : 'Create Report'}</span>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Success View */}
          {currentView === 'success' && (
            <div className="py-12">
              <div className="text-center space-y-6">
                <div className="flex justify-center">
                  <div className="relative">
                    <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping"></div>
                    <CheckCircle className="w-20 h-20 text-green-500 relative" />
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-white">Report Created!</h3>
                  <p className="text-gray-400">
                    <span className="text-white font-medium">{createdReportTitle}</span> has been successfully created
                  </p>
                </div>

                <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-4 max-w-md mx-auto">
                  <p className="text-sm text-gray-300">
                    Your report is now active and will run according to its schedule.
                    You can manage it anytime from the Manage Reports screen.
                  </p>
                </div>

                <button
                  onClick={handleClose}
                  className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};