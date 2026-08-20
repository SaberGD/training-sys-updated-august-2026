
import React, { useState, useEffect, useMemo } from 'react';
import * as firestore from 'firebase/firestore';
import { db } from '../firebase';
import { 
  User, Group, MarketingCategory, MarketingResource, MarketingSectionTemplate 
} from '../types';
import { 
  subscribeToCollection, saveMarketingCategory, deleteMarketingCategory, 
  saveMarketingResource, deleteMarketingResource, saveSectionTemplate
} from '../services/firestore';
import Layout from '../components/Layout';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';

const { orderBy } = firestore as any;

type SectionType = "reviews" | "student_work" | "success_story" | "before_after" | "custom";

const SECTIONS: { id: SectionType, label: string, icon: string }[] = [
  { id: 'reviews', label: 'Reviews', icon: '⭐' },
  { id: 'student_work', label: 'Student Works', icon: '🎨' },
  { id: 'success_story', label: 'Success Stories', icon: '🚀' },
  { id: 'before_after', label: 'Before/After', icon: '🔄' },
  { id: 'custom', label: 'Custom Section', icon: '🛠️' },
];

const MarketingResourcesPage: React.FC<{ user: User }> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'all' | SectionType | 'templates'>('all');
  const [resources, setResources] = useState<MarketingResource[]>([]);
  const [categories, setCategories] = useState<MarketingCategory[]>([]);
  const [sectionTemplates, setSectionTemplates] = useState<MarketingSectionTemplate[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  
  // Modals & Forms
  const [isResourceModalOpen, setIsResourceModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isTemplateEditModalOpen, setIsTemplateEditModalOpen] = useState(false);
  
  const [editingResource, setEditingResource] = useState<MarketingResource | null>(null);
  const [resourceFormData, setResourceFormData] = useState<Partial<MarketingResource>>({
    title: '', description: '', resourceType: 'student_work', categoryId: '', 
    driveLink: '', studentName: '', groupId: '', rating: 5, 
    publishStatus: 'not_published', postLink: ''
  });

  const [editingCategory, setEditingCategory] = useState<MarketingCategory | null>(null);
  const [categoryFormData, setCategoryFormData] = useState<Partial<MarketingCategory>>({
    name: '', type: 'student_work'
  });

  const [editingTemplate, setEditingTemplate] = useState<Partial<MarketingSectionTemplate>>({ id: 'student_work', link: '' });

  const [deleteTarget, setDeleteTarget] = useState<{ id: string, name: string, type: 'resource' | 'category' } | null>(null);

  // Filters
  const [filterCategory, setFilterCategory] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRating, setFilterRating] = useState(0);
  const [sortBy, setSortBy] = useState<'rating' | 'date'>('date');

  const isStaff = ['admin', 'coordinator', 'team_leader'].includes(user.role);

  useEffect(() => {
    const unsubResources = subscribeToCollection<MarketingResource>('marketingResources', setResources, [orderBy('createdAt', 'desc')]);
    const unsubCategories = subscribeToCollection<MarketingCategory>('marketingCategories', setCategories);
    const unsubGroups = subscribeToCollection<Group>('groups', setGroups);
    const unsubTemplates = subscribeToCollection<MarketingSectionTemplate>('marketingSectionTemplates', setSectionTemplates);
    return () => { unsubResources(); unsubCategories(); unsubGroups(); unsubTemplates(); };
  }, []);

  const filteredResources = useMemo(() => {
    return resources.filter(r => {
      const matchesTab = activeTab === 'all' || activeTab === 'templates' ? true : r.resourceType === activeTab;
      const matchesCategory = filterCategory ? r.categoryId === filterCategory : true;
      const matchesGroup = filterGroup ? r.groupId === filterGroup : true;
      const matchesStatus = filterStatus ? r.publishStatus === filterStatus : true;
      const matchesRating = filterRating ? r.rating === filterRating : true;
      return matchesTab && matchesCategory && matchesGroup && matchesStatus && matchesRating;
    }).sort((a, b) => {
      if (sortBy === 'rating') return b.rating - a.rating;
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });
  }, [resources, activeTab, filterCategory, filterGroup, filterStatus, filterRating, sortBy]);

  const handleOpenResourceModal = (resource?: MarketingResource) => {
    if (resource) {
      setEditingResource(resource);
      setResourceFormData({ ...resource });
    } else {
      setEditingResource(null);
      setResourceFormData({
        title: '', description: '', 
        resourceType: (activeTab === 'all' || activeTab === 'templates') ? 'student_work' : activeTab as any, 
        categoryId: '', driveLink: '', studentName: '', groupId: '', 
        rating: 5, publishStatus: 'not_published', postLink: ''
      });
    }
    setIsResourceModalOpen(true);
  };

  const handleOpenCategoryModal = (typeOverride?: SectionType) => {
    const defaultType = typeOverride || (['reviews', 'student_work', 'success_story', 'before_after', 'custom'].includes(activeTab) 
      ? activeTab as SectionType 
      : 'student_work');
    setCategoryFormData({ name: '', type: defaultType });
    setEditingCategory(null);
    setIsCategoryModalOpen(true);
  };

  const handleSaveResource = async (e: React.FormEvent) => {
    e.preventDefault();
    const category = categories.find(c => c.id === resourceFormData.categoryId);
    const group = groups.find(g => g.id === resourceFormData.groupId);
    
    const payload = {
      ...resourceFormData,
      categoryName: category?.name || 'Uncategorized',
      groupName: group?.name || ''
    };
    
    await saveMarketingResource(payload, user);
    setIsResourceModalOpen(false);
  };

  const handleOpenCategoryEdit = (cat: MarketingCategory) => {
    setEditingCategory(cat);
    setCategoryFormData({
      id: cat.id,
      name: cat.name,
      type: cat.type
    });
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStaff) return;
    await saveMarketingCategory(categoryFormData, user);
    setCategoryFormData({ name: '', type: 'student_work' });
    setEditingCategory(null);
    setIsCategoryModalOpen(false);
  };

  const handleOpenTemplateEdit = (type: SectionType) => {
    const existing = sectionTemplates.find(t => t.id === type);
    setEditingTemplate({ id: type, link: existing?.link || '' });
    setIsTemplateEditModalOpen(true);
  };

  const handleSaveSectionTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStaff) return;
    await saveSectionTemplate(editingTemplate, user);
    setIsTemplateEditModalOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'resource') {
      await deleteMarketingResource(deleteTarget.id, deleteTarget.name, user);
    } else {
      await deleteMarketingCategory(deleteTarget.id, deleteTarget.name, user);
    }
    setIsDeleteModalOpen(false);
  };

  return (
    <Layout user={user}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter mb-1">Marketing Resources</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium tracking-tight">Access templates and organized assets.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          {isStaff && (
            <button 
              onClick={() => handleOpenCategoryModal()}
              className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-6 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700 flex items-center gap-2"
            >
              <span className="text-lg leading-none">+</span> Categories
            </button>
          )}
          <button 
            onClick={() => handleOpenResourceModal()}
            className="flex-1 md:flex-none bg-primary-600 text-white px-8 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <span className="text-xl leading-none">+</span> Add Resource
          </button>
        </div>
      </div>

      <div className="mb-8 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap gap-1 shadow-sm">
        <button
          onClick={() => { setActiveTab('all'); setFilterCategory(''); }}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black transition-all ${activeTab === 'all' ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'}`}
        >
          <span>📁</span> <span className="tracking-tight">All Resources</span>
        </button>
        {SECTIONS.map(section => (
          <button
            key={section.id}
            onClick={() => { setActiveTab(section.id); setFilterCategory(''); }}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black transition-all ${activeTab === section.id ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'}`}
          >
            <span>{section.icon}</span> <span className="tracking-tight">{section.label}</span>
          </button>
        ))}
        <button
          onClick={() => setActiveTab('templates')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black transition-all ${activeTab === 'templates' ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'}`}
        >
          <span>📐</span> <span className="tracking-tight">Templates Library</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-12">
        <aside className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm sticky top-8">
            <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-6">
              {activeTab === 'templates' ? 'Information' : 'Advanced Filters'}
            </h3>
            
            <div className="space-y-4">
              {activeTab === 'templates' ? (
                <div className="py-4 space-y-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Design templates are managed independently for each section. Use these to maintain design consistency.</p>
                  {isStaff && (
                    <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-2xl border border-primary-100 dark:border-primary-900/30">
                       <p className="text-[10px] font-black text-primary-600 dark:text-primary-400 uppercase tracking-widest mb-1">Staff Note</p>
                       <p className="text-[9px] text-primary-500 font-bold">Only authorized roles can update template Google Drive links.</p>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase mb-2 tracking-widest">Category</label>
                    <select 
                      value={filterCategory}
                      onChange={e => setFilterCategory(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold appearance-none outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                    >
                      <option value="">All Categories</option>
                      {categories
                        .filter(c => (activeTab === 'all') ? true : c.type === activeTab)
                        .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase mb-2 tracking-widest">Linked Batch</label>
                    <select 
                      value={filterGroup}
                      onChange={e => setFilterGroup(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold appearance-none outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                    >
                      <option value="">All Groups</option>
                      {groups.map(g => <option key={g.id} value={g.id}>Batch {g.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase mb-2 tracking-widest">Publish Status</label>
                    <select 
                      value={filterStatus}
                      onChange={e => setFilterStatus(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold appearance-none outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                    >
                      <option value="">Any Status</option>
                      <option value="published">✅ Published</option>
                      <option value="not_published">❌ Not Published</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase mb-2 tracking-widest">Min Rating</label>
                    <div className="flex gap-1">
                      {[1,2,3,4,5].map(star => (
                        <button 
                          key={star}
                          onClick={() => setFilterRating(filterRating === star ? 0 : star)}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${filterRating >= star ? 'bg-amber-100 text-amber-500 border-amber-200' : 'bg-slate-50 text-slate-300 border-slate-100'} border`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase mb-2 tracking-widest">Sort By</label>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setSortBy('date')}
                        className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${sortBy === 'date' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-200'}`}
                      >
                        Date
                      </button>
                      <button 
                        onClick={() => setSortBy('rating')}
                        className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${sortBy === 'rating' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-200'}`}
                      >
                        Rating
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </aside>

        <main className="lg:col-span-3">
          {activeTab === 'templates' ? (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 p-8 rounded-4xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-primary-50 dark:bg-primary-900/20 rounded-2xl flex items-center justify-center text-2xl">📐</div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">Section Templates</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Core design templates for creating marketing materials.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {SECTIONS.map(section => {
                    const template = sectionTemplates.find(t => t.id === section.id);
                    return (
                      <div key={section.id} className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between group">
                        <div className="mb-6">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-black text-primary-600 dark:text-primary-400 uppercase tracking-widest bg-primary-50 dark:bg-primary-900/20 px-3 py-1 rounded-full border border-primary-100 dark:border-primary-900/30">
                              Section Template
                            </span>
                            {isStaff && (
                              <button 
                                onClick={() => handleOpenTemplateEdit(section.id)}
                                className="text-slate-400 hover:text-primary-600 transition-colors"
                                title="Edit Template Link"
                              >
                                ✏️
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">{section.icon}</span>
                            <h3 className="text-lg font-black text-slate-900 dark:text-white">{section.label}</h3>
                          </div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                            {template?.link ? '✅ Active Link' : '❌ Link Missing'}
                          </p>
                        </div>

                        <div className="flex flex-col gap-2">
                          {template?.link ? (
                            <a 
                              href={template.link} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="w-full py-4 bg-primary-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary-600/20 hover:bg-primary-700 transition-all flex items-center justify-center gap-2"
                            >
                              📌 Open Template
                            </a>
                          ) : (
                            <div className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-dashed border-slate-200 dark:border-slate-700 text-center">
                              No link configured
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredResources.map(resource => (
                <div key={resource.id} className="bg-white dark:bg-slate-900 p-8 rounded-4xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-primary-100 dark:hover:border-primary-900/50 transition-all flex flex-col group relative overflow-hidden">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-black text-primary-600 dark:text-primary-400 uppercase tracking-widest bg-primary-50 dark:bg-primary-900/20 px-3 py-1 rounded-full border border-primary-100 dark:border-primary-900/30 w-fit">
                        {resource.categoryName}
                      </span>
                      <div className="flex items-center gap-1 mt-1">
                        {[1,2,3,4,5].map(s => (
                          <span key={s} className={`text-sm ${resource.rating >= s ? 'text-amber-400' : 'text-slate-200 dark:text-slate-800'}`}>★</span>
                        ))}
                      </div>
                    </div>
                    
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                      resource.publishStatus === 'published' 
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/50' 
                      : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                    }`}>
                      {resource.publishStatus === 'published' ? 'Published' : 'Not Published'}
                    </span>
                  </div>

                  <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 tracking-tighter leading-tight group-hover:text-primary-600 transition-colors">
                    {resource.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-6 line-clamp-2">
                    {resource.description || 'No description provided.'}
                  </p>

                  {(resource.studentName || resource.groupName) && (
                    <div className="mb-6 space-y-1">
                      {resource.studentName && (
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Student: <span className="text-slate-900 dark:text-slate-200">{resource.studentName}</span></p>
                      )}
                      {resource.groupName && (
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Group: <span className="text-slate-900 dark:text-slate-200">Batch {resource.groupName}</span></p>
                      )}
                    </div>
                  )}

                  <div className="mt-auto pt-6 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 gap-2">
                    <a 
                      href={resource.driveLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-4 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl text-[9px] font-black uppercase tracking-widest border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                    >
                      📂 Open Drive Resource
                    </a>
                  </div>

                  <div className="mt-4 flex gap-2">
                    {resource.publishStatus === 'published' && resource.postLink ? (
                      <a 
                        href={resource.postLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-3 bg-emerald-600 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                      >
                        📱 View Post
                      </a>
                    ) : (
                      <button 
                        onClick={() => handleOpenResourceModal(resource)}
                        className="flex-1 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-slate-100 transition-all"
                      >
                        {resource.publishStatus === 'published' ? 'Add Post Link' : 'Mark Published'}
                      </button>
                    )}
                  </div>

                  <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => handleOpenResourceModal(resource)} className="p-2 bg-white dark:bg-slate-800 shadow-xl rounded-xl border border-slate-200 dark:border-slate-700 hover:text-primary-600">✏️</button>
                    <button onClick={() => { setDeleteTarget({ id: resource.id, name: resource.title, type: 'resource' }); setIsDeleteModalOpen(true); }} className="p-2 bg-white dark:bg-slate-800 shadow-xl rounded-xl border border-slate-200 dark:border-slate-700 hover:text-red-500">🗑️</button>
                  </div>
                </div>
              ))}
              {filteredResources.length === 0 && (
                <div className="col-span-full py-24 text-center bg-white dark:bg-slate-900 rounded-4xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-400">
                  <p className="font-black uppercase tracking-widest text-[10px]">No resources found for this selection</p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Resource Modal */}
      {isResourceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-4xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in duration-200 border border-slate-200 dark:border-slate-800">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
              <div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">
                  {editingResource ? 'Update Marketing Asset' : 'Add New Marketing Asset'}
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Resource Profile Information</p>
              </div>
              <button onClick={() => setIsResourceModalOpen(false)} className="text-3xl text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">&times;</button>
            </div>
            <form onSubmit={handleSaveResource} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto no-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase mb-2 tracking-widest">Asset Title *</label>
                  <input 
                    type="text" required
                    value={resourceFormData.title}
                    onChange={e => setResourceFormData({ ...resourceFormData, title: e.target.value })}
                    className="w-full px-5 py-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-bold outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-600 transition-all"
                    placeholder="e.g. Photoshop 101 - Logo Project"
                  />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase mb-2 tracking-widest">Description</label>
                  <textarea 
                    value={resourceFormData.description}
                    onChange={e => setResourceFormData({ ...resourceFormData, description: e.target.value })}
                    className="w-full px-5 py-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-bold outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-600 transition-all h-24"
                    placeholder="Provide context for this material..."
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase mb-2 tracking-widest">Resource Type *</label>
                  <select 
                    required
                    value={resourceFormData.resourceType}
                    onChange={e => setResourceFormData({ ...resourceFormData, resourceType: e.target.value as any })}
                    className="w-full px-5 py-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-bold outline-none appearance-none"
                  >
                    {SECTIONS.map(s => <option key={s.id} value={s.id}>{s.icon} {s.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase mb-2 tracking-widest">Category *</label>
                  <select 
                    required
                    value={resourceFormData.categoryId}
                    onChange={e => setResourceFormData({ ...resourceFormData, categoryId: e.target.value })}
                    className="w-full px-5 py-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-bold outline-none appearance-none"
                  >
                    <option value="">Choose category...</option>
                    {categories.filter(c => c.type === resourceFormData.resourceType).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    <option value="uncategorized">General / Uncategorized</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase mb-2 tracking-widest">Google Drive Link *</label>
                  <input 
                    type="url" required
                    value={resourceFormData.driveLink}
                    onChange={e => setResourceFormData({ ...resourceFormData, driveLink: e.target.value })}
                    className="w-full px-5 py-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-bold outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-600 transition-all"
                    placeholder="https://drive.google.com/..."
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase mb-2 tracking-widest">Student Name (Optional)</label>
                  <input 
                    type="text"
                    value={resourceFormData.studentName}
                    onChange={e => setResourceFormData({ ...resourceFormData, studentName: e.target.value })}
                    className="w-full px-5 py-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-bold outline-none"
                    placeholder="Full name"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase mb-2 tracking-widest">Linked Group (Optional)</label>
                  <select 
                    value={resourceFormData.groupId}
                    onChange={e => setResourceFormData({ ...resourceFormData, groupId: e.target.value })}
                    className="w-full px-5 py-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-bold outline-none appearance-none"
                  >
                    <option value="">None / External</option>
                    {groups.map(g => <option key={g.id} value={g.id}>Batch {g.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase mb-2 tracking-widest">Internal Rating</label>
                  <div className="flex gap-2">
                    {[1,2,3,4,5].map(star => (
                      <button 
                        key={star} type="button"
                        onClick={() => setResourceFormData({ ...resourceFormData, rating: star })}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${resourceFormData.rating! >= star ? 'bg-amber-100 text-amber-500 border-amber-200' : 'bg-slate-50 text-slate-300 border-slate-100'} border text-xl`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase mb-2 tracking-widest">Publish Status</label>
                  <select 
                    value={resourceFormData.publishStatus}
                    onChange={e => setResourceFormData({ ...resourceFormData, publishStatus: e.target.value as any })}
                    className="w-full px-5 py-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-bold outline-none appearance-none"
                  >
                    <option value="not_published">❌ Not Published</option>
                    <option value="published">✅ Published</option>
                  </select>
                </div>

                {resourceFormData.publishStatus === 'published' && (
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase mb-2 tracking-widest">Social Media Post Link</label>
                    <input 
                      type="url"
                      value={resourceFormData.postLink}
                      onChange={e => setResourceFormData({ ...resourceFormData, postLink: e.target.value })}
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-bold outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-600 transition-all"
                      placeholder="https://facebook.com/..."
                    />
                  </div>
                )}
              </div>

              <div className="pt-8 border-t border-slate-100 dark:border-slate-800 flex gap-4">
                <button type="button" onClick={() => setIsResourceModalOpen(false)} className="flex-1 py-4 text-slate-500 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all border border-slate-100 dark:border-slate-800">Cancel</button>
                <button type="submit" className="flex-1 py-4 bg-primary-600 text-white font-black rounded-2xl shadow-xl shadow-primary-600/30 hover:bg-primary-700 active:scale-95 transition-all text-[10px] uppercase tracking-widest">
                  Save Resource
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Template Link Edit Modal */}
      {isTemplateEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-4xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
              <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter">Edit Section Template</h3>
              <button onClick={() => setIsTemplateEditModalOpen(false)} className="text-3xl text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">&times;</button>
            </div>
            <form onSubmit={handleSaveSectionTemplate} className="p-8 space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Section Type</label>
                <div className="w-full px-5 py-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 text-sm font-black text-slate-400 uppercase tracking-widest">
                  {editingTemplate.id?.replace('_', ' ')}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Template Drive Link</label>
                <input 
                  type="url" required
                  value={editingTemplate.link}
                  onChange={e => setEditingTemplate({...editingTemplate, link: e.target.value})}
                  className="w-full px-5 py-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-bold outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-600 transition-all"
                  placeholder="https://drive.google.com/..."
                />
              </div>
              <button type="submit" className="w-full py-4 bg-primary-600 text-white font-black rounded-2xl shadow-xl shadow-primary-600/30 hover:bg-primary-700 transition-all text-[10px] uppercase tracking-widest">
                Update Section Template
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Categories Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-4xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in duration-200 border border-slate-200 dark:border-slate-800">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
              <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter">{editingCategory ? 'Edit Category' : 'Manage Categories'}</h3>
              <button onClick={() => { setIsCategoryModalOpen(false); setEditingCategory(null); }} className="text-3xl text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">&times;</button>
            </div>
            <div className="p-8 space-y-8">
              {isStaff && (
                <form onSubmit={handleSaveCategory} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Category Name</label>
                      <input 
                        type="text" required
                        value={categoryFormData.name}
                        onChange={e => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold outline-none"
                        placeholder="e.g. Photoshop Design"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Parent Section</label>
                      <select 
                        required
                        value={categoryFormData.type}
                        onChange={e => setCategoryFormData({ ...categoryFormData, type: e.target.value as any })}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold outline-none"
                      >
                        {SECTIONS.map(s => <option key={s.id} value={s.id}>{s.icon} {s.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {editingCategory && (
                      <button type="button" onClick={() => { setEditingCategory(null); setCategoryFormData({ name: '', type: 'student_work' }); }} className="flex-1 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest">Cancel Edit</button>
                    )}
                    <button type="submit" className="flex-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-slate-100 transition-all border border-slate-800 dark:border-white shadow-xl">
                      {editingCategory ? 'Update Category' : 'Add Category'}
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-2 max-h-[35vh] overflow-y-auto no-scrollbar">
                <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Existing Categories</span>
                </div>
                {categories.map(cat => (
                  <div key={cat.id} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">
                        {SECTIONS.find(s => s.id === cat.type)?.icon}
                      </span>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{cat.name}</span>
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                          {cat.type.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                       {isStaff && (
                        <>
                          <button onClick={() => handleOpenCategoryEdit(cat)} className="p-2 text-slate-400 hover:text-primary-600 transition-colors">✏️</button>
                          <button onClick={() => { setDeleteTarget({ id: cat.id, name: cat.name, type: 'category' }); setIsDeleteModalOpen(true); }} className="p-2 text-slate-400 hover:text-red-500 transition-colors">🗑️</button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {categories.length === 0 && (
                  <p className="text-center py-8 text-slate-400 italic text-xs">No categories created yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDeleteModal 
        isOpen={isDeleteModalOpen}
        onCancel={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        entityName={deleteTarget?.name || ''}
        entityType={deleteTarget?.type === 'resource' ? 'Marketing Asset' : 'Category'}
      />
    </Layout>
  );
};

export default MarketingResourcesPage;
