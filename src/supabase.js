import { createClient } from '@supabase/supabase-js';

// Configuration keys from Env or LocalStorage
const envConfig = {
  url: import.meta.env.VITE_SUPABASE_URL || '',
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || ''
};

const localConfig = {
  url: localStorage.getItem('sb_url') || '',
  anonKey: localStorage.getItem('sb_anonKey') || ''
};

const supabaseConfig = {
  url: localConfig.url || envConfig.url,
  anonKey: localConfig.anonKey || envConfig.anonKey
};

let supabase = null;
let isSupabaseConfigured = false;

if (supabaseConfig.url && supabaseConfig.anonKey) {
  try {
    supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
    isSupabaseConfigured = true;
    console.log('Supabase client initialized successfully.');
  } catch (error) {
    console.error('Supabase initialization failed:', error);
  }
}

// -------------------------------------------------------------
// Simulated Supabase Authentication Fallback
// -------------------------------------------------------------
const SIMULATED_USERS_KEY = 'nexus_simulated_users';
const SIMULATED_CURRENT_USER_KEY = 'nexus_simulated_current_user';

function getSimulatedUsers() {
  return JSON.parse(localStorage.getItem(SIMULATED_USERS_KEY) || '[]');
}

function saveSimulatedUsers(users) {
  localStorage.setItem(SIMULATED_USERS_KEY, JSON.stringify(users));
}

const simulatedListeners = [];

function notifyAuthStateChanged(user) {
  simulatedListeners.forEach(listener => {
    try {
      listener(user);
    } catch (e) {
      console.error(e);
    }
  });
}

const simulatedAuth = {
  currentUser: JSON.parse(localStorage.getItem(SIMULATED_CURRENT_USER_KEY) || 'null'),
  
  signInWithEmailAndPassword: async (email, password) => {
    await new Promise(resolve => setTimeout(resolve, 600));
    const users = getSimulatedUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      throw new Error('auth/user-not-found: No user found with this email.');
    }
    if (user.password !== password) {
      throw new Error('auth/wrong-password: The password is incorrect.');
    }
    
    const loggedInUser = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || user.email.split('@')[0],
      emailVerified: true
    };
    
    simulatedAuth.currentUser = loggedInUser;
    localStorage.setItem(SIMULATED_CURRENT_USER_KEY, JSON.stringify(loggedInUser));
    notifyAuthStateChanged(loggedInUser);
    return { user: loggedInUser };
  },
  
  createUserWithEmailAndPassword: async (email, password, displayName) => {
    await new Promise(resolve => setTimeout(resolve, 800));
    const users = getSimulatedUsers();
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('auth/email-already-in-use: The email address is already in use by another account.');
    }
    
    const newUser = {
      uid: 'sim_' + Math.random().toString(36).substr(2, 9),
      email: email,
      password: password,
      displayName: displayName || email.split('@')[0]
    };
    
    users.push(newUser);
    saveSimulatedUsers(users);
    
    const loggedInUser = {
      uid: newUser.uid,
      email: newUser.email,
      displayName: newUser.displayName,
      emailVerified: true
    };
    
    simulatedAuth.currentUser = loggedInUser;
    localStorage.setItem(SIMULATED_CURRENT_USER_KEY, JSON.stringify(loggedInUser));
    notifyAuthStateChanged(loggedInUser);
    return { user: loggedInUser };
  },
  
  signOut: async () => {
    await new Promise(resolve => setTimeout(resolve, 300));
    simulatedAuth.currentUser = null;
    localStorage.removeItem(SIMULATED_CURRENT_USER_KEY);
    notifyAuthStateChanged(null);
  },
  
  onAuthStateChanged: (callback) => {
    simulatedListeners.push(callback);
    callback(simulatedAuth.currentUser);
    return () => {
      const idx = simulatedListeners.indexOf(callback);
      if (idx !== -1) {
        simulatedListeners.splice(idx, 1);
      }
    };
  },
  
  sendPasswordResetEmail: async (email) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const users = getSimulatedUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      throw new Error('auth/user-not-found: No user found with this email.');
    }
    console.log(`[Simulated Auth] Password reset email sent to ${email}`);
    return true;
  },

  signInWithGoogle: async () => {
    await new Promise(resolve => setTimeout(resolve, 800));
    const name = "B Karthik";
    const loggedInUser = {
      uid: 'sim_google_' + Math.random().toString(36).substr(2, 9),
      email: 'b.karthik@example.com',
      displayName: name,
      emailVerified: true
    };
    simulatedAuth.currentUser = loggedInUser;
    localStorage.setItem(SIMULATED_CURRENT_USER_KEY, JSON.stringify(loggedInUser));
    notifyAuthStateChanged(loggedInUser);
    return { user: loggedInUser };
  }
};

// Map Supabase User to unified user structure
function mapSupabaseUser(sbUser) {
  if (!sbUser) return null;
  const meta = sbUser.user_metadata || {};
  return {
    uid: sbUser.id,
    email: sbUser.email,
    displayName: meta.display_name || meta.full_name || meta.name || meta.given_name || sbUser.email.split('@')[0],
    emailVerified: !!sbUser.email_confirmed_at
  };
}

let cachedSupabaseUser = null;
if (isSupabaseConfigured && supabase) {
  // Sync-cache Supabase auth user
  supabase.auth.getSession().then(({ data: { session } }) => {
    cachedSupabaseUser = session ? mapSupabaseUser(session.user) : null;
  });
  supabase.auth.onAuthStateChange((event, session) => {
    cachedSupabaseUser = session ? mapSupabaseUser(session.user) : null;
  });
}

// -------------------------------------------------------------
// Unified Auth API Interface
// -------------------------------------------------------------
export const authService = {
  isSupabase: () => isSupabaseConfigured,
  isFirebase: () => false, 

  getCurrentUser: () => {
    return isSupabaseConfigured ? cachedSupabaseUser : simulatedAuth.currentUser;
  },
  
  signIn: async (email, password) => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return { user: mapSupabaseUser(data.user) };
    } else {
      return simulatedAuth.signInWithEmailAndPassword(email, password);
    }
  },
  
  signUp: async (email, password, displayName) => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName }
        }
      });
      if (error) throw error;
      return { user: mapSupabaseUser(data.user) };
    } else {
      return simulatedAuth.createUserWithEmailAndPassword(email, password, displayName);
    }
  },
  
  signOut: () => {
    if (isSupabaseConfigured) {
      return supabase.auth.signOut();
    } else {
      return simulatedAuth.signOut();
    }
  },
  
  onAuthStateChanged: (callback) => {
    if (isSupabaseConfigured) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        const user = session ? mapSupabaseUser(session.user) : null;
        cachedSupabaseUser = user;
        callback(user);
      });
      return () => subscription.unsubscribe();
    } else {
      return simulatedAuth.onAuthStateChanged(callback);
    }
  },
  
  resetPassword: (email) => {
    if (isSupabaseConfigured) {
      return supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin
      });
    } else {
      return simulatedAuth.sendPasswordResetEmail(email);
    }
  },

  signInWithGoogle: async () => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
      return data;
    } else {
      return simulatedAuth.signInWithGoogle();
    }
  },
  
  saveSupabaseConfig: (config) => {
    localStorage.setItem('sb_url', config.url || '');
    localStorage.setItem('sb_anonKey', config.anonKey || '');
  },
  
  getSupabaseConfig: () => {
    return {
      url: localStorage.getItem('sb_url') || envConfig.url,
      anonKey: localStorage.getItem('sb_anonKey') || envConfig.anonKey
    };
  }
};

// -------------------------------------------------------------
// Unified Database Sync Helpers (Supabase DB / Local Storage Fallback)
// -------------------------------------------------------------
const simulatedDB = {
  loadKanban: async (userId) => {
    return JSON.parse(localStorage.getItem(`nexus_kanban_${userId}`) || '[]');
  },
  saveKanban: async (userId, cards) => {
    localStorage.setItem(`nexus_kanban_${userId}`, JSON.stringify(cards));
  },
  loadKnowledge: async (userId) => {
    return JSON.parse(localStorage.getItem(`nexus_knowledge_${userId}`) || '[]');
  },
  saveKnowledge: async (userId, entries) => {
    localStorage.setItem(`nexus_knowledge_${userId}`, JSON.stringify(entries));
  }
};

export const dbService = {
  loadKanban: async (userId) => {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('users_data')
          .select('value')
          .eq('user_id', userId)
          .eq('key', 'kanban')
          .maybeSingle();
        
        if (!error && data) {
          return data.value || [];
        }
      } catch (error) {
        console.warn('Supabase loadKanban error:', error);
      }
    }
    return simulatedDB.loadKanban(userId);
  },
  
  saveKanban: async (userId, cards) => {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('users_data')
          .upsert({ user_id: userId, key: 'kanban', value: cards }, { onConflict: 'user_id,key' });
        return;
      } catch (error) {
        console.warn('Supabase saveKanban error:', error);
      }
    }
    await simulatedDB.saveKanban(userId, cards);
  },
  
  loadKnowledge: async (userId) => {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('users_data')
          .select('value')
          .eq('user_id', userId)
          .eq('key', 'knowledge')
          .maybeSingle();
        
        if (!error && data) {
          return data.value || [];
        }
      } catch (error) {
        console.warn('Supabase loadKnowledge error:', error);
      }
    }
    return simulatedDB.loadKnowledge(userId);
  },
  
  saveKnowledge: async (userId, entries) => {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('users_data')
          .upsert({ user_id: userId, key: 'knowledge', value: entries }, { onConflict: 'user_id,key' });
        return;
      } catch (error) {
        console.warn('Supabase saveKnowledge error:', error);
      }
    }
    await simulatedDB.saveKnowledge(userId, entries);
  }
};
