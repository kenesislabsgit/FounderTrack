/**
 * API endpoint to migrate a user's Firebase UID to Supabase UID
 * Triggered automatically when user logs in with old Firebase profile
 */

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, newUid, selectedRole } = req.body;

  if (!email || !newUid || !selectedRole) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Use service role key to bypass RLS
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  try {
    // 1. Find old Firebase profile
    const { data: oldProfile, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .neq('uid', newUid)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching old profile:', fetchError);
      return res.status(500).json({ error: 'Failed to fetch profile' });
    }

    if (!oldProfile) {
      // No old profile, create new one
      const { error: createError } = await supabase.from('users').insert({
        uid: newUid,
        name: email.split('@')[0], // Fallback name
        email,
        role: selectedRole,
        photo_url: null,
      });

      if (createError) {
        console.error('Error creating profile:', createError);
        return res.status(500).json({ error: 'Failed to create profile' });
      }

      return res.status(200).json({ success: true, migrated: false });
    }

    // 2. Migrate old profile
    console.log(`Migrating user ${email}: ${oldProfile.uid} → ${newUid}`);

    // Temporarily rename old email
    await supabase
      .from('users')
      .update({ email: `${email}-old-${oldProfile.uid}` })
      .eq('uid', oldProfile.uid);

    // Create new profile
    await supabase.from('users').insert({
      uid: newUid,
      name: oldProfile.name,
      email: oldProfile.email,
      role: selectedRole,
      photo_url: oldProfile.photo_url,
      preferences: oldProfile.preferences,
    });

    // Migrate attendance
    const { error: attendanceErr } = await supabase
      .from('attendance')
      .update({ uid: newUid })
      .eq('uid', oldProfile.uid);

    // Migrate daily_reports
    const { error: reportsErr } = await supabase
      .from('daily_reports')
      .update({ uid: newUid })
      .eq('uid', oldProfile.uid);

    // Migrate leave_requests
    const { error: leavesErr } = await supabase
      .from('leave_requests')
      .update({ uid: newUid })
      .eq('uid', oldProfile.uid);

    // Migrate brainstorm_ideas
    const { error: ideasErr } = await supabase
      .from('brainstorm_ideas')
      .update({ uid: newUid })
      .eq('uid', oldProfile.uid);

    // Migrate ballots
    const { error: ballotsErr } = await supabase
      .from('ballots')
      .update({ voter_uid: newUid })
      .eq('voter_uid', oldProfile.uid);

    // Migrate review_cycles (underperformer)
    const { error: cycleUnderErr } = await supabase
      .from('review_cycles')
      .update({ underperformer_uid: newUid })
      .eq('underperformer_uid', oldProfile.uid);

    // Migrate review_cycles (tie_breaker)
    const { error: cycleTieErr } = await supabase
      .from('review_cycles')
      .update({ tie_breaker_uid: newUid })
      .eq('tie_breaker_uid', oldProfile.uid);

    // Delete old profile
    await supabase.from('users').delete().eq('uid', oldProfile.uid);

    console.log(`Migration complete for ${email}`);

    return res.status(200).json({
      success: true,
      migrated: true,
      errors: {
        attendance: attendanceErr?.message,
        reports: reportsErr?.message,
        leaves: leavesErr?.message,
        ideas: ideasErr?.message,
        ballots: ballotsErr?.message,
        cycleUnder: cycleUnderErr?.message,
        cycleTie: cycleTieErr?.message,
      },
    });
  } catch (error) {
    console.error('Migration error:', error);
    return res.status(500).json({ error: error.message });
  }
}
