import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Snowflake,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  XCircle,
  Download,
  X,
  MessageSquare,
  ArrowUpDown,
  Check
} from 'lucide-react';

// ==========================================
// 1. PASTE YOUR SUPABASE KEYS HERE
// ==========================================
const supabaseUrl = 'https://rscxaqhszdffrddqdcij.supabase.co/rest/v1/';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzY3hhcWhzemRmZnJkZHFkY2lqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4MjMxNTYsImV4cCI6MjEwOTM5OTE1Nn0.gnHcOyWsOG2aWFPRHevtBVheQNvfibSqaR3Xd4O6zMY';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const STATUS_STYLES = {
  Ready: {
    select: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60',
    dot: 'bg-emerald-500'
  },
  'Needs Repair (Usable)': {
    select: 'bg-amber-950/80 text-amber-300 border-amber-700/60',
    dot: 'bg-amber-500'
  },
  'In Shop': {
    select: 'bg-sky-950/80 text-sky-300 border-sky-700/60',
    dot: 'bg-sky-500'
  },
  'Out of Service / Down': {
    select: 'bg-rose-950/80 text-rose-300 border-rose-700/60',
    dot: 'bg-rose-500'
  }
};

const PRIORITY_STYLES = {
  'Priority 1 - High': {
    select: 'bg-rose-950 text-rose-200 border-rose-700 font-bold',
    rank: 1
  },
  'Priority 2 - Medium': {
    select: 'bg-amber-950 text-amber-200 border-amber-700 font-semibold',
    rank: 2
  },
  'Priority 3 - Low': {
    select: 'bg-slate-800 text-slate-200 border-slate-700 font-medium',
    rank: 3
  },
  None: {
    select: 'bg-slate-900 text-slate-500 border-slate-800',
    rank: 4
  }
};

export default function App() {
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(null);
  
  const [filterMode, setFilterMode] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('PRIORITY');

  const [isReportOpen, setIsReportOpen] = useState(false);
  const [editingUnitId, setEditingUnitId] = useState(null);
  const [toast, setToast] = useState(null);

  const [reportForm, setReportForm] = useState({
    unitId: '',
    usability: 'Needs Repair (Usable)',
    priority: 'Priority 1 - High',
    preparedForWinter: false,
    issue: '',
    reportedBy: ''
  });

  const [updateNoteText, setUpdateNoteText] = useState('');
  const [editIssueText, setEditIssueText] = useState('');
  
  // New state to hold history for the currently editing unit
  const [editingHistory, setEditingHistory] = useState([]);

  useEffect(() => {
    fetchEquipment();
  }, []);

  const fetchEquipment = async () => {
    try {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .order('id', { ascending: true });
        
      if (error) throw error;
      
      // Map database columns to app state properties
      const formattedData = data.map(item => ({
        id: item.id,
        dept: item.dept,
        model: item.model,
        aka: item.aka,
        snowType: item.snow_type,
        status: item.status,
        priority: item.priority,
        preparedForWinter: item.prepared_for_winter,
        issue: item.issue,
        reportedBy: item.reported_by,
        shopNote: item.shop_note
      }));
      
      setEquipment(formattedData);
      
      if (formattedData.length > 0 && !reportForm.unitId) {
         setReportForm(prev => ({ ...prev, unitId: formattedData[0].id }));
      }
    } catch (error) {
      console.error('Error fetching equipment:', error.message);
      setDbError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3000);
  };

  const getShortDate = () => {
    return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const logHistory = async (unitId, logText) => {
    try {
      await supabase.from('equipment_history').insert([
        { unit_id: unitId, log_text: logText }
      ]);
    } catch (error) {
      console.error('Error logging history:', error);
    }
  };

  const openReportModalForUnit = (unitId) => {
    const target = equipment.find((u) => u.id === unitId) || equipment[0];
    if (!target) return;
    setReportForm((prev) => ({
      ...prev,
      unitId: target.id,
      preparedForWinter: Boolean(target.preparedForWinter)
    }));
    setIsReportOpen(true);
  };

  const counts = useMemo(() => {
    const total = equipment.length;
    const ready = equipment.filter((u) => u.status === 'Ready').length;
    const needsRepair = equipment.filter((u) => u.status === 'Needs Repair (Usable)').length;
    const inShop = equipment.filter((u) => u.status === 'In Shop').length;
    const down = equipment.filter((u) => u.status === 'Out of Service / Down').length;
    const activeIssues = total - ready;
    const winterReady = equipment.filter((u) => u.preparedForWinter).length;
    const winterNeeded = total - winterReady;
    return { total, ready, needsRepair, inShop, down, activeIssues, winterReady, winterNeeded };
  }, [equipment]);

  const displayedEquipment = useMemo(() => {
    return equipment
      .filter((u) => {
        if (filterMode === 'ISSUES' && u.status === 'Ready') return false;
        if (filterMode === 'READY' && u.status !== 'Ready') return false;
        if (filterMode === 'NEEDS_REPAIR' && u.status !== 'Needs Repair (Usable)') return false;
        if (filterMode === 'IN_SHOP' && u.status !== 'In Shop') return false;
        if (filterMode === 'DOWN' && u.status !== 'Out of Service / Down') return false;
        if (filterMode === 'WINTER_READY' && !u.preparedForWinter) return false;
        if (filterMode === 'WINTER_NEEDED' && u.preparedForWinter) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchId = u.id.toLowerCase().includes(q);
          const matchAka = u.aka?.toLowerCase().includes(q);
          const matchModel = u.model?.toLowerCase().includes(q);
          const matchSnow = u.snowType?.toLowerCase().includes(q);
          const matchIssue = u.issue?.toLowerCase().includes(q);
          if (!matchId && !matchAka && !matchModel && !matchSnow && !matchIssue) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'NUMBER') {
          return a.id.localeCompare(b.id, undefined, { numeric: true });
        }
        const aReady = a.status === 'Ready' ? 1 : 0;
        const bReady = b.status === 'Ready' ? 1 : 0;
        if (aReady !== bReady) return aReady - bReady;

        const rankA = PRIORITY_STYLES[a.priority]?.rank || 4;
        const rankB = PRIORITY_STYLES[b.priority]?.rank || 4;
        if (rankA !== rankB) return rankA - rankB;

        return a.id.localeCompare(b.id, undefined, { numeric: true });
      });
  }, [equipment, filterMode, searchQuery, sortBy]);

  const editingUnit = useMemo(
    () => equipment.find((u) => u.id === editingUnitId) || null,
    [equipment, editingUnitId]
  );

  const openEditModal = async (unit) => {
    setEditingUnitId(unit.id);
    setEditIssueText(unit.issue || '');
    setUpdateNoteText('');
    
    // Fetch history for this unit
    const { data } = await supabase
      .from('equipment_history')
      .select('*')
      .eq('unit_id', unit.id)
      .order('created_at', { ascending: false })
      .limit(10);
      
    if (data) {
      setEditingHistory(data.map(h => ({
        id: h.id,
        date: new Date(h.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
        text: h.log_text
      })));
    }
  };

  const handleToggleWinterPrep = async (unitId) => {
    const unit = equipment.find(u => u.id === unitId);
    if (!unit) return;
    
    const newState = !unit.preparedForWinter;
    
    // Update local state immediately for snappy UI
    setEquipment(prev => prev.map(u => u.id === unitId ? { ...u, preparedForWinter: newState } : u));
    showToast(newState ? `#${unitId} marked Prepared for Winter` : `#${unitId} marked Needs Winter Prep`);

    // Update DB
    await supabase.from('equipment').update({ prepared_for_winter: newState }).eq('id', unitId);
    await logHistory(unitId, newState ? 'Marked Prepared for Winter.' : 'Marked Needs Winter Prep.');
  };

  const handleStatusChange = async (unitId, newStatus) => {
    const unit = equipment.find(u => u.id === unitId);
    if (!unit) return;

    let updates = { status: newStatus };
    
    if (newStatus === 'Ready') {
      updates = { ...updates, priority: 'None', issue: '', reported_by: '', shop_note: '' };
    } else {
      updates.priority = unit.priority === 'None' ? 'Priority 2 - Medium' : unit.priority;
      updates.issue = unit.issue || 'Needs shop check / service';
      if (!unit.reportedBy) updates.reported_by = `Logged ${getShortDate()}`;
    }

    // Update Local
    setEquipment(prev => prev.map(u => {
      if (u.id !== unitId) return u;
      return { 
        ...u, 
        status: newStatus,
        priority: updates.priority ?? u.priority,
        issue: updates.issue ?? u.issue,
        reportedBy: updates.reported_by ?? u.reportedBy,
        shopNote: updates.shop_note ?? u.shopNote
      };
    }));
    showToast(`Updated #${unitId} status to ${newStatus}`);

    // Update DB
    await supabase.from('equipment').update(updates).eq('id', unitId);
    await logHistory(unitId, newStatus === 'Ready' ? 'Marked Repaired & Ready for service.' : `Status changed to "${newStatus}".`);
  };

  const handlePriorityChange = async (unitId, newPriority) => {
    setEquipment(prev => prev.map(u => u.id === unitId ? { ...u, priority: newPriority } : u));
    showToast(`Updated #${unitId} to ${newPriority}`);
    
    await supabase.from('equipment').update({ priority: newPriority }).eq('id', unitId);
    await logHistory(unitId, `Priority changed to "${newPriority}".`);
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    if (!reportForm.issue.trim()) return;

    const shortDate = getShortDate();
    const reporter = reportForm.reportedBy.trim() || 'Staff';
    const reportedString = `${reporter} • ${shortDate}`;
    
    const updates = {
      status: reportForm.usability,
      priority: reportForm.priority,
      prepared_for_winter: reportForm.preparedForWinter,
      issue: reportForm.issue.trim(),
      reported_by: reportedString,
      shop_note: ''
    };

    // Local update
    setEquipment(prev => prev.map(u => {
      if (u.id !== reportForm.unitId) return u;
      return {
        ...u,
        status: reportForm.usability,
        priority: reportForm.priority,
        preparedForWinter: reportForm.preparedForWinter,
        issue: reportForm.issue.trim(),
        reportedBy: reportedString,
        shopNote: ''
      };
    }));

    setIsReportOpen(false);
    setReportForm(prev => ({ ...prev, issue: '' }));
    showToast(`Reported issue for #${reportForm.unitId}`);

    // DB update
    await supabase.from('equipment').update(updates).eq('id', reportForm.unitId);
    await logHistory(reportForm.unitId, `Issue reported by ${reporter} (${reportForm.usability}, ${reportForm.priority}): ${reportForm.issue.trim()}`);
  };

  const handleSaveUnitUpdate = async (e) => {
    e.preventDefault();
    if (!editingUnit) return;

    const updatedIssue = editIssueText.trim() || editingUnit.issue;
    const updatedShopNote = updateNoteText.trim() ? updateNoteText.trim() : editingUnit.shopNote;
    
    const newStatus = editingUnit.status === 'Ready' && updatedIssue ? 'Needs Repair (Usable)' : editingUnit.status;
    const newPriority = editingUnit.priority === 'None' && updatedIssue ? 'Priority 2 - Medium' : editingUnit.priority;

    const updates = {
      issue: updatedIssue,
      shop_note: updatedShopNote,
      status: newStatus,
      priority: newPriority
    };

    setEquipment(prev => prev.map(u => {
      if (u.id !== editingUnit.id) return u;
      return { ...u, issue: updatedIssue, shopNote: updatedShopNote, status: newStatus, priority: newPriority };
    }));
    
    setEditingUnitId(null);
    showToast(`Saved update for #${editingUnit.id}`);

    await supabase.from('equipment').update(updates).eq('id', editingUnit.id);
    
    if (updateNoteText.trim()) {
      await logHistory(editingUnit.id, `Update Note: ${updateNoteText.trim()}`);
    } else if (updatedIssue !== editingUnit.issue) {
      await logHistory(editingUnit.id, `Updated issue description: ${updatedIssue}`);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Equipment #','Nickname','Department','Make / Model','Snow Equipment','Status','Prepared for Winter','Priority','Reported Issue','Reported By','Latest Shop / Status Note'];
    const rows = displayedEquipment.map(u => [
      `#${u.id}`, u.aka, u.dept, u.model, u.snowType, u.status, u.preparedForWinter ? 'Yes' : 'No',
      u.status === 'Ready' ? '' : u.priority, u.issue, u.reportedBy, u.shopNote
    ]);
    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `equipment-tracker-${getShortDate().replace(' ', '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Downloaded CSV spreadsheet');
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Loading equipment from database...</div>;
  }

  if (dbError) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-rose-950/30 border border-rose-500/30 rounded-2xl p-8 max-w-lg shadow-2xl">
          <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-100 mb-2">Database Connection Error</h2>
          <p className="text-slate-300 mb-4 text-sm">Supabase blocked the connection and returned this exact error:</p>
          <code className="block bg-slate-950 text-rose-400 p-4 rounded-lg border border-rose-900/50 text-sm font-mono whitespace-pre-wrap break-words text-left">
            {dbError}
          </code>
          <p className="text-slate-400 text-sm mt-6">
            Copy and paste this error to me so we can fix the exact issue!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-12">
      {/* Toast Feedback */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 bg-slate-800 border border-slate-700 text-slate-100 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium print:hidden">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-20 print:static print:border-b-2">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-sky-600 flex items-center justify-center text-white shadow-xs shrink-0 print:hidden">
              <Snowflake className="w-5 h-5" />
            </div>
            <div className="truncate">
              <h1 className="text-lg sm:text-2xl font-bold text-slate-100 tracking-tight truncate">
                Equipment Tracker
              </h1>
              <p className="text-xs text-slate-400 hidden sm:block">
                Snow Equipment Status &amp; Repair List (Live Sync)
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsReportOpen(true)}
            className="flex items-center gap-1.5 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-bold text-xs sm:text-sm shadow-xs transition-colors shrink-0 print:hidden"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
            <span>Report Issue</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 pt-4 sm:pt-6 space-y-4">
        {/* KPI Cards */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 print:grid-cols-4">
          <button onClick={() => setFilterMode(prev => (prev === 'READY' ? 'ALL' : 'READY'))} className={`p-3 sm:p-4 rounded-xl border text-left transition-all ${filterMode === 'READY' ? 'bg-emerald-600 text-white border-emerald-500 shadow-md ring-2 ring-emerald-500/30' : 'bg-slate-900 text-slate-200 border-slate-800 hover:border-emerald-700/80 hover:bg-slate-800/80'}`}>
            <div className="flex items-center justify-between"><span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider opacity-85">Ready</span><CheckCircle2 className={`w-4 h-4 shrink-0 ${filterMode === 'READY' ? 'text-white' : 'text-emerald-400'}`} /></div>
            <div className="text-xl sm:text-2xl font-extrabold mt-1">{counts.ready}</div>
            <div className="text-[11px] sm:text-xs opacity-75 truncate mt-0.5">Fully operational</div>
          </button>

          <button onClick={() => setFilterMode(prev => prev === 'NEEDS_REPAIR' ? 'ALL' : 'NEEDS_REPAIR')} className={`p-3 sm:p-4 rounded-xl border text-left transition-all ${filterMode === 'NEEDS_REPAIR' ? 'bg-amber-600 text-white border-amber-500 shadow-md ring-2 ring-amber-500/30' : 'bg-slate-900 text-slate-200 border-slate-800 hover:border-amber-700/80 hover:bg-slate-800/80'}`}>
            <div className="flex items-center justify-between"><span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider opacity-85">Needs Repair</span><Wrench className={`w-4 h-4 shrink-0 ${filterMode === 'NEEDS_REPAIR' ? 'text-white' : 'text-amber-400'}`} /></div>
            <div className="text-xl sm:text-2xl font-extrabold mt-1">{counts.needsRepair}</div>
            <div className="text-[11px] sm:text-xs opacity-75 truncate mt-0.5">Usable with minor issues</div>
          </button>

          <button onClick={() => setFilterMode(prev => (prev === 'IN_SHOP' ? 'ALL' : 'IN_SHOP'))} className={`p-3 sm:p-4 rounded-xl border text-left transition-all ${filterMode === 'IN_SHOP' ? 'bg-sky-600 text-white border-sky-500 shadow-md ring-2 ring-sky-500/30' : 'bg-slate-900 text-slate-200 border-slate-800 hover:border-sky-700/80 hover:bg-slate-800/80'}`}>
            <div className="flex items-center justify-between"><span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider opacity-85">In Shop</span><AlertTriangle className={`w-4 h-4 shrink-0 ${filterMode === 'IN_SHOP' ? 'text-white' : 'text-sky-400'}`} /></div>
            <div className="text-xl sm:text-2xl font-extrabold mt-1">{counts.inShop}</div>
            <div className="text-[11px] sm:text-xs opacity-75 truncate mt-0.5">Active shop repair</div>
          </button>

          <button onClick={() => setFilterMode(prev => (prev === 'DOWN' ? 'ALL' : 'DOWN'))} className={`p-3 sm:p-4 rounded-xl border text-left transition-all ${filterMode === 'DOWN' ? 'bg-rose-600 text-white border-rose-500 shadow-md ring-2 ring-rose-500/30' : 'bg-slate-900 text-slate-200 border-slate-800 hover:border-rose-700/80 hover:bg-slate-800/80'}`}>
            <div className="flex items-center justify-between"><span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider opacity-85">Out of Service</span><XCircle className={`w-4 h-4 shrink-0 ${filterMode === 'DOWN' ? 'text-white' : 'text-rose-400'}`} /></div>
            <div className="text-xl sm:text-2xl font-extrabold mt-1">{counts.down}</div>
            <div className="text-[11px] sm:text-xs opacity-75 truncate mt-0.5">Grounded / down</div>
          </button>
        </section>

        {/* Filters */}
        <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 bg-slate-900 p-3 rounded-xl border border-slate-800 print:hidden">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search # (e.g. 218), Loader, Plow..." className="w-full pl-9 pr-8 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500" />
            {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"><X className="w-4 h-4" /></button>}
          </div>

          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2">
            <button onClick={() => setFilterMode(prev => (prev === 'ISSUES' ? 'ALL' : 'ISSUES'))} className={`px-3 py-2 rounded-lg border text-xs font-bold transition-colors ${filterMode === 'ISSUES' ? 'bg-amber-600 text-white border-amber-500' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'}`}>Only Issues ({counts.activeIssues})</button>
            <button onClick={() => setFilterMode(prev => prev === 'WINTER_READY' ? 'ALL' : 'WINTER_READY')} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-bold transition-colors ${filterMode === 'WINTER_READY' ? 'bg-sky-600 text-white border-sky-500' : 'bg-sky-950/60 hover:bg-sky-900/60 text-sky-200 border-sky-800/80'}`}>
              <Snowflake className="w-3.5 h-3.5 shrink-0 text-sky-400" /><span>Prepared ({counts.winterReady}/{counts.total})</span>
            </button>
            <button onClick={() => setFilterMode(prev => prev === 'WINTER_NEEDED' ? 'ALL' : 'WINTER_NEEDED')} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-bold transition-colors ${filterMode === 'WINTER_NEEDED' ? 'bg-slate-200 text-slate-900 border-slate-300' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'}`}>
              <span>Needs Prep ({counts.winterNeeded})</span>
            </button>
            {filterMode !== 'ALL' && <button onClick={() => setFilterMode('ALL')} className="px-2.5 py-2 rounded-lg text-xs font-semibold text-sky-400 hover:bg-sky-950/50">Show All ({counts.total})</button>}
            <button onClick={() => setSortBy(prev => prev === 'PRIORITY' ? 'NUMBER' : 'PRIORITY')} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span>{sortBy === 'PRIORITY' ? 'Priority First' : 'By Equip #'}</span>
            </button>
          </div>
        </section>

        {/* List Section */}
        <section className="bg-slate-900 rounded-xl border border-slate-800 shadow-xs overflow-hidden">
          {/* MOBILE VIEW (< md) */}
          <div className="divide-y divide-slate-800 md:hidden print:hidden">
            {displayedEquipment.length === 0 ? (
              <div className="py-10 px-4 text-center text-slate-400 text-sm">No equipment matches your current filter.</div>
            ) : (
              displayedEquipment.map(unit => {
                const stStyle = STATUS_STYLES[unit.status] || STATUS_STYLES.Ready;
                const prStyle = PRIORITY_STYLES[unit.priority] || PRIORITY_STYLES.None;
                const isReady = unit.status === 'Ready';

                return (
                  <div key={unit.id} className={`p-3.5 space-y-2.5 ${isReady ? 'bg-slate-900' : 'bg-amber-950/20'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-base font-extrabold text-slate-100">#{unit.id}</span>
                          <span className="font-bold text-slate-200 text-sm">{unit.aka}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">{unit.dept}</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">{unit.model} • <span className="font-medium text-slate-300">{unit.snowType}</span></div>
                      </div>
                      {isReady ? (
                        <button onClick={() => openReportModalForUnit(unit.id)} className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-200 shrink-0">+ Issue</button>
                      ) : (
                        <button onClick={() => openEditModal(unit)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-bold text-sky-400 shrink-0">
                          <MessageSquare className="w-3.5 h-3.5" /><span>Update</span>
                        </button>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between gap-2">
                      <button type="button" onClick={() => handleToggleWinterPrep(unit.id)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${unit.preparedForWinter ? 'bg-sky-950/80 text-sky-200 border-sky-700/80' : 'bg-slate-800/60 text-slate-400 border-dashed border-slate-700'}`}>
                        <Snowflake className={`w-3.5 h-3.5 shrink-0 ${unit.preparedForWinter ? 'text-sky-400' : 'text-slate-500'}`} />
                        <span>{unit.preparedForWinter ? 'Prepared for Winter' : 'Needs Winter Prep (Tap)'}</span>
                        {unit.preparedForWinter && <Check className="w-3.5 h-3.5 text-sky-400 stroke-[2.5]" />}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <select value={unit.status} onChange={e => handleStatusChange(unit.id, e.target.value)} className={`w-full px-2.5 py-2 rounded-lg border text-xs font-bold ${stStyle.select}`}>
                        <option value="Ready">Ready</option><option value="Needs Repair (Usable)">Needs Repair (Usable)</option>
                        <option value="In Shop">In Shop</option><option value="Out of Service / Down">Out of Service / Down</option>
                      </select>
                      {!isReady ? (
                        <select value={unit.priority} onChange={e => handlePriorityChange(unit.id, e.target.value)} className={`w-full px-2.5 py-2 rounded-lg border text-xs ${prStyle.select}`}>
                          <option value="Priority 1 - High">Priority 1 - High</option><option value="Priority 2 - Medium">Priority 2 - Medium</option><option value="Priority 3 - Low">Priority 3 - Low</option>
                        </select>
                      ) : (
                        <div className="flex items-center text-xs text-emerald-400 font-medium px-2"><Check className="w-3.5 h-3.5 mr-1 text-emerald-400" />No open issues</div>
                      )}
                    </div>

                    {!isReady && (
                      <div onClick={() => openEditModal(unit)} className="text-xs bg-slate-950 border border-slate-800 rounded-lg p-2.5 space-y-1 cursor-pointer">
                        <div className="font-semibold text-slate-100">{unit.issue}</div>
                        {unit.reportedBy && <div className="text-[11px] text-slate-400">Reported by: {unit.reportedBy}</div>}
                        {unit.shopNote && <div className="text-[11px] text-slate-300 pt-1 border-t border-slate-800"><strong className="text-slate-100">Latest Note:</strong> {unit.shopNote}</div>}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* DESKTOP TABLE VIEW */}
          <div className="hidden md:block print:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-4 w-64">Equipment</th>
                  <th className="py-3.5 px-4 w-48">Status</th>
                  <th className="py-3.5 px-4 w-48">Winter Readiness</th>
                  <th className="py-3.5 px-4 w-44">Repair Priority</th>
                  <th className="py-3.5 px-4">Reported Issue &amp; Shop Notes</th>
                  <th className="py-3.5 px-4 w-36 text-right print:hidden">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-sm">
                {displayedEquipment.length === 0 ? (
                  <tr><td colSpan={6} className="py-12 text-center text-slate-400 text-sm">No equipment matches your filter.</td></tr>
                ) : (
                  displayedEquipment.map(unit => {
                    const stStyle = STATUS_STYLES[unit.status] || STATUS_STYLES.Ready;
                    const prStyle = PRIORITY_STYLES[unit.priority] || PRIORITY_STYLES.None;
                    const isReady = unit.status === 'Ready';

                    return (
                      <tr key={unit.id} className={`transition-colors ${isReady ? 'hover:bg-slate-800/40' : 'bg-amber-950/15 hover:bg-amber-950/30'}`}>
                        <td className="py-4 px-4 align-top">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-base font-extrabold text-slate-100">#{unit.id}</span>
                            <span className="font-bold text-slate-200">{unit.aka}</span>
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">{unit.dept}</span>
                          </div>
                          <div className="text-xs text-slate-400 mt-1">{unit.model} • <span className="font-medium text-slate-300">{unit.snowType}</span></div>
                        </td>

                        <td className="py-4 px-4 align-top">
                          <select value={unit.status} onChange={e => handleStatusChange(unit.id, e.target.value)} className={`w-full px-3 py-2 rounded-lg border text-xs font-bold cursor-pointer focus:outline-none ${stStyle.select}`}>
                            <option value="Ready" className="bg-slate-900 text-emerald-300">Ready</option>
                            <option value="Needs Repair (Usable)" className="bg-slate-900 text-amber-300">Needs Repair (Usable)</option>
                            <option value="In Shop" className="bg-slate-900 text-sky-300">In Shop</option>
                            <option value="Out of Service / Down" className="bg-slate-900 text-rose-300">Out of Service / Down</option>
                          </select>
                        </td>

                        <td className="py-4 px-4 align-top">
                          <button type="button" onClick={() => handleToggleWinterPrep(unit.id)} className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-bold transition-all cursor-pointer ${unit.preparedForWinter ? 'bg-sky-950/80 text-sky-200 border-sky-700/80 hover:bg-sky-900/80' : 'bg-slate-800/60 text-slate-400 border-dashed border-slate-700 hover:border-slate-500 hover:bg-slate-800'}`}>
                            <Snowflake className={`w-3.5 h-3.5 shrink-0 ${unit.preparedForWinter ? 'text-sky-400' : 'text-slate-500'}`} />
                            <span>{unit.preparedForWinter ? 'Prepared' : 'Needs Prep'}</span>
                            {unit.preparedForWinter && <Check className="w-3.5 h-3.5 text-sky-400 stroke-[2.5] shrink-0" />}
                          </button>
                        </td>

                        <td className="py-4 px-4 align-top">
                          {isReady ? <span className="inline-block px-3 py-2 text-xs text-slate-500">—</span> : (
                            <select value={unit.priority} onChange={e => handlePriorityChange(unit.id, e.target.value)} className={`w-full px-3 py-2 rounded-lg border text-xs cursor-pointer focus:outline-none ${prStyle.select}`}>
                              <option value="Priority 1 - High" className="bg-slate-900 text-rose-200">Priority 1 - High</option>
                              <option value="Priority 2 - Medium" className="bg-slate-900 text-amber-200">Priority 2 - Medium</option>
                              <option value="Priority 3 - Low" className="bg-slate-900 text-slate-200">Priority 3 - Low</option>
                            </select>
                          )}
                        </td>

                        <td className="py-4 px-4 align-top">
                          {isReady ? <span className="text-xs text-emerald-400 font-medium flex items-center gap-1.5 pt-1.5"><Check className="w-4 h-4 text-emerald-400" />No open issues</span> : (
                            <div className="space-y-1">
                              <div className="font-semibold text-slate-100">{unit.issue}</div>
                              {unit.reportedBy && <div className="text-xs text-slate-400">Reported by: {unit.reportedBy}</div>}
                              {unit.shopNote && <div className="text-xs bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 mt-1"><strong className="text-slate-100">Latest Note:</strong> {unit.shopNote}</div>}
                            </div>
                          )}
                        </td>

                        <td className="py-4 px-4 align-top text-right print:hidden">
                          {isReady ? (
                            <button onClick={() => openReportModalForUnit(unit.id)} className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200">+ Report Issue</button>
                          ) : (
                            <button onClick={() => openEditModal(unit)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-sky-400 shadow-2xs">
                              <MessageSquare className="w-3.5 h-3.5" /><span>Update / Note</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Footer */}
        <footer className="pt-4 pb-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400 print:hidden">
          <span>Showing {displayedEquipment.length} of {equipment.length} units (DB Connection: {dbError ? 'Failed' : 'Active'})</span>
          <button onClick={handleExportCSV} className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-200 underline underline-offset-4 py-1 px-2 rounded transition-colors"><Download className="w-3.5 h-3.5" /><span>Export current list to CSV (Excel)</span></button>
        </footer>
      </main>

      {/* REPORT ISSUE MODAL */}
      {isReportOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-800 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-100">Report Equipment Issue</h2>
              <button onClick={() => setIsReportOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleReportSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">1. Select Equipment #</label>
                <select value={reportForm.unitId} onChange={e => {
                  const target = equipment.find(u => u.id === e.target.value);
                  setReportForm(prev => ({ ...prev, unitId: e.target.value, preparedForWinter: target ? Boolean(target.preparedForWinter) : prev.preparedForWinter }));
                }} className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm font-semibold text-slate-100">
                  {equipment.slice().sort((a,b) => a.id.localeCompare(b.id, undefined, {numeric: true})).map(u => (
                    <option key={u.id} value={u.id} className="bg-slate-900">#{u.id} — {u.aka} ({u.model} • {u.snowType})</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">2. Can this equipment still be used?</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setReportForm(prev => ({ ...prev, usability: 'Needs Repair (Usable)' }))} className={`p-3 rounded-xl border text-left transition-all ${reportForm.usability === 'Needs Repair (Usable)' ? 'bg-amber-950/60 border-amber-500 ring-2 ring-amber-500/20' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}>
                    <div className="text-sm font-bold text-amber-200">Needs Repair (Usable)</div><div className="text-xs text-slate-400 mt-0.5">Can still operate</div>
                  </button>
                  <button type="button" onClick={() => setReportForm(prev => ({ ...prev, usability: 'Out of Service / Down' }))} className={`p-3 rounded-xl border text-left transition-all ${reportForm.usability === 'Out of Service / Down' ? 'bg-rose-950/60 border-rose-500 ring-2 ring-rose-500/20' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}>
                    <div className="text-sm font-bold text-rose-200">Out of Service / Down</div><div className="text-xs text-rose-400 mt-0.5">Cannot be used</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">3. Repair Priority</label>
                <select value={reportForm.priority} onChange={e => setReportForm(prev => ({ ...prev, priority: e.target.value }))} className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm font-semibold text-slate-100">
                  <option value="Priority 1 - High" className="bg-slate-900 text-rose-200">Priority 1 - High (Fix First)</option>
                  <option value="Priority 2 - Medium" className="bg-slate-900 text-amber-200">Priority 2 - Medium (Next in Line)</option>
                  <option value="Priority 3 - Low" className="bg-slate-900 text-slate-200">Priority 3 - Low (When Time Allows)</option>
                </select>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">4. What is the issue? *</label>
                  <textarea rows={3} required value={reportForm.issue} onChange={e => setReportForm(prev => ({ ...prev, issue: e.target.value }))} placeholder="Describe what is broken..." className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-100 placeholder-slate-500" />
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div>
                    <div className="text-xs font-bold text-slate-200">Winter Readiness</div><div className="text-[11px] text-slate-400">Is this prepared for winter?</div>
                  </div>
                  <button type="button" onClick={() => setReportForm(prev => ({ ...prev, preparedForWinter: !prev.preparedForWinter }))} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${reportForm.preparedForWinter ? 'bg-sky-950/80 text-sky-200 border-sky-700' : 'bg-slate-900 text-slate-400 border-dashed border-slate-700'}`}>
                    <Snowflake className={`w-3.5 h-3.5 ${reportForm.preparedForWinter ? 'text-sky-400' : 'text-slate-500'}`} /><span>{reportForm.preparedForWinter ? 'Prepared' : 'Needs Prep'}</span>
                  </button>
                </div>
                <div>
                  <input type="text" value={reportForm.reportedBy} onChange={e => setReportForm(prev => ({ ...prev, reportedBy: e.target.value }))} placeholder="Your Name (Optional)" className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-100 placeholder-slate-500" />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button type="button" onClick={() => setIsReportOpen(false)} className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm font-semibold hover:bg-slate-800">Cancel</button>
                <button type="submit" className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold shadow-sm">Save Issue to Board</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPDATE / EDIT MODAL */}
      {editingUnit && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-100">#{editingUnit.id} — {editingUnit.aka}</h2>
                <p className="text-xs text-slate-400">{editingUnit.model} • {editingUnit.snowType}</p>
              </div>
              <button onClick={() => setEditingUnitId(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSaveUnitUpdate} className="p-6 space-y-4 overflow-y-auto flex-1">
              {editingUnit.status !== 'Ready' && (
                <button type="button" onClick={() => { handleStatusChange(editingUnit.id, 'Ready'); setEditingUnitId(null); }} className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-colors">
                  <CheckCircle2 className="w-5 h-5" /><span>Mark Repaired &amp; Ready for Service</span>
                </button>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Current Status</label>
                  <select value={editingUnit.status} onChange={e => handleStatusChange(editingUnit.id, e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm font-semibold text-slate-100">
                    <option value="Ready" className="bg-slate-900 text-emerald-300">Ready</option>
                    <option value="Needs Repair (Usable)" className="bg-slate-900 text-amber-300">Needs Repair (Usable)</option>
                    <option value="In Shop" className="bg-slate-900 text-sky-300">In Shop</option>
                    <option value="Out of Service / Down" className="bg-slate-900 text-rose-300">Out of Service / Down</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Repair Priority</label>
                  <select value={editingUnit.priority} onChange={e => handlePriorityChange(editingUnit.id, e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm font-semibold text-slate-100">
                    <option value="Priority 1 - High" className="bg-slate-900 text-rose-200">Priority 1 - High</option>
                    <option value="Priority 2 - Medium" className="bg-slate-900 text-amber-200">Priority 2 - Medium</option>
                    <option value="Priority 3 - Low" className="bg-slate-900 text-slate-200">Priority 3 - Low</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div><div className="text-xs font-bold text-slate-200">Winter Readiness</div><div className="text-[11px] text-slate-400">Tap to toggle Prepared for Winter status</div></div>
                <button type="button" onClick={() => handleToggleWinterPrep(editingUnit.id)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${editingUnit.preparedForWinter ? 'bg-sky-950/80 text-sky-200 border-sky-700' : 'bg-slate-900 text-slate-400 border-dashed border-slate-700'}`}>
                  <Snowflake className={`w-3.5 h-3.5 ${editingUnit.preparedForWinter ? 'text-sky-400' : 'text-slate-500'}`} /><span>{editingUnit.preparedForWinter ? 'Prepared' : 'Needs Prep'}</span>{editingUnit.preparedForWinter && <Check className="w-3.5 h-3.5 text-sky-400 stroke-[2.5]" />}
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Reported Issue</label>
                <input type="text" value={editIssueText} onChange={e => setEditIssueText(e.target.value)} className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-100" />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Add Shop / Status Update Note</label>
                <textarea rows={2} value={updateNoteText} onChange={e => setUpdateNoteText(e.target.value)} placeholder="e.g., Parts ordered, in bay now..." className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-100 placeholder-slate-500" />
              </div>

              {editingHistory.length > 0 && (
                <div className="pt-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Recent DB History</div>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {editingHistory.map(item => (
                      <div key={item.id} className="text-xs bg-slate-950 border border-slate-800 rounded-lg p-2.5">
                        <div className="font-semibold text-slate-400 mb-0.5">{item.date}</div>
                        <div className="text-slate-200">{item.text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button type="button" onClick={() => setEditingUnitId(null)} className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-sm font-semibold hover:bg-slate-800">Close</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold">Save Update</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
