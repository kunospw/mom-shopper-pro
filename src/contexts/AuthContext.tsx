import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { AuthContextType, UserProfile } from '@/types/user';
import { getUserProfile, createUserProfile, updateUserProfile as updateUserProfileInDB } from '@/lib/storage';
import { toast } from 'sonner';

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        try {
          // Get or create user profile
          let userProfile = await getUserProfile(firebaseUser.uid);
          
          if (!userProfile) {
            // Create new user profile
            const newProfile: Omit<UserProfile, 'createdAt' | 'updatedAt'> = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || '',
              photoURL: firebaseUser.photoURL || undefined,
            };
            
            await createUserProfile(newProfile);
            userProfile = await getUserProfile(firebaseUser.uid);
          }
          
          setUser(userProfile);
        } catch (error) {
          console.error('Error loading user profile:', error);
          toast.error('Gagal memuat profil pengguna');
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      toast.success(`Selamat datang, ${result.user.displayName || result.user.email}!`);
    } catch (error: any) {
      console.error('Sign-in error:', error);
      
      // Handle specific error cases
      if (error.code === 'auth/popup-closed-by-user') {
        // User closed popup - this is normal behavior, don't show error
        return;
      } else if (error.code === 'auth/popup-blocked') {
        toast.error('Popup diblokir browser. Silakan izinkan popup dan coba lagi.');
      } else if (error.code === 'auth/cancelled-popup-request') {
        // Another popup was opened - don't show error
        return;
      } else {
        toast.error('Gagal masuk dengan Google. Silakan coba lagi.');
      }
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      toast.success('Berhasil keluar');
    } catch (error) {
      console.error('Sign-out error:', error);
      toast.error('Gagal keluar');
      throw error;
    }
  };

  const updateUserProfile = async (data: Partial<UserProfile>) => {
    if (!user) throw new Error('No user logged in');
    
    try {
      await updateUserProfileInDB(user.uid, data);
      
      // Update local state
      setUser(prev => prev ? { ...prev, ...data, updatedAt: new Date() } : null);
      toast.success('Profil berhasil diperbarui');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Gagal memperbarui profil');
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    signInWithGoogle,
    signOut,
    updateUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};