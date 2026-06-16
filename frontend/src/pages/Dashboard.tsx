import { useState, useEffect, useRef, type ChangeEvent } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => void;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { requestNotificationPermission } from '../lib/firebase';
import { isSupported } from 'firebase/messaging';
import {
  Loader2, X, Bell, BellRing, LogOut, Heart, Trash2,
  Users, User as UserIcon, Upload
} from 'lucide-react';
import { parseCSV } from '../lib/csvParser';
import type { Transaction, Profile, NewExpense, FixedExpense, NewFixedExpense, CategoryMeta } from '../types';
import { DonutChart } from '../components/DonutChart';

const DEFAULT_CATEGORIES: CategoryMeta[] = [
  { label: 'Alimentação', icon: '🍔', color: 'bg-orange-100 text-orange-700' },
  { label: 'Transporte', icon: '🚗', color: 'bg-blue-100 text-blue-700' },
  { label: 'Saúde', icon: '🏥', color: 'bg-red-100 text-red-700' },
  { label: 'Lazer', icon: '🎮', color: 'bg-purple-100 text-purple-700' },
  { label: 'Casa', icon: '🏠', color: 'bg-green-100 text-green-700' },
  { label: 'Educação', icon: '📚', color: 'bg-yellow-100 text-yellow-700' },
  { label: 'Roupas', icon: '👕', color: 'bg-pink-100 text-pink-700' },
  { label: 'Assinaturas', icon: '📺', color: 'bg-cyan-100 text-cyan-700' },
  { label: 'Animais', icon: '🐾', color: 'bg-teal-100 text-teal-700' },
  { label: 'Presentes', icon: '🎁', color: 'bg-rose-100 text-rose-700' },
  { label: 'Outros', icon: '💳', color: 'bg-gray-100 text-gray-700' },
];

const DEFAULT_COLORS: Record<string, string> = {
  'Alimentação': '#10B981',
  'Transporte': '#F97316',
  'Saúde': '#EF4444',
  'Lazer': '#8B5CF6',
  'Casa': '#3B82F6',
  'Educação': '#EC4899',
  'Roupas': '#F59E0B',
  'Assinaturas': '#06B6D4',
  'Animais': '#14B8A6',
  'Presentes': '#F43F5E',
  'Outros': '#6B7280',
};

const EMOJIS = ['🍔', '🚗', '🏥', '🎮', '🏠', '📚', '👕', '📺', '🐾', '🎁', '💳', '✈️', '🎵', '💻', '🏋️', '🌿', '🍕', '🐱', '🎬', '📱', '☕', '🎂', '👶', '🔧', '💊', '🎓', '🏪', '⚡', '💼', '🎪'];

const PALETTE = [
  '#10B981', '#F97316', '#EF4444', '#8B5CF6', '#3B82F6',
  '#EC4899', '#F59E0B', '#06B6D4', '#14B8A6', '#F43F5E',
  '#84CC16', '#6366F1', '#D946EF', '#0EA5E9', '#EAB308',
];

function getCategoryColors(custom: CategoryMeta[]): Record<string, string> {
  const colors = { ...DEFAULT_COLORS };
  custom.forEach((c, i) => { colors[c.label] = PALETTE[i % PALETTE.length]; });
  return colors;
}

function getAllCategories(custom: CategoryMeta[]): CategoryMeta[] {
  return [...DEFAULT_CATEGORIES, ...custom.filter(c => !DEFAULT_CATEGORIES.some(d => d.label === c.label))];
}

function getCategoryMeta(label: string, custom: CategoryMeta[]): CategoryMeta {
  const all = getAllCategories(custom);
  return all.find(c => c.label === label) || all[all.length - 1];
}

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const [viewFilter, setViewFilter] = useState<'mine' | 'couple'>('mine');

  const [budget, setBudget] = useState('');
  const [savedBudget, setSavedBudget] = useState<number | null>(null);
  const [showBudgetInput, setShowBudgetInput] = useState(false);
  const [budgetUsed, setBudgetUsed] = useState(0);

  const [incomeInput, setIncomeInput] = useState('');
  const [savedIncome, setSavedIncome] = useState(0);
  const [partnerIncome, setPartnerIncome] = useState(0);

  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [showFixedModal, setShowFixedModal] = useState(false);
  const [fixedTotal, setFixedTotal] = useState(0);
  const [newFixed, setNewFixed] = useState<NewFixedExpense>({ description: '', amount: '', category: 'Outros' });
  const [showEditFixedModal, setShowEditFixedModal] = useState(false);
  const [editingFixed, setEditingFixed] = useState<FixedExpense | null>(null);
  const [editFixedAmount, setEditFixedAmount] = useState('');
  const [editFixedDesc, setEditFixedDesc] = useState('');
  const [editFixedCat, setEditFixedCat] = useState('Outros');
  const [editFixedParcels, setEditFixedParcels] = useState('');

  const [newExpense, setNewExpense] = useState<NewExpense>({ description: '', amount: '', category: 'Outros', is_outing: false, is_credit: false });

  const [pushEnabled, setPushEnabled] = useState(Notification?.permission === 'granted');
  const [pushStatusMsg, setPushStatusMsg] = useState('Verificando...');

  const [partnerInput, setPartnerInput] = useState('');
  const [partnerProfile, setPartnerProfile] = useState<Profile | null>(null);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [userDisplayName, setUserDisplayName] = useState('');

  const [myTotal, setMyTotal] = useState(0);
  const [coupleTotal, setCoupleTotal] = useState(0);

  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importResult, setImportResult] = useState<{ bankName: string; count: number; error?: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importIsCredit, setImportIsCredit] = useState(false);
  const [customCategories, setCustomCategories] = useState<CategoryMeta[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryLabel, setNewCategoryLabel] = useState('');
  const [newCategoryEmoji, setNewCategoryEmoji] = useState('');
  const [editingCategoryIndex, setEditingCategoryIndex] = useState<number | null>(null);
  const txRefreshRef = useRef(0);
  const fixedRefreshRef = useRef(0);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const checkInstall = () => {
      const ip = (window as unknown as Record<string, { prompt: Event | null; clear: () => void }>).__installPrompt;
      if (ip && ip.prompt) setShowInstallBanner(true);
    };
    const interval = setInterval(checkInstall, 1000);
    checkInstall();
    return () => clearInterval(interval);
  }, []);

  const handleInstall = async () => {
    const ip = (window as unknown as Record<string, { prompt: Event | null; clear: () => void }>).__installPrompt;
    if (!ip || !ip.prompt) return;
    (ip.prompt as BeforeInstallPromptEvent).prompt();
    const result = await (ip.prompt as BeforeInstallPromptEvent).userChoice;
    if (result.outcome === 'accepted') {
      setShowInstallBanner(false);
      ip.clear();
    }
  };

  useEffect(() => {
    if (!user) return;

    const fetchProfile = async () => {
      setProfileLoading(true);
      try {
        const { data } = await supabase
          .from('profiles')
          .select('display_name, partner_id, budget, income, push_token')
          .eq('id', user.id)
          .single();

        if (data?.display_name) setUserDisplayName(data.display_name);
        if (data?.income) setSavedIncome(parseFloat(data.income) || 0);

        const isDeviceSupported = await isSupported();
        if (!isDeviceSupported) {
          setPushStatusMsg('Erro (Requer HTTPS)');
          setPushEnabled(false);
        } else if (data?.push_token && Notification?.permission === 'granted') {
          setPushStatusMsg('Ativadas ✔️');
          setPushEnabled(true);
        } else if (Notification?.permission === 'denied') {
          setPushStatusMsg('Bloqueadas');
          setPushEnabled(false);
        } else {
          setPushStatusMsg('Clique para ativar');
          setPushEnabled(false);
        }

        let foundBudget = data?.budget ? parseFloat(data.budget) : null;

        if (data?.partner_id) {
          setPartnerId(data.partner_id);
          const { data: partner } = await supabase
            .from('profiles')
            .select('id, display_name, budget, income')
            .eq('id', data.partner_id)
            .single();

          if (partner?.income) setPartnerIncome(parseFloat(partner.income) || 0);

          if (!foundBudget && partner?.budget) {
            foundBudget = parseFloat(partner.budget);
          }
          setPartnerProfile(partner || { id: data.partner_id });
        }
        setSavedBudget(foundBudget);
      } finally {
        setProfileLoading(false);
      }
    };

    fetchProfile();
    fetchCategories();
  }, [user]);

  const fetchCategories = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('categories')
      .select('label, icon')
      .eq('user_id', user.id);
    if (data) {
      setCustomCategories(data.map(c => ({ label: c.label, icon: c.icon, color: 'bg-gray-100 text-gray-700' })));
    }
  };

  const handleAddCategory = async (label: string, icon: string) => {
    if (!user) return;
    const existing = getAllCategories(customCategories);
    if (existing.some(c => c.label.toLowerCase() === label.trim().toLowerCase())) {
      alert('Já existe uma categoria com esse nome.');
      return;
    }
    const { error } = await supabase.from('categories').insert([{ user_id: user.id, label: label.trim(), icon }]);
    if (error) { alert('Erro ao criar categoria: ' + error.message); return; }
    setNewCategoryLabel('');
    setNewCategoryEmoji(EMOJIS[0]);
    await fetchCategories();
  };

  const handleDeleteCategory = async (label: string) => {
    if (!user) return;
    const { error } = await supabase.from('categories').delete().eq('user_id', user.id).eq('label', label);
    if (error) { alert('Erro ao excluir categoria: ' + error.message); return; }
    await fetchCategories();
  };

  const fetchFixedExpenses = async () => {
    if (!user) return;
    const version = ++fixedRefreshRef.current;
    try {
      const ids = viewFilter === 'couple' && partnerId
        ? [user.id, partnerId]
        : [user.id];

      const { data } = await supabase
        .from('fixed_expenses')
        .select('*')
        .in('user_id', ids)
        .order('description');

      if (fixedRefreshRef.current !== version) return;
      const items = (data || []) as FixedExpense[];
      setFixedExpenses(items);
      setFixedTotal(items.reduce((sum, f) => sum + (Number(f.amount) || 0), 0));
    } catch { }
  };

  useEffect(() => {
    if (!user) return;
    fetchTransactions();
    fetchFixedExpenses();
  }, [user, viewFilter, partnerId]);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      loadTransactions();
      fetchFixedExpenses();
    }, 30000);
    return () => clearInterval(interval);
  }, [user, viewFilter, partnerId]);

  const loadTransactions = async () => {
    if (!user) return;
    const version = ++txRefreshRef.current;
    const ids = viewFilter === 'couple' && partnerId
      ? [user.id, partnerId]
      : [user.id];

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .in('account_id', ids)
      .order('date', { ascending: false })
      .limit(50);

    if (error) throw error;
    if (txRefreshRef.current !== version) return;
    setTransactions(data || []);

    const { data: myData } = await supabase
      .from('transactions')
      .select('amount')
      .eq('account_id', user.id);
    if (txRefreshRef.current !== version) return;
    const mySum = (myData || []).reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    setMyTotal(mySum);

    let budgetUsedCalc = 0;

    if (partnerId) {
      const { data: coupleData } = await supabase
        .from('transactions')
        .select('amount, is_outing')
        .in('account_id', [user.id, partnerId]);
      if (txRefreshRef.current !== version) return;

      const coupleSum = (coupleData || []).reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
      budgetUsedCalc = (coupleData || []).filter(t => t.is_outing).reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);

      setCoupleTotal(coupleSum);
    } else {
      const { data: myOutingData } = await supabase
        .from('transactions')
        .select('amount, is_outing')
        .eq('account_id', user.id);
      if (txRefreshRef.current !== version) return;

      budgetUsedCalc = (myOutingData || []).filter(t => t.is_outing).reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
      setCoupleTotal(mySum);
    }

    setBudgetUsed(budgetUsedCalc);
  };

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      await loadTransactions();
    } catch (err) {
      console.error('Erro ao buscar transações:', (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const amount = parseFloat(newExpense.amount.replace(',', '.'));
      if (isNaN(amount) || amount <= 0) throw new Error('Valor inválido');

      const { data, error } = await supabase
        .from('transactions')
        .insert([{
          account_id: user?.id,
          amount,
          description: newExpense.description,
          category: newExpense.category,
          is_outing: newExpense.is_outing,
          is_credit: newExpense.is_credit,
          date: new Date().toISOString()
        }])
        .select();

      if (error) throw error;

      setShowAddModal(false);
      setNewExpense({ description: '', amount: '', category: 'Outros', is_outing: false, is_credit: false });
      await loadTransactions();
      await fetchFixedExpenses();

      if (import.meta.env.PROD && data) {
        fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            account_id: user?.id,
            amount,
            description: newExpense.description,
          })
        }).catch(() => {});
      }
    } catch (err) {
      if (!err.message.includes('isSubmitting')) {
        alert('Erro ao adicionar gasto: ' + (err as Error).message);
        await loadTransactions();
        await fetchFixedExpenses();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!window.confirm('Excluir este gasto?')) return;
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) { alert('Erro ao excluir: ' + error.message); return; }
    await loadTransactions();
    await fetchFixedExpenses();
  };

  const handleSavePartner = async () => {
    if (!partnerInput.trim()) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: user!.id, partner_id: partnerInput.trim() }, { onConflict: 'id' });

      if (error) throw error;

      const { data: partner } = await supabase
        .from('profiles')
        .select('id, display_name')
        .eq('id', partnerInput.trim())
        .single();

      const p: Profile = partner || { id: partnerInput.trim() };
      setPartnerProfile(p);
      setPartnerId(p.id);
      setPartnerInput('');
    } catch (err) {
      alert('Erro ao vincular parceiro: ' + (err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlinkPartner = async () => {
    if (!window.confirm('Deseja desvincular o parceiro?')) return;
    await supabase.from('profiles').update({ partner_id: null }).eq('id', user!.id);
    setPartnerProfile(null);
    setPartnerId(null);
    setViewFilter('mine');
  };

  const handleSaveDisplayName = async (name: string) => {
    if (!name.trim()) return;
    await supabase
      .from('profiles')
      .upsert({ id: user!.id, display_name: name.trim() }, { onConflict: 'id' });
    setUserDisplayName(name.trim());
  };

  const handleSaveBudget = async () => {
    const val = parseFloat(budget);
    if (isNaN(val) || val <= 0) return;

    await supabase
      .from('profiles')
      .upsert({ id: user!.id, budget: val }, { onConflict: 'id' });

    if (partnerId) {
      await supabase
        .from('profiles')
        .upsert({ id: partnerId, budget: val }, { onConflict: 'id' });
    }

    setSavedBudget(val);
    setShowBudgetInput(false);
    setBudget('');
  };

  const handleSaveIncome = async () => {
    const val = parseFloat(incomeInput);
    if (isNaN(val) || val < 0) return;

    await supabase
      .from('profiles')
      .upsert({ id: user!.id, income: val }, { onConflict: 'id' });

    setSavedIncome(val);
    setIncomeInput('');
  };

  const handleRequestPush = async () => {
    try {
      setPushStatusMsg('Gerando token...');
      const token = await requestNotificationPermission();
      if (token) {
        await supabase.from('profiles').upsert({ id: user!.id, push_token: token }, { onConflict: 'id' });
        setPushEnabled(true);
        setPushStatusMsg('Ativadas ✔️');
      } else {
        setPushStatusMsg('Falha no token');
      }
    } catch (err) {
      alert('Erro ao ativar notificações: ' + (err as Error).message);
      setPushStatusMsg('Erro');
    }
  };

  const handleAddFixed = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(newFixed.amount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0 || !newFixed.description.trim()) return;

    const insertData: Record<string, unknown> = {
      user_id: user?.id,
      description: newFixed.description.trim(),
      amount,
      category: newFixed.category,
    };
    if (newFixed.total_parcels) {
      const tp = parseInt(newFixed.total_parcels);
      if (tp > 0) {
        insertData.total_parcels = tp;
        insertData.paid_parcels = 1;
      }
    }

    const { error } = await supabase.from('fixed_expenses').insert([insertData]);

    if (error) { alert('Erro ao adicionar gasto fixo: ' + error.message); return; }

    setShowFixedModal(false);
    setNewFixed({ description: '', amount: '', category: 'Outros' });
    await fetchFixedExpenses();
  };

  const handleDeleteFixed = async (id: string) => {
    if (!window.confirm('Excluir este gasto fixo?')) return;
    const { error } = await supabase.from('fixed_expenses').delete().eq('id', id);
    if (error) { alert('Erro ao excluir: ' + error.message); return; }
    await fetchFixedExpenses();
  };

  const handleAdvanceParcel = async (f: FixedExpense) => {
    const next = (f.paid_parcels || 1) + 1;
    if (next > (f.total_parcels || 0)) {
      if (window.confirm('Última parcela! Deseja marcar este gasto como concluído e removê-lo da lista?')) {
        const { error } = await supabase.from('fixed_expenses').delete().eq('id', f.id);
        if (error) alert('Erro: ' + error.message);
        await fetchFixedExpenses();
      }
      return;
    }
    const { error } = await supabase.from('fixed_expenses').update({ paid_parcels: next }).eq('id', f.id);
    if (error) { alert('Erro ao adiantar parcela: ' + error.message); return; }
    await fetchFixedExpenses();
  };

  const handleStartEditFixed = (f: FixedExpense) => {
    setEditingFixed(f);
    setEditFixedDesc(f.description);
    setEditFixedAmount(String(f.amount));
    setEditFixedCat(f.category);
    setEditFixedParcels(f.total_parcels ? String(f.total_parcels) : '');
    setShowEditFixedModal(true);
  };

  const handleSaveEditFixed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFixed) return;
    const amount = parseFloat(editFixedAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0 || !editFixedDesc.trim()) return;

    const updateData: Record<string, unknown> = {
      description: editFixedDesc.trim(),
      amount,
      category: editFixedCat,
    };
    if (editFixedParcels) {
      const tp = parseInt(editFixedParcels);
      if (tp > 0) updateData.total_parcels = tp;
    } else {
      updateData.total_parcels = null;
      updateData.paid_parcels = null;
    }

    const { error } = await supabase.from('fixed_expenses').update(updateData).eq('id', editingFixed.id);
    if (error) { alert('Erro ao editar: ' + error.message); return; }

    setShowEditFixedModal(false);
    setEditingFixed(null);
    await fetchFixedExpenses();
  };

  const handleImportCSV = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const result = parseCSV(text);

      if (result.transactions.length === 0) {
        setImportResult({ bankName: result.bankName, count: 0, error: 'Nenhum gasto encontrado no arquivo.' });
        return;
      }

      const rows = result.transactions.map(t => ({
        account_id: user?.id,
        amount: t.amount,
        description: t.description,
        category: t.category,
        account_provider: t.account_provider,
        date: t.date,
        is_outing: false,
        is_credit: importIsCredit,
      }));

      const { error } = await supabase.from('transactions').insert(rows);
      if (error) throw error;

      setImportResult({ bankName: result.bankName, count: result.totalImported });
      await loadTransactions();
      await fetchFixedExpenses();
    } catch (err) {
      setImportResult({ bankName: '?', count: 0, error: (err as Error).message });
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const displayName = userDisplayName || user?.email?.split('@')[0] || 'Usuário';
  const partnerName = partnerProfile?.display_name || (partnerProfile?.id ? `${partnerProfile.id.substring(0, 8)}...` : null);
  const shownTotal = viewFilter === 'couple' ? coupleTotal : myTotal;
  const budgetUsedPct = savedBudget ? Math.min((budgetUsed / savedBudget) * 100, 100) : 0;
  const budgetRemaining = savedBudget ? savedBudget - budgetUsed : null;

  const totalIncome = viewFilter === 'couple' ? savedIncome + partnerIncome : savedIncome;
  const liquidIncome = totalIncome - fixedTotal;
  const finalBalance = liquidIncome - shownTotal;

  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const now = new Date();
  const monthYear = monthNames[now.getMonth()] + ' de ' + now.getFullYear();

  const catTotalsMap: Record<string, number> = {};
  const currentMonthTx = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  currentMonthTx.forEach(t => {
    const cat = t.category || 'Outros';
    catTotalsMap[cat] = (catTotalsMap[cat] || 0) + (Number(t.amount) || 0);
  });
  fixedExpenses.forEach(f => {
    const cat = f.category || 'Outros';
    catTotalsMap[cat] = (catTotalsMap[cat] || 0) + (Number(f.amount) || 0);
  });
  const categoryColors = getCategoryColors(customCategories);
  const monthTotal = Object.values(catTotalsMap).reduce((a, b) => a + b, 0);
  const donutSegments = Object.entries(catTotalsMap)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([label, value]) => ({
      label,
      value,
      color: categoryColors[label] || '#6B7280',
    }));

  return (
    <div className="min-h-screen bg-[#F0EBFF]">
      <div className="max-w-md mx-auto pb-28">

        {/* Header */}
        <header className="bg-gradient-to-b from-[#7C3AED] to-[#6D28D9] pt-14 pb-7 px-6 rounded-b-[2.5rem] shadow-xl relative">
          <div className="flex justify-between items-center mb-2">
            <div>
              <p className="text-white/70 text-xs font-medium">Olá,</p>
              <h1 className="text-xl font-bold text-white">{displayName}</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRequestPush}
                className="w-9 h-9 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
              >
                {pushEnabled ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
              </button>

              <div className="relative" ref={profileMenuRef}>
                <button
                  onClick={() => setShowProfileMenu(v => !v)}
                  className="w-9 h-9 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white font-bold text-sm hover:bg-white/30 transition-colors"
                >
                  {displayName.charAt(0).toUpperCase()}
                </button>

                {showProfileMenu && (
                  <div className="absolute right-0 mt-3 w-68 bg-white rounded-2xl shadow-xl z-50 overflow-hidden border border-gray-100">
                    <div className="p-4 bg-purple-50 border-b border-gray-100">
                      <p className="text-xs text-gray-500">Logado como</p>
                      <p className="text-sm font-semibold text-gray-900 truncate">{user?.email}</p>
                    </div>
                    <div className="p-4 border-b border-gray-100">
                      <p className="text-xs text-gray-500 mb-2">Seu apelido no app</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          defaultValue={userDisplayName}
                          placeholder="Ex: Raylson"
                          id="display-name-input"
                          className="flex-1 bg-gray-100 p-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                        />
                        <button
                          onClick={() => {
                            const val = (document.getElementById('display-name-input') as HTMLInputElement).value;
                            handleSaveDisplayName(val);
                            setShowProfileMenu(false);
                          }}
                          className="bg-[#7C3AED] text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-[#6D28D9]"
                        >
                          Salvar
                        </button>
                      </div>
                    </div>
                    <div className="p-4 border-b border-gray-100">
                      <p className="text-xs text-gray-500 mb-2">Renda Mensal</p>
                      <div className="flex flex-col gap-2">
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-gray-500 text-sm">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Ex: 5000"
                            value={incomeInput}
                            onChange={e => setIncomeInput(e.target.value)}
                            className="w-full bg-gray-100 p-2 pl-9 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                          />
                        </div>
                        {incomeInput && (
                          <button
                            onClick={handleSaveIncome}
                            className="w-full bg-[#7C3AED] text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-[#6D28D9]"
                          >
                            Salvar Renda
                          </button>
                        )}
                        {savedIncome > 0 && <p className="text-xs font-semibold text-green-600 mt-1">Registrado: R$ {savedIncome.toFixed(2).replace('.', ',')}</p>}
                      </div>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-3 p-4 text-sm text-red-500 font-semibold hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sair da conta
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <p className="text-white/50 text-[10px]">{pushStatusMsg}</p>
        </header>

        {/* Donut Chart Card */}
        <div className="mx-4 -mt-7 bg-white rounded-2xl shadow-lg p-5 mb-4">
          <div className="flex justify-center mb-3">
            <DonutChart segments={donutSegments} total={monthTotal} monthYear={monthYear} />
          </div>
          <div className="border-t border-gray-100 pt-3 space-y-1.5">
            {donutSegments.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-2">Nenhum gasto este mês</p>
            ) : (
              donutSegments.map(seg => (
                <div key={seg.label} className="flex items-center justify-between py-0.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                    <span className="text-sm text-gray-600">{seg.label}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    R$ {seg.value.toFixed(2).replace('.', ',')}
                  </span>
                </div>
              ))
            )}
          </div>
          <button
            onClick={() => { setNewCategoryLabel(''); setNewCategoryEmoji(EMOJIS[0]); setEditingCategoryIndex(null); setShowCategoryModal(true); }}
            className="mt-3 w-full text-xs text-[#7C3AED] font-semibold hover:text-[#6D28D9] transition-colors"
          >
            + Gerenciar Categorias
          </button>
        </div>

        {/* Quick Stats */}
        <div className="mx-4 grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white rounded-xl shadow-sm p-3">
            <p className="text-[10px] text-gray-400 mb-0.5">Total</p>
            <p className="text-base font-bold text-gray-900">R$ {shownTotal.toFixed(2).replace('.', ',')}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-3">
            <p className="text-[10px] text-gray-400 mb-0.5">Renda Líq.</p>
            <p className="text-base font-bold text-green-600">R$ {liquidIncome.toFixed(2).replace('.', ',')}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-3">
            <p className="text-[10px] text-gray-400 mb-0.5">Saldo</p>
            <p className="text-base font-bold" style={{ color: finalBalance >= 0 ? '#16A34A' : '#DC2626' }}>
              R$ {finalBalance.toFixed(2).replace('.', ',')}
            </p>
          </div>
        </div>

        {/* View Filter Tabs & Bank Connect */}
        <div className="mx-4 flex gap-2 mb-4">
          <div className="flex bg-white/80 backdrop-blur-sm rounded-xl p-1 gap-1 flex-1 shadow-sm border border-gray-100">
            <button
              onClick={() => setViewFilter('mine')}
              className={(viewFilter === 'mine' ? 'bg-[#7C3AED] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700') + ' flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all'}
            >
              <UserIcon className="w-4 h-4" />
              Meus Gastos
            </button>
            <button
              onClick={() => setViewFilter('couple')}
              disabled={!partnerProfile}
              className={(viewFilter === 'couple' ? 'bg-[#7C3AED] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700') + ' flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40'}
            >
              <Users className="w-4 h-4" />
              Casal
            </button>
          </div>
          <button
            onClick={() => setShowImportModal(true)}
            title="Importar Extrato CSV"
            className="w-11 h-11 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center text-gray-500 hover:text-[#7C3AED] hover:border-purple-200 transition-colors shrink-0"
          >
            <Upload className="w-4 h-4" />
          </button>
        </div>

        {/* Budget Section */}
        {savedBudget !== null ? (
          <div className="mx-4 bg-white rounded-xl shadow-sm p-4 mb-4">
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs text-gray-500">Limite do Mês</p>
              <button onClick={() => setShowBudgetInput(v => !v)} className="text-[10px] text-[#7C3AED] font-semibold">Editar</button>
            </div>
            <div className="flex justify-between text-xs text-gray-600 mb-1.5">
              <span>R$ {budgetUsed.toFixed(2).replace('.', ',')} / R$ {savedBudget.toFixed(2).replace('.', ',')}</span>
              <span className={'font-bold ' + (budgetRemaining! < 0 ? 'text-red-500' : 'text-green-600')}>
                {budgetRemaining! < 0 ? '-' : ''}R$ {Math.abs(budgetRemaining!).toFixed(2).replace('.', ',')}
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className={'h-2 rounded-full transition-all ' + (budgetUsedPct >= 100 ? 'bg-red-500' : budgetUsedPct >= 80 ? 'bg-orange-400' : 'bg-[#7C3AED]')}
                style={{ width: budgetUsedPct + '%' }}
              />
            </div>
            {showBudgetInput && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-2.5 text-gray-500 text-sm">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Limite mensal"
                    value={budget}
                    onChange={e => setBudget(e.target.value)}
                    className="w-full bg-gray-100 p-2 pl-9 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                  />
                </div>
                <button onClick={handleSaveBudget} className="bg-[#7C3AED] text-white px-4 py-2 rounded-lg text-sm font-bold">Salvar</button>
              </div>
            )}
          </div>
        ) : (
          <div className="mx-4 bg-white rounded-xl shadow-sm p-4 mb-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">Limite do Mês</p>
              <button onClick={() => setShowBudgetInput(v => !v)} className="text-xs text-[#7C3AED] font-semibold">+ Definir Limite</button>
            </div>
            {showBudgetInput && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-2.5 text-gray-500 text-sm">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Limite mensal"
                    value={budget}
                    onChange={e => setBudget(e.target.value)}
                    className="w-full bg-gray-100 p-2 pl-9 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                  />
                </div>
                <button onClick={handleSaveBudget} className="bg-[#7C3AED] text-white px-4 py-2 rounded-lg text-sm font-bold">Salvar</button>
              </div>
            )}
          </div>
        )}

        {/* Install PWA Banner */}
        {showInstallBanner && (
          <div className="mx-4 bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] rounded-xl p-4 mb-4 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📲</span>
              <div>
                <p className="text-white font-bold text-sm">Instalar App</p>
                <p className="text-white/80 text-xs">Adicione à tela inicial</p>
              </div>
            </div>
            <button onClick={handleInstall} className="bg-white text-[#7C3AED] font-bold px-4 py-2 rounded-full text-xs hover:bg-white/90 transition-colors">Instalar</button>
          </div>
        )}

        {/* Partner Section */}
        {profileLoading ? (
          <div className="mx-4 bg-white rounded-xl shadow-sm p-4 mb-4 flex gap-3 animate-pulse">
            <div className="w-10 h-10 bg-gray-200 rounded-full shrink-0"></div>
            <div className="flex-1 space-y-2 py-1">
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        ) : !partnerProfile ? (
          <div className="mx-4 bg-white rounded-xl shadow-sm p-4 mb-4 border-2 border-dashed border-purple-200">
            <div className="flex items-center gap-2 mb-3">
              <Heart className="w-4 h-4 text-[#7C3AED]" />
              <p className="text-sm font-semibold text-gray-900">Sem parceiro vinculado</p>
            </div>
            <p className="text-xs text-gray-500 mb-3">Cole o ID do seu parceiro para compartilhar gastos.</p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="ID do parceiro"
                value={partnerInput}
                onChange={(e) => setPartnerInput(e.target.value)}
                className="flex-1 bg-gray-100 p-2 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
              <button onClick={handleSavePartner} disabled={isSubmitting} className="bg-[#7C3AED] text-white px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-60">
                Vincular
              </button>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-1">Seu ID:</p>
              <div className="flex items-center gap-2">
                <code className="bg-gray-100 p-1.5 rounded text-xs flex-1 break-all">{user?.id}</code>
                <button onClick={() => navigator.clipboard.writeText(user?.id || '')} className="text-xs text-[#7C3AED] font-bold whitespace-nowrap">Copiar</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 mb-4 flex items-center justify-between border border-purple-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#7C3AED]/10 rounded-full flex items-center justify-center">
                <Heart className="w-5 h-5 text-[#7C3AED]" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Pareado com</p>
                <p className="text-sm font-bold text-gray-900">{partnerName}</p>
              </div>
            </div>
            <button onClick={handleUnlinkPartner} className="text-xs text-red-400 font-semibold hover:text-red-600">Desvincular</button>
          </div>
        )}

        {/* Income Tags */}
        {totalIncome > 0 && (
          <div className="mx-4 mb-4 flex gap-2 items-center flex-wrap">
            <span className="text-xs bg-white px-2.5 py-1 rounded-lg shadow-sm text-gray-700 font-medium">
              Renda: R$ {totalIncome.toFixed(2).replace('.', ',')}
            </span>
            {fixedTotal > 0 && (
              <span className="text-xs bg-red-50 text-red-700 px-2.5 py-1 rounded-lg shadow-sm font-medium">
                Fixos: -R$ {fixedTotal.toFixed(2).replace('.', ',')}
              </span>
            )}
          </div>
        )}

        {/* Fixed Expenses Section */}
        <div className="mx-4 bg-white rounded-xl shadow-sm p-4 mb-4">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm font-semibold text-gray-900">
              Gastos Fixos {fixedTotal > 0 && <span className="text-red-500 font-bold">R$ {fixedTotal.toFixed(2).replace('.', ',')}</span>}
            </p>
            <button onClick={() => setShowFixedModal(true)} className="text-xs text-[#7C3AED] font-bold hover:underline">
              + Adicionar
            </button>
          </div>

          {fixedExpenses.length === 0 ? (
            <p className="text-xs text-gray-400">Nenhum gasto fixo cadastrado.</p>
          ) : (
            <div className="space-y-1.5">
              {fixedExpenses.map(f => {
                const cat = getCategoryMeta(f.category, customCategories);
                const hasParcels = f.total_parcels && f.total_parcels > 0;
                return (
                  <div key={f.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <div className={'w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 ' + cat.color}>
                      {cat.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{f.description}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-gray-500">{cat.label}</p>
                        {hasParcels && (
                          <span className="flex items-center gap-1 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">
                            {(f.paid_parcels || 0)}/{f.total_parcels}
                            {(f.paid_parcels || 0) < f.total_parcels! && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleAdvanceParcel(f); }}
                                className="text-purple-500 hover:text-purple-700 font-bold leading-none"
                                title="Adiantar parcela"
                              >
                                +1
                              </button>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <p className="font-bold text-red-500 text-sm">
                        -R$ {(Number(f.amount) || 0).toFixed(2).replace('.', ',')}
                      </p>
                      <button onClick={() => handleStartEditFixed(f)} className="text-gray-300 hover:text-purple-400 transition-colors" title="Editar">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                      </button>
                      <button onClick={() => handleDeleteFixed(f.id)} className="text-gray-300 hover:text-red-400 transition-colors" title="Excluir">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Transaction List */}
        <section className="mx-4 mb-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-sm text-gray-700">
              {viewFilter === 'couple' ? 'Gastos do Casal' : 'Meus Gastos'}
            </h3>
            <span className="text-[10px] text-gray-400">{transactions.length} itens</span>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="bg-white p-4 rounded-xl shadow-sm flex items-center gap-3 animate-pulse">
                  <div className="w-10 h-10 bg-gray-200 rounded-full shrink-0"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                  <div className="h-4 bg-gray-200 rounded w-16"></div>
                </div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-xl shadow-sm">
              <p className="text-gray-400">Nenhum gasto registrado.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map(t => {
                const cat = getCategoryMeta(t.category, customCategories);
                const isOwn = t.account_id === user?.id;
                return (
                  <div key={t.id} className="bg-white p-4 rounded-xl shadow-sm flex items-center gap-3">
                    <div className={'w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 ' + cat.color}>
                      {cat.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate text-sm">{t.description || 'Gasto sem nome'}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <p className="text-xs text-gray-400">
                          {t.date ? new Date(t.date).toLocaleDateString('pt-BR') : 'Hoje'}
                        </p>
                        {viewFilter === 'couple' && !isOwn && (
                          <span className="text-[10px] bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded-full font-medium">
                            {partnerName?.split(' ')[0] || 'Parceiro'}
                          </span>
                        )}
                        {t.account_provider && (
                          <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
                            {t.account_provider}
                          </span>
                        )}
                        {t.is_credit && (
                          <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">
                            Crédito
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className="font-bold text-red-500 text-sm">
                        - R$ {(Number(t.amount) || 0).toFixed(2).replace('.', ',')}
                      </p>
                      {isOwn && (
                        <button onClick={() => handleDeleteExpense(t.id)} className="text-gray-300 hover:text-red-400 transition-colors" title="Excluir">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-6 right-6 bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] text-white font-semibold py-3.5 px-6 rounded-full shadow-xl hover:shadow-2xl hover:from-[#6D28D9] hover:to-[#5B21B6] transition-all active:scale-95 transform cursor-pointer z-40"
      >
        + Novo Gasto
      </button>

      {/* Add Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center p-4 z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Novo Gasto</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-500 hover:text-gray-900">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Descrição</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Mercado"
                  value={newExpense.description}
                  onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                  className="w-full bg-gray-50 p-4 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Valor</label>
                <div className="relative">
                  <span className="absolute left-4 top-4 text-gray-500 font-semibold">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0,00"
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                    className="w-full bg-gray-50 p-4 pl-12 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Categoria</label>
                <div className="grid grid-cols-4 gap-2">
                  {getAllCategories(customCategories).map(cat => (
                    <button
                      key={cat.label}
                      type="button"
                      onClick={() => setNewExpense({ ...newExpense, category: cat.label })}
                      className={(newExpense.category === cat.label ? 'border-[#7C3AED] bg-purple-50' : 'border-transparent bg-gray-50 hover:bg-gray-100') + ' flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all'}
                    >
                      <span className="text-xl">{cat.icon}</span>
                      <span className="text-xs text-center leading-tight">{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-4 mb-4">
                <div className="flex-1 flex items-center gap-3 bg-purple-50 p-4 rounded-xl border border-purple-200">
                  <input
                    type="checkbox"
                    id="is_outing_checkbox"
                    checked={newExpense.is_outing}
                    onChange={(e) => setNewExpense({ ...newExpense, is_outing: e.target.checked })}
                    className="w-5 h-5 text-[#7C3AED] rounded bg-white"
                  />
                  <label htmlFor="is_outing_checkbox" className="text-sm font-semibold text-gray-900 cursor-pointer">Limite Saídas?</label>
                </div>
                <div className="flex-1 flex items-center gap-3 bg-purple-50 p-4 rounded-xl border border-purple-200">
                  <input
                    type="checkbox"
                    id="is_credit_checkbox"
                    checked={newExpense.is_credit}
                    onChange={(e) => setNewExpense({ ...newExpense, is_credit: e.target.checked })}
                    className="w-5 h-5 text-[#7C3AED] rounded bg-white"
                  />
                  <label htmlFor="is_credit_checkbox" className="text-sm font-semibold text-gray-900 cursor-pointer">Foi no Crédito?</label>
                </div>
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] text-white font-bold py-4 rounded-full mt-2 hover:from-[#6D28D9] hover:to-[#5B21B6] transition-colors flex justify-center disabled:opacity-70"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar Gasto'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Import CSV Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center p-4 z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Importar Extrato</h3>
              <button onClick={() => { setShowImportModal(false); setImportResult(null); setImportIsCredit(false); }} className="text-gray-500 hover:text-gray-900">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Exporte o extrato CSV do seu banco e faça upload aqui. Formatos suportados:</p>
              <div className="flex gap-2 flex-wrap">
                <span className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded-full font-semibold">Santander</span>
                <span className="text-xs bg-orange-100 text-orange-700 px-3 py-1 rounded-full font-semibold">Inter</span>
                <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-semibold">Mercado Pago</span>
                <span className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-full font-semibold">Outros CSV</span>
              </div>
              <label className="block mt-4">
                <div className={(importing ? 'border-gray-300 bg-gray-50' : 'border-purple-300 hover:border-[#7C3AED] hover:bg-purple-50') + ' border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors'}>
                  {importing ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 animate-spin text-[#7C3AED]" />
                      <p className="text-sm text-gray-500">Importando...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-8 h-8 text-[#7C3AED]" />
                      <p className="text-sm font-semibold text-gray-900">Clique para selecionar o CSV</p>
                      <p className="text-xs text-gray-400">ou arraste o arquivo aqui</p>
                    </div>
                  )}
                </div>
                <input type="file" accept=".csv,.txt,.ofx" onChange={handleImportCSV} className="hidden" disabled={importing} />
              </label>
              <div className="flex items-center gap-3 mt-4 bg-purple-50 p-3 rounded-lg border border-purple-200">
                <input
                  type="checkbox"
                  id="import_is_credit"
                  checked={importIsCredit}
                  onChange={(e) => setImportIsCredit(e.target.checked)}
                  className="w-5 h-5 text-[#7C3AED] rounded bg-white border-purple-300"
                />
                <label htmlFor="import_is_credit" className="text-sm font-semibold text-purple-900 cursor-pointer select-none flex-1">
                  💳 Este extrato é de uma Fatura de Cartão de Crédito?
                </label>
              </div>
              {importResult && (
                <div className={'p-4 rounded-xl text-sm ' + (importResult.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700')}>
                  {importResult.error ? (
                    <p>❌ Erro: {importResult.error}</p>
                  ) : (
                    <p>✅ <strong>{importResult.count}</strong> gastos importados do <strong>{importResult.bankName}</strong>!</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fixed Expense Modal */}
      {showFixedModal && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center p-4 z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Novo Gasto Fixo</h3>
              <button onClick={() => { setShowFixedModal(false); setNewFixed({ description: '', amount: '', category: 'Outros' }); }} className="text-gray-500 hover:text-gray-900">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAddFixed} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Descrição</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Aluguel"
                  value={newFixed.description}
                  onChange={(e) => setNewFixed({ ...newFixed, description: e.target.value })}
                  className="w-full bg-gray-50 p-4 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Valor</label>
                <div className="relative">
                  <span className="absolute left-4 top-4 text-gray-500 font-semibold">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0,00"
                    value={newFixed.amount}
                    onChange={(e) => setNewFixed({ ...newFixed, amount: e.target.value })}
                    className="w-full bg-gray-50 p-4 pl-12 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Categoria</label>
                <div className="grid grid-cols-4 gap-2">
                  {getAllCategories(customCategories).map(cat => (
                    <button
                      key={cat.label}
                      type="button"
                      onClick={() => setNewFixed({ ...newFixed, category: cat.label })}
                      className={(newFixed.category === cat.label ? 'border-[#7C3AED] bg-purple-50' : 'border-transparent bg-gray-50 hover:bg-gray-100') + ' flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all'}
                    >
                      <span className="text-xl">{cat.icon}</span>
                      <span className="text-xs text-center leading-tight">{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 bg-purple-50 p-3 rounded-xl border border-purple-200">
                <input
                  type="checkbox"
                  id="fixed_has_parcels"
                  checked={!!newFixed.total_parcels}
                  onChange={(e) => setNewFixed({ ...newFixed, total_parcels: e.target.checked ? '1' : '' })}
                  className="w-5 h-5 text-[#7C3AED] rounded bg-white"
                />
                <label htmlFor="fixed_has_parcels" className="text-sm font-semibold text-gray-900 cursor-pointer flex-1">
                  Tem parcelas?
                </label>
              </div>
              {newFixed.total_parcels && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Total de Parcelas</label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="Ex: 48"
                    value={newFixed.total_parcels}
                    onChange={(e) => setNewFixed({ ...newFixed, total_parcels: e.target.value })}
                    className="w-full bg-gray-50 p-4 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                  />
                </div>
              )}
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] text-white font-bold py-4 rounded-full mt-2 hover:from-[#6D28D9] hover:to-[#5B21B6] transition-colors"
              >
                Adicionar Gasto Fixo
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Fixed Expense Modal */}
      {showEditFixedModal && editingFixed && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center p-4 z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Editar Gasto Fixo</h3>
              <button onClick={() => { setShowEditFixedModal(false); setEditingFixed(null); }} className="text-gray-500 hover:text-gray-900">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSaveEditFixed} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Descrição</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Aluguel"
                  value={editFixedDesc}
                  onChange={(e) => setEditFixedDesc(e.target.value)}
                  className="w-full bg-gray-50 p-4 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Valor</label>
                <div className="relative">
                  <span className="absolute left-4 top-4 text-gray-500 font-semibold">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0,00"
                    value={editFixedAmount}
                    onChange={(e) => setEditFixedAmount(e.target.value)}
                    className="w-full bg-gray-50 p-4 pl-12 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Categoria</label>
                <div className="grid grid-cols-4 gap-2">
                  {getAllCategories(customCategories).map(cat => (
                    <button
                      key={cat.label}
                      type="button"
                      onClick={() => setEditFixedCat(cat.label)}
                      className={(editFixedCat === cat.label ? 'border-[#7C3AED] bg-purple-50' : 'border-transparent bg-gray-50 hover:bg-gray-100') + ' flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all'}
                    >
                      <span className="text-xl">{cat.icon}</span>
                      <span className="text-xs text-center leading-tight">{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 bg-purple-50 p-3 rounded-xl border border-purple-200">
                <input
                  type="checkbox"
                  id="edit_fixed_has_parcels"
                  checked={!!editFixedParcels}
                  onChange={(e) => setEditFixedParcels(e.target.checked ? String(editingFixed.total_parcels || 1) : '')}
                  className="w-5 h-5 text-[#7C3AED] rounded bg-white"
                />
                <label htmlFor="edit_fixed_has_parcels" className="text-sm font-semibold text-gray-900 cursor-pointer flex-1">
                  Tem parcelas?
                </label>
              </div>
              {editFixedParcels && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Total de Parcelas</label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="Ex: 48"
                    value={editFixedParcels}
                    onChange={(e) => setEditFixedParcels(e.target.value)}
                    className="w-full bg-gray-50 p-4 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                  />
                </div>
              )}
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] text-white font-bold py-4 rounded-full mt-2 hover:from-[#6D28D9] hover:to-[#5B21B6] transition-colors"
              >
                Salvar Alterações
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Category Management Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center p-4 z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Gerenciar Categorias</h3>
              <button onClick={() => setShowCategoryModal(false)} className="text-gray-500 hover:text-gray-900">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Existing custom categories */}
            {customCategories.length > 0 && (
              <div className="mb-4 space-y-2">
                <p className="text-xs text-gray-500 font-semibold">Suas categorias personalizadas:</p>
                {customCategories.map((cat, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-gray-50 p-3 rounded-xl">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{cat.icon}</span>
                      <span className="text-sm font-medium text-gray-900">{cat.label}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteCategory(cat.label)}
                      className="text-red-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new category form */}
            <div className="border-t border-gray-100 pt-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">
                {editingCategoryIndex !== null ? 'Editar categoria' : 'Nova categoria'}
              </p>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Nome da categoria"
                  value={newCategoryLabel}
                  onChange={e => setNewCategoryLabel(e.target.value)}
                  className="w-full bg-gray-50 p-3 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                />
                <div>
                  <p className="text-xs text-gray-500 mb-2">Escolha um ícone:</p>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                    {EMOJIS.map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setNewCategoryEmoji(emoji)}
                        className={'w-9 h-9 flex items-center justify-center text-lg rounded-lg border-2 transition-all ' + (newCategoryEmoji === emoji ? 'border-[#7C3AED] bg-purple-50' : 'border-transparent hover:bg-gray-100')}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAddCategory(newCategoryLabel, newCategoryEmoji)}
                    disabled={!newCategoryLabel.trim()}
                    className="flex-1 bg-[#7C3AED] text-white font-semibold py-3 rounded-xl text-sm hover:bg-[#6D28D9] transition-colors disabled:opacity-50"
                  >
                    Adicionar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
