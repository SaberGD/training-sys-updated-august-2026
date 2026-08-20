
import React, { useState, useEffect } from 'react';
import { User, LabelDefinition } from '../types';
import Layout from '../components/Layout';
import { subscribeToCollection, saveLabelDefinition, deleteLabelDefinitionWithLog } from '../services/firestore';
import { Plus, Trash2, Tag, Palette, Edit2, CheckCircle2, XCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const Labels: React.FC<{ user: User }> = ({ user }) => {
  const [labels, setLabels] = useState<LabelDefinition[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<{ id?: string; name: string; color: string; description: string; visibleOnScreen: boolean }>({ 
    name: '', 
    color: '#3b82f6', 
    description: '',
    visibleOnScreen: true 
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);

  const { lang, t } = useLanguage();
  const isAdmin = ['admin', 'coordinator', 'team_leader'].includes(user.role);

  useEffect(() => {
    return subscribeToCollection<LabelDefinition>('labelDefinitions', setLabels);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      setIsSubmitting(true);
      const payload: Partial<LabelDefinition> = {
        name: formData.name,
        color: formData.color,
        description: formData.description,
        visibleOnScreen: formData.visibleOnScreen
      };
      if (editingLabelId) {
        payload.id = editingLabelId;
      }
      await saveLabelDefinition(payload, user);
      setIsModalOpen(false);
      resetForm();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditInit = (label: LabelDefinition) => {
    setEditingLabelId(label.id);
    setFormData({
      id: label.id,
      name: label.name,
      color: label.color,
      description: label.description || '',
      visibleOnScreen: label.visibleOnScreen !== false // default to true if undefined
    });
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({ name: '', color: '#3b82f6', description: '', visibleOnScreen: true });
    setEditingLabelId(null);
  };

  const handleDelete = async (label: LabelDefinition) => {
    const confirmMsg = lang === 'ar'
      ? `هل أنت متأكد من حذف الوسم "${label.name}"؟`
      : `Are you sure you want to delete the label "${label.name}"?`;
    if (!confirm(confirmMsg)) return;

    try {
      await deleteLabelDefinitionWithLog(label.id, label.name, user);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <Layout user={user}>
      <div className="mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <div className={lang === 'ar' ? 'text-right' : 'text-left'}>
          <h1 className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white mb-2 uppercase">
            {lang === 'ar' ? 'بطاقات ومؤشرات المتابعة' : 'Labels Management'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium font-mono text-xs uppercase tracking-widest">
            {lang === 'ar' ? 'تعريف وتخصيص بطاقات المتابعة والوسوم الملونة للطلاب' : 'Define available labels for the tracking system'}
          </p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary-600/20 transition-all flex items-center gap-2 shrink-0 select-none"
          >
            <Plus size={16} /> {lang === 'ar' ? 'إضافة وسم جديد' : 'New Label'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        {labels.map(label => {
          const isVisible = label.visibleOnScreen !== false;
          return (
            <div key={label.id} className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm group flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg"
                    style={{ backgroundColor: label.color }}
                  >
                    <Tag size={18} />
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => handleEditInit(label)}
                        className="p-2 text-slate-400 hover:text-indigo-500 transition-colors"
                        title={lang === 'ar' ? 'تعديل البيانات' : 'Edit labels info'}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(label)}
                        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                        title={lang === 'ar' ? 'حذف' : 'Delete'}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1 uppercase tracking-tight">{label.name}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 leading-relaxed mb-4">{label.description || (lang === 'ar' ? 'لا يوجد وصف مضاف.' : 'No description provided.')}</p>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-bold">
                <span className="text-slate-400 font-medium">
                  {lang === 'ar' ? 'حالة الظهور بالشاشة:' : 'Screen Visibility:'}
                </span>
                <span className={`flex items-center gap-1 ${isVisible ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                  {isVisible ? (
                    <>
                      <CheckCircle2 size={14} />
                      {lang === 'ar' ? 'مرئي للعامة' : 'Visible'}
                    </>
                  ) : (
                    <>
                      <XCircle size={14} />
                      {lang === 'ar' ? 'مخفي للخصوصية' : 'Hidden'}
                    </>
                  )}
                </span>
              </div>
            </div>
          );
        })}
        {labels.length === 0 && (
          <div className="col-span-full py-20 text-center">
            <Tag size={48} className="mx-auto text-slate-300 mb-4" />
            <h2 className="text-xl font-bold text-slate-400 uppercase tracking-widest">{lang === 'ar' ? 'لم يتم العثور على أي وسوم بعد' : 'No labels defined yet'}</h2>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden animate-slide-up text-right">
            <div className={`p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50 ${lang === 'ar' ? 'flex-row' : 'flex-row-reverse'}`}>
               <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="w-10 h-10 flex items-center justify-center rounded-2xl bg-slate-200 dark:bg-slate-800 text-slate-500 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">✕</button>
               <div className={lang === 'ar' ? 'text-right' : 'text-left'}>
                 <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-widest">
                   {editingLabelId ? (lang === 'ar' ? 'تعديل بيانات الوسم' : 'Edit Label') : (lang === 'ar' ? 'إضافة وسم جديد' : 'New Label')}
                 </h2>
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">
                   {lang === 'ar' ? 'تحديد الخصائص والخيارات الخاصة بالوسوم' : 'Define properties for the label'}
                 </p>
               </div>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block ml-2 mr-2">
                  {lang === 'ar' ? 'اسم الوسم' : 'Label Name'}
                </label>
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs font-bold text-slate-900 dark:text-white"
                  placeholder={lang === 'ar' ? 'مثال: طالب مبادر / متميز' : 'e.g., Active Student'}
                  dir="auto"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block ml-2 mr-2">
                  {lang === 'ar' ? 'اللون الخاص بالبطاقة' : 'Color Picker'}
                </label>
                <div className="flex gap-4 items-center">
                  <input 
                    type="color" 
                    value={formData.color}
                    onChange={e => setFormData({...formData, color: e.target.value})}
                    className="w-14 h-14 bg-transparent cursor-pointer rounded-2xl overflow-hidden border-0 p-0"
                  />
                  <div className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-[10px] font-mono text-slate-500">
                    {formData.color.toUpperCase()}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block ml-2 mr-2">
                  {lang === 'ar' ? 'وصف تفصيلي للبطاقة' : 'Description'}
                </label>
                <textarea 
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs font-bold h-24 resize-none text-slate-900 dark:text-white"
                  placeholder={lang === 'ar' ? 'ما هو الغرض من استخدام هذه البطاقة مع الطلاب...' : 'What is this label for?'}
                  dir="auto"
                />
              </div>

              {/* public visibility screen option requested by the user */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-150 dark:border-slate-850 flex items-center justify-between select-none">
                <div className={lang === 'ar' ? 'text-right' : 'text-left'}>
                  <span className="block text-[11px] font-black text-slate-700 dark:text-slate-300">
                    {lang === 'ar' ? 'عرض الوسم على الشاشات والمحاضرة؟' : 'Show next to Student Name on Screens?'}
                  </span>
                  <span className="block text-[9px] text-slate-400 mt-0.5 leading-relaxed">
                    {lang === 'ar' 
                      ? 'مفيد لإخفاء بطاقات المتابعة الخاصة أثناء مشاركة شاشة المحاضرة للخصوصية' 
                      : 'Helpful to hide internal tracking labels during screen-shares for privacy'}
                  </span>
                </div>
                {/* neat switch indicator */}
                <div 
                  onClick={() => setFormData({...formData, visibleOnScreen: !formData.visibleOnScreen})}
                  className={`w-11 h-6 rounded-full p-1 cursor-pointer transition-all shrink-0 ${formData.visibleOnScreen ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-800'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-all shadow-sm ${formData.visibleOnScreen ? (lang === 'ar' ? '-translate-x-5' : 'translate-x-5') : 'translate-x-0'}`}></div>
                </div>
              </div>

              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary-600/20 transition-all"
              >
                {isSubmitting 
                  ? (editingLabelId ? (lang === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (lang === 'ar' ? 'جاري الإنشاء...' : 'Creating...')) 
                  : (editingLabelId ? (lang === 'ar' ? 'حفظ التعديلات ✅' : 'Save Changes') : (lang === 'ar' ? 'إنشاء الوسم 🚀' : 'Create Label'))}
              </button>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Labels;
