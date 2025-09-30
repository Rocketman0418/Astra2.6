import React, { useState } from 'react';
import { X, CreditCard as Edit2, Trash2, Play, Pause, Calendar, Clock } from 'lucide-react';
import { ReportConfig } from '../../types';

interface ManageReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportConfigs: ReportConfig[];
  onUpdateReport: (reportId: string, updates: Partial<ReportConfig>) => void;
  onDeleteReport: (reportId: string) => void;
  onExecuteReport: (config: ReportConfig, isManualRun: boolean) => void;
  runningReports?: Set<string>;
}

export const ManageReportsModal: React.FC<ManageReportsModalProps> = ({
  isOpen,
  onClose,
  reportConfigs,
  onUpdateReport,
  onDeleteReport,
  onExecuteReport,
  runningReports = new Set()
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ReportConfig>>({});
  const [isSaving, setIsSaving] = useState(false);

  const handleEdit = (config: ReportConfig) => {
    setEditingId(config.id);
    setEditForm(config);
  };

  const handleSaveEdit = async () => {
    if (editingId && editForm) {
      setIsSaving(true);
      await onUpdateReport(editingId, editForm);

      // Brief delay to show success state
      setTimeout(() => {
        setIsSaving(false);
        setEditingId(null);
        setEditForm({});
      }, 500);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleDelete = (reportId: string, title: string) => {
    if (window.confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
      onDeleteReport(reportId);
    }
  };

  const formatNextExecution = (nextExecution?: string): string => {
    if (!nextExecution) return 'Not scheduled';
    
    const date = new Date(nextExecution);
    const now = new Date();
    
    if (date < now) return 'Overdue';
    
    return date.toLocaleDateString([], { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Manage Reports</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6">
          {reportConfigs.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No reports configured yet.</p>
              <p className="text-gray-500 text-sm">Create your first report to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reportConfigs.map((config) => (
                <div
                  key={config.id}
                  className="bg-gray-700/50 border border-gray-600 rounded-lg p-4"
                >
                  {editingId === config.id ? (
                    /* Edit Form */
                    <div className="space-y-4">
                      <input
                        type="text"
                        value={editForm.title || ''}
                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                        placeholder="Report title"
                      />
                      
                      <textarea
                        value={editForm.prompt || ''}
                        onChange={(e) => setEditForm({ ...editForm, prompt: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none resize-none"
                        placeholder="Report prompt"
                      />
                      
                      <div className="grid grid-cols-2 gap-4">
                        <select
                          value={editForm.frequency || 'daily'}
                          onChange={(e) => setEditForm({ ...editForm, frequency: e.target.value as any })}
                          className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                        
                        {/* Start Date - only show for Weekly and Monthly */}
                        {(editForm.frequency === 'weekly' || editForm.frequency === 'monthly') && (
                          <div>
                            {editForm.frequency === 'weekly' ? (
                              <select
                                value={editForm.start_date || ''}
                                onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
                                className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
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
                                value={editForm.start_date || ''}
                                onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
                                className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
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
                      </div>
                      
                      <div className="grid grid-cols-1 gap-4">
                        <input
                          type="time"
                          value={editForm.schedule_time || '07:00'}
                          onChange={(e) => setEditForm({ ...editForm, schedule_time: e.target.value })}
                          className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                      
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={handleCancelEdit}
                          disabled={isSaving}
                          className="px-3 py-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveEdit}
                          disabled={isSaving}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                        >
                          {isSaving ? (
                            <>
                              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              <span>Saving...</span>
                            </>
                          ) : (
                            <span>Save</span>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Display Mode */
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-medium text-white">{config.title}</h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            config.enabled 
                              ? 'bg-green-500/20 text-green-400' 
                              : 'bg-gray-500/20 text-gray-400'
                          }`}>
                            {config.enabled ? 'Active' : 'Paused'}
                          </span>
                        </div>
                        
                        <p className="text-sm text-gray-400 mb-3 line-clamp-2">
                          {config.prompt}
                        </p>
                        
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-3 h-3" />
                            <span className="capitalize">{config.frequency}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{config.schedule_time} EST</span>
                          </div>
                          <div>
                            Next: {formatNextExecution(config.next_execution)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => !runningReports.has(config.id) && onExecuteReport(config, true)}
                          disabled={runningReports.has(config.id)}
                          className={`p-2 rounded-lg transition-colors text-white ${
                            runningReports.has(config.id)
                              ? 'bg-purple-600 cursor-not-allowed animate-pulse'
                              : 'bg-blue-600 hover:bg-blue-700'
                          }`}
                          title={runningReports.has(config.id) ? 'Running...' : 'Run now'}
                        >
                          <Play className={`w-4 h-4 ${runningReports.has(config.id) ? 'animate-spin' : ''}`} />
                        </button>
                        
                        <button
                          onClick={() => onUpdateReport(config.id, { enabled: !config.enabled })}
                          className={`p-2 rounded-lg transition-colors ${
                            config.enabled
                              ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                              : 'bg-green-600 hover:bg-green-700 text-white'
                          }`}
                          title={config.enabled ? 'Pause' : 'Resume'}
                        >
                          {config.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                        
                        <button
                          onClick={() => handleEdit(config)}
                          className="p-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        
                        <button
                          onClick={() => handleDelete(config.id, config.title)}
                          className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};