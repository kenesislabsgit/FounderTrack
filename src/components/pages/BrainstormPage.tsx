import { useState, useEffect } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuthContext } from '../../contexts/AuthContext';
import { BrainstormIdea } from '../../types';

import { Lightbulb, ThumbsUp, Plus, X, MessageSquare, CheckCircle2, Archive } from 'lucide-react';
import { format } from 'date-fns';

export default function BrainstormPage() {
  const { user, profile } = useAuthContext();
  const [ideas, setIdeas] = useState<BrainstormIdea[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'idea' | 'todo' | 'discussion'>('idea');
  const [filter, setFilter] = useState<'all' | 'idea' | 'todo' | 'discussion'>('all');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'brainstormIdeas'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setIdeas(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as BrainstormIdea)));
    }, (err) => console.warn('Firestore listener error:', err.message));
    return () => unsubscribe();
  }, []);

  const handleSubmit = async () => {
    if (!user || !profile || !title.trim()) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'brainstormIdeas'), {
        uid: user.uid,
        authorName: profile.name,
        title: title.trim(),
        description: description.trim(),
        category,
        status: 'open',
        createdAt: serverTimestamp(),
        upvotes: [],
      });
      setTitle('');
      setDescription('');
      setShowForm(false);
    } catch (err) {
      console.error('Failed to post idea:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpvote = async (idea: BrainstormIdea) => {
    if (!user || !idea.id) return;
    const hasUpvoted = idea.upvotes?.includes(user.uid);
    try {
      await updateDoc(doc(db, 'brainstormIdeas', idea.id), {
        upvotes: hasUpvoted ? arrayRemove(user.uid) : arrayUnion(user.uid),
      });
    } catch (err) {
      console.error('Failed to upvote:', err);
    }
  };

  const handleStatusChange = async (idea: BrainstormIdea, status: BrainstormIdea['status']) => {
    if (!idea.id) return;
    try {
      await updateDoc(doc(db, 'brainstormIdeas', idea.id), { status });
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleDelete = async (idea: BrainstormIdea) => {
    if (!idea.id || !confirm('Delete this idea?')) return;
    try {
      await deleteDoc(doc(db, 'brainstormIdeas', idea.id));
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const filteredIdeas = filter === 'all' ? ideas : ideas.filter((i) => i.category === filter);

  const categoryColors: Record<string, string> = {
    idea: 'bg-blue-100 text-blue-700',
    todo: 'bg-green-100 text-green-700',
    discussion: 'bg-purple-100 text-purple-700',
  };

  const statusIcons: Record<string, React.ReactNode> = {
    open: <Lightbulb size={14} />,
    'in-progress': <MessageSquare size={14} />,
    completed: <CheckCircle2 size={14} />,
    archived: <Archive size={14} />,
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[hsl(var(--text-primary))]">Kenesis Brainstorm</h2>
          <p className="text-sm text-[hsl(var(--text-muted))] mt-1">Share ideas, vote on priorities, and collaborate.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-xl bg-gradient-to-b from-[hsl(42,90%,58%)] to-[hsl(36,95%,46%)] px-5 py-2.5 text-sm font-bold text-white shadow-[inset_0_1px_0_0_hsla(50,100%,80%,0.45),0_2px_4px_rgba(0,0,0,0.25)] transition-all hover:-translate-y-[0.5px] disabled:opacity-50 flex items-center gap-2"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'New Idea'}
        </button>
      </div>

      {/* New Idea Form */}
      {showForm && (
        <div className="rounded-2xl glass-elevated p-6 space-y-4 animate-scale-in">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Idea title..."
            className="w-full rounded-xl inset-well px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]/20 text-[hsl(var(--text-primary))] placeholder:text-[hsl(var(--text-muted))]"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your idea..."
            rows={3}
            className="w-full rounded-xl inset-well px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]/20 resize-none text-[hsl(var(--text-primary))] placeholder:text-[hsl(var(--text-muted))]"
          />
          <div className="flex items-center gap-3">
            {(['idea', 'todo', 'discussion'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={category === cat
                  ? "rounded-xl bg-gradient-to-b from-[hsl(42,90%,58%)] to-[hsl(36,95%,46%)] px-3 py-1.5 text-xs font-bold text-white shadow-[inset_0_1px_0_0_hsla(50,100%,80%,0.45),0_2px_4px_rgba(0,0,0,0.25)] transition-all hover:-translate-y-[0.5px] disabled:opacity-50 flex items-center gap-2 capitalize"
                  : "rounded-lg px-3 py-1.5 text-xs text-[hsl(var(--text-secondary))] hover:bg-[hsla(var(--accent),0.1)] transition-colors flex items-center gap-2 capitalize"}
              >
                {cat}
              </button>
            ))}
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting || !title.trim()}
            className="rounded-xl bg-gradient-to-b from-[hsl(42,90%,58%)] to-[hsl(36,95%,46%)] px-5 py-2.5 text-sm font-bold text-white shadow-[inset_0_1px_0_0_hsla(50,100%,80%,0.45),0_2px_4px_rgba(0,0,0,0.25)] transition-all hover:-translate-y-[0.5px] disabled:opacity-50 flex items-center gap-2"
          >
            {submitting ? 'Posting...' : 'Post Idea'}
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'idea', 'todo', 'discussion'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={filter === f
              ? "rounded-xl bg-gradient-to-b from-[hsl(42,90%,58%)] to-[hsl(36,95%,46%)] px-3 py-1.5 text-xs font-bold text-white shadow-[inset_0_1px_0_0_hsla(50,100%,80%,0.45),0_2px_4px_rgba(0,0,0,0.25)] transition-all hover:-translate-y-[0.5px] disabled:opacity-50 flex items-center gap-2 capitalize"
              : "rounded-lg px-3 py-1.5 text-xs text-[hsl(var(--text-secondary))] hover:bg-[hsla(var(--accent),0.1)] transition-colors flex items-center gap-2 capitalize"}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Ideas Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredIdeas.map((idea) => {
          const hasUpvoted = idea.upvotes?.includes(user?.uid || '');
          return (
            <div key={idea.id} className="glass rounded-2xl p-6 flex flex-col h-full animate-slide-up-fade">
              <div className="flex items-start justify-between mb-3">
                <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${categoryColors[idea.category]}`}>
                  {idea.category}
                </span>
                <div className="flex items-center gap-1 text-[hsl(var(--text-muted))]">
                  {statusIcons[idea.status]}
                  <span className="text-[10px] font-bold uppercase">{idea.status}</span>
                </div>
              </div>
              <h4 className="text-sm font-bold text-[hsl(var(--text-primary))] mb-1">{idea.title}</h4>
              {idea.description && (
                <p className="text-xs text-[hsl(var(--text-muted))] leading-relaxed mb-4 flex-1">{idea.description}</p>
              )}
              <div className="flex items-center justify-between mt-auto pt-4 border-t border-[hsl(var(--border-subtle))]">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[hsl(var(--text-muted))]">
                    {idea.authorName} · {idea.createdAt instanceof Timestamp ? format(idea.createdAt.toDate(), 'MMM d') : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleUpvote(idea)}
                    className={hasUpvoted
                      ? "rounded-xl bg-gradient-to-b from-[hsl(42,90%,58%)] to-[hsl(36,95%,46%)] px-3 py-1.5 text-xs font-bold text-white shadow-[inset_0_1px_0_0_hsla(50,100%,80%,0.45),0_2px_4px_rgba(0,0,0,0.25)] transition-all hover:-translate-y-[0.5px] disabled:opacity-50 flex items-center gap-1"
                      : "rounded-lg px-3 py-1.5 text-xs text-[hsl(var(--text-secondary))] hover:bg-[hsla(var(--accent),0.1)] transition-colors flex items-center gap-1"}
                  >
                    <ThumbsUp size={12} />
                    {idea.upvotes?.length || 0}
                  </button>
                  {(profile?.role === 'admin' || idea.uid === user?.uid) && (
                    <select
                      value={idea.status}
                      onChange={(e) => handleStatusChange(idea, e.target.value as BrainstormIdea['status'])}
                      className="rounded-lg inset-well px-2 py-1 text-[10px] font-bold text-[hsl(var(--text-secondary))] border-none focus:outline-none"
                    >
                      <option value="open">Open</option>
                      <option value="in-progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="archived">Archived</option>
                    </select>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredIdeas.length === 0 && (
        <div className="text-center py-16">
          <Lightbulb size={40} className="mx-auto text-[hsl(var(--text-muted))]/30 mb-4" />
          <p className="text-sm text-[hsl(var(--text-muted))]">No ideas yet. Be the first to share!</p>
        </div>
      )}
    </div>
  );
}
