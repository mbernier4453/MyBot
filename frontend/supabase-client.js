// Supabase client configuration
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://vstxdwkdsuhlazzgyiux.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzdHhkd2tkc3VobGF6emd5aXV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwMzg0MTgsImV4cCI6MjA3NzYxNDQxOH0.vcR7hlNnBvT1VuCw1EOXTMELnui0iGgusQF5P7O6rwU';

// Create Supabase client with redirect configuration
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    redirectTo: 'https://alpharhythm.io/',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Auth helper functions
export async function signUp(email, password, metadata = {}) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata
    }
  });
  
  // If there's an error BUT the user was created, don't throw - return the user
  if (error) {
    console.error('[Supabase] Signup error:', error);
    // Check if user was still created despite error
    if (data && data.user) {
      console.log('[Supabase] User created despite error, proceeding');
      return data;
    }
    throw error;
  }
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

export async function getUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
}

// Listen for auth state changes
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}

// ============ USER SETTINGS HELPERS ============

// Get user settings (colors, groups, watchlists)
export async function getUserSettings() {
  const user = await getUser();
  if (!user) throw new Error('Not authenticated');
  
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle(); // Use maybeSingle() instead of single() to handle 0 rows
  
  if (error) {
    console.error('[SUPABASE] Error fetching user_settings:', error);
    throw error;
  }
  
  // If no row exists, return defaults
  return data || { colors: {}, ticker_groups: [], watchlists: [] };
}

// Save user colors
export async function saveUserColors(colors) {
  const user = await getUser();
  if (!user) throw new Error('Not authenticated');
  
  const { data, error } = await supabase
    .from('user_settings')
    .upsert(
      { user_id: user.id, colors, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// Save ticker groups
export async function saveTickerGroups(ticker_groups) {
  const user = await getUser();
  if (!user) throw new Error('Not authenticated');
  
  const { data, error } = await supabase
    .from('user_settings')
    .upsert(
      { user_id: user.id, ticker_groups, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// Save watchlists
export async function saveWatchlists(watchlists) {
  const user = await getUser();
  if (!user) throw new Error('Not authenticated');
  
  const { data, error } = await supabase
    .from('user_settings')
    .upsert(
      { user_id: user.id, watchlists, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    .select()
    .single();
  
  if (error) throw error;
  return data;
}
