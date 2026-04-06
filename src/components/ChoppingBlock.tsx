import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  orderBy, 
  limit,
  Timestamp,
  getDocs,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, ReviewCycle, Ballot } from '../types';
import { format, addDays, isAfter } from 'date-fns';
import { 
  Shield, 
  AlertTriangle, 
  Skull, 
  CheckCircle2, 
  ChevronRight, 
  Lock, 
  Users,
  TrendingDown,
  MessageSquare,
  Vote
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useToast } from './ui/ToastProvider';

interface ChoppingBlockProps {
  user: any;
  profile: UserProfile | null;
  allUsers: UserProfile[];
}

export function ChoppingBlock({ user, profile, allUsers }: ChoppingBlockProps) {
  const { addToast } = useToast();
  const [currentCycle, setCurrentCycle] = useState<ReviewCycle | null>(null);
  const [lastCycles, setLastCycles] = useState<ReviewCycle[]>([]);
  const [myBallot, setMyBallot] = useState<Ballot | null>(null);
  const [allBallots, setAllBallots] = useState<Ballot[]>([]);
  const [rankings, setRankings] = useState<{ [uid: string]: { rank: number; reason: string } }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const founders = allUsers.filter(u => u.role === 'founder');
  const otherFounders = founders.filter(u => u.uid !== user?.uid);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'reviewCycles'), orderBy('startDate', 'desc'), limit(5));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cycles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReviewCycle));
      setLastCycles(cycles);
      const activeOrVoting = cycles.find(c => c.status === 'active' || c.status === 'voting');
      setCurrentCycle(activeOrVoting || cycles[0] || null);
    }, (err) => console.warn('Firestore listener error:', err.message));
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!currentCycle?.id || !user) return;
    const q = query(
      collection(db, 'ballots'), 
      where('cycleId', '==', currentCycle.id),
      where('voterUid', '==', user.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setMyBallot({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Ballot);
      } else {
        setMyBallot(null);
      }
    }, (err) => console.warn('Firestore listener error:', err.message));
    return () => unsubscribe();
  }, [currentCycle?.id, user]);

  useEffect(() => {
    if (!currentCycle?.id || currentCycle.status !== 'completed') {
      setAllBallots([]);
      return;
    }
    const q = query(collection(db, 'ballots'), where('cycleId', '==', currentCycle.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAllBallots(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ballot)));
    }, (err) => console.warn('Firestore listener error:', err.message));
    return () => unsubscribe();
  }, [currentCycle?.id, currentCycle?.status]);

  const handleStartVoting = async () => {
    if (!currentCycle) {
      await addDoc(collection(db, 'reviewCycles'), {
        startDate: serverTimestamp(),
        endDate: Timestamp.fromDate(addDays(new Date(), 14)),
        status: 'voting'
      });
    } else {
      await updateDoc(doc(db, 'reviewCycles', currentCycle.id!), { status: 'voting' });
    }
  };

  const handleSubmitBallot = async () => {
    if (!currentCycle?.id || !user) return;
    const rankedUids = Object.keys(rankings);
    if (rankedUids.length !== otherFounders.length) {
      addToast("Please rank all other founders.", "warning");
      return;
    }
    if (rankedUids.some(uid => !rankings[uid].reason.trim())) {
      addToast("Please provide a reason for each ranking.", "warning");
      return;
    }
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'ballots'), {
        cycleId: currentCycle.id,
        voterUid: user.uid,
        rankings: otherFounders.map(f => ({
          targetUid: f.uid,
          rank: rankings[f.uid].rank,
          reason: rankings[f.uid].reason
        })),
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Failed to submit ballot:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolveCycle = async () => {
    if (!currentCycle?.id) return;
    const ballotsSnap = await getDocs(query(collection(db, 'ballots'), where('cycleId', '==', currentCycle.id)));
    const ballots = ballotsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Ballot));
    if (ballots.length < founders.length) {
      if (!confirm(`Only ${ballots.length}/${founders.length} founders have voted. Resolve anyway?`)) return;
    }
    const scores: { [uid: string]: number } = {};
    founders.forEach(f => scores[f.uid] = 0);
    ballots.forEach(b => {
      b.rankings.forEach(r => {
        if (scores[r.targetUid] !== undefined) scores[r.targetUid] += r.rank;
      });
    });
    const avgScores: { [uid: string]: number } = {};
    Object.keys(scores).forEach(uid => {
      const voterCount = ballots.filter(b => b.voterUid !== uid).length;
      avgScores[uid] = voterCount > 0 ? scores[uid] / voterCount : 0;
    });
    let maxScore = -1;
    let underperformerUid = '';
    let isTie = false;
    Object.entries(avgScores).forEach(([uid, score]) => {
      if (score > maxScore) { maxScore = score; underperformerUid = uid; isTie = false; }
      else if (score === maxScore && maxScore !== -1) { isTie = true; }
    });
    await updateDoc(doc(db, 'reviewCycles', currentCycle.id), {
      status: 'completed', underperformerUid: isTie ? null : underperformerUid, isTie, results: avgScores, endDate: serverTimestamp()
    });
    await addDoc(collection(db, 'reviewCycles'), {
      startDate: serverTimestamp(), endDate: Timestamp.fromDate(addDays(new Date(), 14)), status: 'active'
    });
  };

  const handleResetGovernance = async () => {
    if (!confirm("Are you sure you want to reset all governance data? This will delete all cycles and ballots.")) return;
    setIsSubmitting(true);
    try {
      const cyclesSnap = await getDocs(collection(db, 'reviewCycles'));
      const ballotsSnap = await getDocs(collection(db, 'ballots'));
      const batch = writeBatch(db);
      cyclesSnap.docs.forEach(d => batch.delete(d.ref));
      ballotsSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      addToast("Governance data reset successfully.", "success");
    } catch (err) {
      console.error("Failed to reset governance:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSimulateTie = async () => {
    if (!currentCycle?.id) return;
    if (!confirm("Simulate a tie between the first two founders?")) return;
    const tieResults: { [uid: string]: number } = {};
    founders.forEach((f, i) => { tieResults[f.uid] = i < 2 ? 4 : 1; });
    await updateDoc(doc(db, 'reviewCycles', currentCycle.id), {
      status: 'completed', isTie: true, results: tieResults, underperformerUid: null, endDate: serverTimestamp()
    });
  };

  const getFounderStatus = (uid: string) => {
    const completedCycles = lastCycles.filter(c => c.status === 'completed');
    if (completedCycles.length === 0) return 'safe';
    const lastCycle = completedCycles[0];
    const prevCycle = completedCycles[1];
    const wasUnderLast = lastCycle.underperformerUid === uid || lastCycle.tieBreakerUid === uid;
    const wasUnderPrev = prevCycle ? (prevCycle.underperformerUid === uid || prevCycle.tieBreakerUid === uid) : false;
    if (wasUnderLast && wasUnderPrev) return 'penalty';
    if (wasUnderLast) return 'warning';
    return 'safe';
  };

  if (profile?.role !== 'founder' && profile?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Lock size={48} className="text-[hsl(var(--text-muted))]/30 mb-4" />
        <h3 className="text-xl font-bold text-[hsl(var(--text-primary))]">Restricted Access</h3>
        <p className="text-sm text-[hsl(var(--text-muted))] max-w-md mt-2">
          The Chopping Block is a private governance system reserved for company founders.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-black text-[hsl(var(--text-primary))]">The Chopping Block</h3>
          <p className="text-sm text-[hsl(var(--text-muted))] mt-1">Founder performance governance & secret ballot.</p>
        </div>
        <div className="flex items-center gap-3">
          {profile?.role === 'founder' && currentCycle?.status === 'active' && (
            <button 
              onClick={handleStartVoting}
              className="rounded-xl bg-gradient-to-b from-[hsl(42,90%,58%)] to-[hsl(36,95%,46%)] px-6 py-3 text-sm font-bold text-white shadow-[inset_0_1px_0_0_hsla(50,100%,80%,0.45),0_2px_4px_rgba(0,0,0,0.25)] transition-all flex items-center gap-2"
            >
              <Vote size={18} />
              Start Voting Window
            </button>
          )}
          {profile?.role === 'founder' && currentCycle?.status === 'voting' && (
            <button 
              onClick={handleResolveCycle}
              className="rounded-xl bg-[hsl(var(--bg-elevated))] border border-[hsl(var(--border-default))] px-6 py-3 text-sm font-bold text-[hsl(var(--text-primary))] hover:bg-[hsla(var(--accent),0.05)] transition-all shadow-[inset_0_1px_0_0_hsla(0,0%,100%,0.08),0_1px_3px_rgba(0,0,0,0.12)] flex items-center gap-2"
            >
              <CheckCircle2 size={18} />
              Resolve Cycle
            </button>
          )}
        </div>
      </div>

      {/* Status Board */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {founders.map(founder => {
          const status = getFounderStatus(founder.uid);
          return (
            <div key={founder.uid} className="rounded-2xl glass p-6 flex flex-col items-center text-center animate-slide-up-fade">
              <div className="relative mb-4">
                <div className="h-16 w-16 rounded-full bg-[hsl(var(--bg-elevated))] flex items-center justify-center text-xl font-bold overflow-hidden border-2 border-[hsl(var(--border-default))] shadow-md">
                  {founder.photoURL ? (
                    <img src={founder.photoURL} alt={founder.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="text-[hsl(var(--text-primary))]">{founder.name[0]}</span>
                  )}
                </div>
                <div className={cn(
                  "absolute -bottom-1 -right-1 h-6 w-6 rounded-full border-2 border-[hsl(var(--bg-surface))] flex items-center justify-center shadow-sm",
                  status === 'safe' ? "bg-green-500" : status === 'warning' ? "bg-yellow-500" : "bg-red-500"
                )}>
                  {status === 'safe' ? <Shield size={12} className="text-white" /> : 
                   status === 'warning' ? <AlertTriangle size={12} className="text-white" /> : 
                   <Skull size={12} className="text-white" />}
                </div>
              </div>
              <h4 className="text-sm font-bold text-[hsl(var(--text-primary))]">{founder.name}</h4>
              <p className={cn(
                "text-[10px] font-bold uppercase tracking-widest mt-1",
                status === 'safe' ? "text-green-500" : status === 'warning' ? "text-yellow-500" : "text-red-500"
              )}>
                {status === 'safe' ? "Safe" : status === 'warning' ? "On Chopping Block" : "Penalty Triggered"}
              </p>
            </div>
          );
        })}
      </div>

      {/* CEO Tie-Breaker Section */}
      {currentCycle?.status === 'completed' && currentCycle.isTie && !currentCycle.tieBreakerUid && (
        <div className="rounded-3xl glass-elevated p-8 border-[hsl(var(--warning))]/30 animate-scale-in">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-b from-[hsl(38,92%,55%)] to-[hsl(38,92%,45%)] flex items-center justify-center text-white shadow-lg">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h4 className="text-lg font-bold text-[hsl(var(--text-primary))]">CEO Tie-Breaker Required</h4>
              <p className="text-sm text-[hsl(var(--text-muted))]">There is a tie for the bottom rank. The CEO must cast the deciding vote.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {founders.filter(f => currentCycle.results && currentCycle.results[f.uid] === Math.max(...(Object.values(currentCycle.results) as number[]))).map(f => (
              <button
                key={f.uid}
                onClick={async () => {
                  if (confirm(`Designate ${f.name} as the Underperformer?`)) {
                    await updateDoc(doc(db, 'reviewCycles', currentCycle.id!), {
                      tieBreakerUid: f.uid, isTie: false
                    });
                  }
                }}
                className="flex items-center gap-4 p-4 rounded-2xl glass hover:border-[hsl(var(--accent))]/50 transition-all text-left hover:-translate-y-[0.5px] hover:shadow-[0_0_12px_hsla(var(--accent),0.25)]"
              >
                <div className="h-10 w-10 rounded-full bg-[hsl(var(--bg-elevated))] flex items-center justify-center font-bold text-[hsl(var(--text-primary))]">
                  {f.name[0]}
                </div>
                <div>
                  <p className="text-sm font-bold text-[hsl(var(--text-primary))]">{f.name}</p>
                  <p className="text-xs text-[hsl(var(--text-muted))]">Select as Underperformer</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Voting Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Developer Testing Tools */}
          {import.meta.env.VITE_DEV_MODE === 'true' && (
            <div className="rounded-3xl glass-elevated p-8 border-dashed">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-b from-[hsl(38,92%,55%)] to-[hsl(38,92%,45%)] flex items-center justify-center text-white">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[hsl(var(--text-primary))]">Developer Testing Tools</h4>
                  <p className="text-xs text-[hsl(var(--text-muted))]">Use these to test the governance logic without waiting 2 weeks.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button 
                  onClick={handleStartVoting}
                  className="px-4 py-2 rounded-xl bg-[hsl(var(--bg-elevated))] border border-[hsl(var(--border-default))] text-xs font-bold text-[hsl(var(--text-secondary))] hover:bg-[hsla(var(--accent),0.05)] transition-all"
                >
                  1. Force Start Voting
                </button>
                <button 
                  onClick={handleResolveCycle}
                  className="px-4 py-2 rounded-xl bg-[hsl(var(--bg-elevated))] border border-[hsl(var(--border-default))] text-xs font-bold text-[hsl(var(--text-secondary))] hover:bg-[hsla(var(--accent),0.05)] transition-all"
                >
                  2. Force Resolve Cycle
                </button>
                <button 
                  onClick={handleSimulateTie}
                  className="px-4 py-2 rounded-xl bg-[hsl(var(--bg-elevated))] border border-[hsl(var(--border-default))] text-xs font-bold text-[hsl(var(--text-secondary))] hover:bg-[hsla(var(--accent),0.05)] transition-all"
                >
                  3. Simulate Tie (CEO Test)
                </button>
                <button 
                  onClick={handleResetGovernance}
                  className="px-4 py-2 rounded-xl bg-gradient-to-b from-[hsl(0,72%,58%)] to-[hsl(0,72%,48%)] text-xs font-bold text-white shadow-[inset_0_1px_0_0_hsla(0,80%,75%,0.35),0_2px_4px_rgba(0,0,0,0.25)] transition-all"
                >
                  Reset All Governance
                </button>
              </div>
            </div>
          )}

          <div className="rounded-3xl glass p-8 animate-slide-up-fade">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h4 className="text-lg font-bold text-[hsl(var(--text-primary))]">Secret Ballot</h4>
                <p className="text-xs text-[hsl(var(--text-muted))] mt-1">Rank your fellow founders based on their outcomes this cycle.</p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-[hsla(var(--accent),0.1)] flex items-center justify-center text-[hsl(var(--accent))]">
                <Vote size={24} />
              </div>
            </div>

            {currentCycle?.status !== 'voting' ? (
              <div className="py-12 text-center">
                <Lock size={32} className="mx-auto text-[hsl(var(--text-muted))]/30 mb-4" />
                <p className="text-sm text-[hsl(var(--text-muted))] italic">Voting is currently closed for this cycle.</p>
              </div>
            ) : myBallot ? (
              <div className="py-12 text-center rounded-2xl bg-green-500/10 border border-green-500/20">
                <CheckCircle2 size={32} className="mx-auto text-green-500 mb-4" />
                <h5 className="text-lg font-bold text-[hsl(var(--text-primary))]">Ballot Cast Successfully</h5>
                <p className="text-sm text-[hsl(var(--text-muted))] mt-1">Your anonymous vote has been recorded.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {otherFounders.map(f => (
                  <div key={f.uid} className="p-6 rounded-2xl inset-well space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-[hsl(var(--bg-surface))] flex items-center justify-center font-bold text-[hsl(var(--text-muted))] border border-[hsl(var(--border-default))]">
                        {f.name[0]}
                      </div>
                      <div className="flex-1">
                        <h5 className="text-sm font-bold text-[hsl(var(--text-primary))]">{f.name}</h5>
                        <p className="text-[10px] text-[hsl(var(--text-muted))] uppercase font-bold tracking-widest">Co-Founder</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4].map(r => (
                          <button
                            key={r}
                            onClick={() => setRankings(prev => ({ ...prev, [f.uid]: { ...prev[f.uid], rank: r } }))}
                            className={cn(
                              "h-8 w-8 rounded-lg text-xs font-bold transition-all border",
                              rankings[f.uid]?.rank === r 
                                ? "bg-gradient-to-b from-[hsl(42,90%,58%)] to-[hsl(36,95%,46%)] border-transparent text-white shadow-[inset_0_1px_0_0_hsla(50,100%,80%,0.45),0_2px_4px_rgba(0,0,0,0.25)]" 
                                : "bg-[hsl(var(--bg-surface))] border-[hsl(var(--border-default))] text-[hsl(var(--text-muted))] hover:border-[hsl(var(--accent))]/50"
                            )}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea 
                      placeholder={`Why this rank for ${f.name.split(' ')[0]}? (Required)`}
                      value={rankings[f.uid]?.reason || ''}
                      onChange={(e) => setRankings(prev => ({ ...prev, [f.uid]: { ...prev[f.uid], reason: e.target.value } }))}
                      rows={2}
                      className="w-full rounded-xl inset-well px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]/20 resize-none text-[hsl(var(--text-primary))] placeholder:text-[hsl(var(--text-muted))]"
                    />
                  </div>
                ))}
                <button 
                  onClick={handleSubmitBallot}
                  disabled={isSubmitting}
                  className="w-full rounded-2xl bg-gradient-to-b from-[hsl(42,90%,58%)] to-[hsl(36,95%,46%)] py-4 text-sm font-bold text-white shadow-[inset_0_1px_0_0_hsla(50,100%,80%,0.45),0_4px_12px_rgba(0,0,0,0.25)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? "Submitting..." : "Cast Secret Ballot"}
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </div>

          {/* Anonymized Reasons */}
          {currentCycle?.status === 'completed' && allBallots.length > 0 && (
            <div className="rounded-3xl glass p-8 animate-slide-up-fade">
              <h4 className="text-lg font-bold text-[hsl(var(--text-primary))] mb-6">Cycle Feedback (Anonymized)</h4>
              <div className="space-y-6">
                {founders.map(f => {
                  const reasons = allBallots.flatMap(b => b.rankings.filter(r => r.targetUid === f.uid).map(r => r.reason));
                  if (reasons.length === 0) return null;
                  return (
                    <div key={f.uid} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-[hsl(var(--bg-elevated))] flex items-center justify-center text-[10px] font-bold text-[hsl(var(--text-primary))]">
                          {f.name[0]}
                        </div>
                        <h5 className="text-xs font-bold text-[hsl(var(--text-primary))]">Feedback for {f.name}</h5>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {reasons.map((reason, i) => (
                          <div key={i} className="p-4 rounded-xl inset-well text-xs text-[hsl(var(--text-secondary))] italic leading-relaxed">
                            &ldquo;{reason}&rdquo;
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Rules & Info */}
        <div className="space-y-6">
          <div className="rounded-3xl glass p-8 shadow-xl animate-slide-up-fade">
            <h4 className="text-lg font-bold mb-4 flex items-center gap-2 text-[hsl(var(--text-primary))]">
              <Shield size={20} className="text-[hsl(var(--accent))]" />
              The Rules
            </h4>
            <ul className="space-y-4 text-xs text-[hsl(var(--text-muted))] leading-relaxed">
              <li className="flex gap-3">
                <div className="h-5 w-5 rounded-full bg-[hsla(var(--accent),0.15)] text-[hsl(var(--accent))] flex items-center justify-center shrink-0 font-bold text-[10px]">1</div>
                <p><span className="text-[hsl(var(--text-primary))] font-bold">Secret Ballot:</span> All founders rank each other anonymously every 2 weeks.</p>
              </li>
              <li className="flex gap-3">
                <div className="h-5 w-5 rounded-full bg-[hsla(var(--accent),0.15)] text-[hsl(var(--accent))] flex items-center justify-center shrink-0 font-bold text-[10px]">2</div>
                <p><span className="text-[hsl(var(--text-primary))] font-bold">The Bottom Rank:</span> The lowest ranked founder is designated as the &ldquo;Underperformer&rdquo;.</p>
              </li>
              <li className="flex gap-3">
                <div className="h-5 w-5 rounded-full bg-[hsla(var(--accent),0.15)] text-[hsl(var(--accent))] flex items-center justify-center shrink-0 font-bold text-[10px]">3</div>
                <p><span className="text-[hsl(var(--text-primary))] font-bold">Warning:</span> First time underperforming results in a &ldquo;Chopping Block&rdquo; warning.</p>
              </li>
              <li className="flex gap-3">
                <div className="h-5 w-5 rounded-full bg-[hsla(var(--accent),0.15)] text-[hsl(var(--accent))] flex items-center justify-center shrink-0 font-bold text-[10px]">4</div>
                <p><span className="text-[hsl(var(--text-primary))] font-bold">Penalty:</span> Underperforming for 2 consecutive cycles triggers a <span className="text-red-400 font-bold">1.5% Equity Dilution</span>.</p>
              </li>
              <li className="flex gap-3">
                <div className="h-5 w-5 rounded-full bg-[hsla(var(--accent),0.15)] text-[hsl(var(--accent))] flex items-center justify-center shrink-0 font-bold text-[10px]">5</div>
                <p><span className="text-[hsl(var(--text-primary))] font-bold">Redemption:</span> Not being bottom in the next cycle clears the warning.</p>
              </li>
            </ul>
          </div>

          {currentCycle && (
            <div className="rounded-3xl glass p-8 animate-slide-up-fade" style={{ animationDelay: '50ms' }}>
              <h4 className="text-sm font-bold text-[hsl(var(--text-primary))] mb-4 uppercase tracking-widest">Cycle Progress</h4>
              <div className="space-y-4">
                <div className="flex justify-between text-xs">
                  <span className="text-[hsl(var(--text-muted))]">Status</span>
                  <span className={cn(
                    "font-bold uppercase",
                    currentCycle.status === 'active' ? "text-blue-500" :
                    currentCycle.status === 'voting' ? "text-[hsl(var(--accent))]" : "text-green-500"
                  )}>{currentCycle.status}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[hsl(var(--text-muted))]">Ends On</span>
                  <span className="text-[hsl(var(--text-primary))] font-bold">
                    {currentCycle.endDate instanceof Timestamp ? format(currentCycle.endDate.toDate(), 'MMM d, yyyy') : 'TBD'}
                  </span>
                </div>
                <div className="pt-4">
                  <div className="h-2 w-full rounded-full inset-well overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[hsl(42,90%,58%)] to-[hsl(36,95%,46%)] rounded-full transition-all" style={{ width: currentCycle.status === 'completed' ? '100%' : currentCycle.status === 'voting' ? '75%' : '25%' }} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
