import { Transaction } from "@/types/transaction";
import { UserProfile } from "@/types/user";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

const STORAGE_KEY = "reseller-transactions";
const USER_PROFILE_KEY = "user-profile";

export const getTransactions = (): Transaction[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveTransactions = (transactions: Transaction[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
};

export const addTransaction = (transaction: Transaction) => {
  const transactions = getTransactions();
  transactions.push(transaction);
  saveTransactions(transactions);
};

export const updateTransaction = (id: string, updatedTransaction: Transaction) => {
  const transactions = getTransactions();
  const index = transactions.findIndex((t) => t.id === id);
  if (index !== -1) {
    transactions[index] = updatedTransaction;
    saveTransactions(transactions);
  }
};

export const deleteTransaction = (id: string) => {
  const transactions = getTransactions();
  const filtered = transactions.filter((t) => t.id !== id);
  saveTransactions(filtered);
};

// User Profile Firebase operations
export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      return {
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as UserProfile;
    }
    return null;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
};

export const createUserProfile = async (profile: Omit<UserProfile, 'createdAt' | 'updatedAt'>): Promise<void> => {
  try {
    await setDoc(doc(db, "users", profile.uid), {
      ...profile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error creating user profile:", error);
    throw error;
  }
};

export const updateUserProfile = async (uid: string, updates: Partial<UserProfile>): Promise<void> => {
  try {
    // Filter out undefined values as Firestore doesn't accept them
    const filteredUpdates: any = {};
    Object.keys(updates).forEach(key => {
      const value = (updates as any)[key];
      if (value !== undefined) {
        filteredUpdates[key] = value;
      }
    });

    await updateDoc(doc(db, "users", uid), {
      ...filteredUpdates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating user profile:", error);
    throw error;
  }
};

// Local storage fallback for user preferences
export const getLocalUserProfile = (): Partial<UserProfile> | null => {
  const data = localStorage.getItem(USER_PROFILE_KEY);
  return data ? JSON.parse(data) : null;
};

export const saveLocalUserProfile = (profile: Partial<UserProfile>) => {
  localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
};
