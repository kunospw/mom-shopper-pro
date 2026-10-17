import { Transaction } from "@/types/transaction";
import { UserProfile } from "@/types/user";
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  collection, 
  query, 
  orderBy, 
  getDocs,
  serverTimestamp,
  where 
} from "firebase/firestore";
import { db } from "./firebase";
import { auth } from "./firebase";

const STORAGE_KEY = "reseller-transactions";
const USER_PROFILE_KEY = "user-profile";

// Firebase operations for transactions
export const getTransactions = async (): Promise<Transaction[]> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.log("No authenticated user, using localStorage fallback");
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    }

    const transactionsRef = collection(db, "users", user.uid, "transactions");
    const q = query(transactionsRef, orderBy("date", "desc"));
    const querySnapshot = await getDocs(q);
    
    const transactions: Transaction[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      transactions.push({
        ...data,
        id: doc.id,
        date: data.date || new Date().toISOString()
      } as Transaction);
    });
    
    console.log(`Loaded ${transactions.length} transactions from Firebase`);
    return transactions;
  } catch (error) {
    console.error("Error fetching transactions from Firebase:", error);
    // Fallback to localStorage
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  }
};

export const saveTransactions = (transactions: Transaction[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
};

export const addTransaction = async (transaction: Transaction): Promise<void> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.log("No authenticated user, using localStorage fallback");
      const transactions = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      transactions.push(transaction);
      saveTransactions(transactions);
      return;
    }

    const transactionRef = doc(db, "users", user.uid, "transactions", transaction.id);
    await setDoc(transactionRef, {
      ...transaction,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    console.log("Transaction added to Firebase:", transaction.id);
  } catch (error) {
    console.error("Error adding transaction to Firebase:", error);
    // Fallback to localStorage
    const transactions = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    transactions.push(transaction);
    saveTransactions(transactions);
    throw error;
  }
};

export const updateTransaction = async (id: string, updatedTransaction: Transaction): Promise<void> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.log("No authenticated user, using localStorage fallback");
      const transactions = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      const index = transactions.findIndex((t: Transaction) => t.id === id);
      if (index !== -1) {
        transactions[index] = updatedTransaction;
        saveTransactions(transactions);
      }
      return;
    }

    const transactionRef = doc(db, "users", user.uid, "transactions", id);
    await updateDoc(transactionRef, {
      ...updatedTransaction,
      updatedAt: serverTimestamp()
    });
    
    console.log("Transaction updated in Firebase:", id);
  } catch (error) {
    console.error("Error updating transaction in Firebase:", error);
    // Fallback to localStorage
    const transactions = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    const index = transactions.findIndex((t: Transaction) => t.id === id);
    if (index !== -1) {
      transactions[index] = updatedTransaction;
      saveTransactions(transactions);
    }
    throw error;
  }
};

export const deleteTransaction = async (id: string): Promise<void> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.log("No authenticated user, using localStorage fallback");
      const transactions = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      const filtered = transactions.filter((t: Transaction) => t.id !== id);
      saveTransactions(filtered);
      return;
    }

    const transactionRef = doc(db, "users", user.uid, "transactions", id);
    await deleteDoc(transactionRef);
    
    console.log("Transaction deleted from Firebase:", id);
  } catch (error) {
    console.error("Error deleting transaction from Firebase:", error);
    // Fallback to localStorage
    const transactions = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    const filtered = transactions.filter((t: Transaction) => t.id !== id);
    saveTransactions(filtered);
    throw error;
  }
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
    // Firestore rejects undefined values (e.g. a Google account without a photo)
    const defined = Object.fromEntries(Object.entries(profile).filter(([, value]) => value !== undefined));
    await setDoc(doc(db, "users", profile.uid), {
      ...defined,
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
