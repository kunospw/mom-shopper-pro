import { Transaction } from "@/types/transaction";
import { UserProfile } from "@/types/user";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, addDoc, serverTimestamp, query, orderBy, where } from "firebase/firestore";
import { db } from "./firebase";
import { auth } from "./firebase";

const STORAGE_KEY = "reseller-transactions";
const USER_PROFILE_KEY = "user-profile";

// Helper function to get current user ID
const getCurrentUserId = (): string | null => {
  return auth.currentUser?.uid || null;
};

// Migration function to move localStorage data to Firebase
export const migrateLocalStorageToFirebase = async (): Promise<void> => {
  const userId = getCurrentUserId();
  if (!userId) return;

  try {
    const localData = localStorage.getItem(STORAGE_KEY);
    if (!localData) return;

    const transactions: Transaction[] = JSON.parse(localData);
    if (transactions.length === 0) return;

    console.log(`Migrating ${transactions.length} transactions to Firebase...`);

    // Check if user already has transactions in Firebase
    const existingTransactions = await getTransactions();
    if (existingTransactions.length > 0) {
      console.log("Firebase transactions already exist, skipping migration");
      return;
    }

    // Migrate each transaction
    const transactionsRef = collection(db, "users", userId, "transactions");
    for (const transaction of transactions) {
      const { id, ...transactionData } = transaction;
      await addDoc(transactionsRef, {
        ...transactionData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }

    console.log("Migration completed successfully!");
    
    // Optionally clear localStorage after successful migration
    // localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Error during migration:", error);
  }
};

// Firebase-based transaction operations
export const getTransactions = async (): Promise<Transaction[]> => {
  const userId = getCurrentUserId();
  if (!userId) {
    // Fallback to localStorage if user not authenticated
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  }

  try {
    const transactionsRef = collection(db, "users", userId, "transactions");
    const q = query(transactionsRef, orderBy("date", "desc"));
    const querySnapshot = await getDocs(q);
    
    const transactions: Transaction[] = [];
    querySnapshot.forEach((doc) => {
      transactions.push({
        id: doc.id,
        ...doc.data()
      } as Transaction);
    });
    
    return transactions;
  } catch (error) {
    console.error("Error fetching transactions:", error);
    // Fallback to localStorage
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  }
};

export const saveTransactions = (transactions: Transaction[]) => {
  // Keep localStorage as backup
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
};

export const addTransaction = async (transaction: Transaction): Promise<void> => {
  const userId = getCurrentUserId();
  if (!userId) {
    // Fallback to localStorage
    const transactions = await getTransactions();
    transactions.push(transaction);
    saveTransactions(transactions);
    return;
  }

  try {
    const transactionsRef = collection(db, "users", userId, "transactions");
    const { id, ...transactionData } = transaction;
    
    await addDoc(transactionsRef, {
      ...transactionData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    // Also save to localStorage as backup
    const transactions = await getTransactions();
    transactions.unshift(transaction);
    saveTransactions(transactions);
  } catch (error) {
    console.error("Error adding transaction:", error);
    // Fallback to localStorage
    const transactions = await getTransactions();
    transactions.push(transaction);
    saveTransactions(transactions);
    throw error;
  }
};

export const updateTransaction = async (id: string, updatedTransaction: Transaction): Promise<void> => {
  const userId = getCurrentUserId();
  if (!userId) {
    // Fallback to localStorage
    const transactions = await getTransactions();
    const index = transactions.findIndex((t) => t.id === id);
    if (index !== -1) {
      transactions[index] = updatedTransaction;
      saveTransactions(transactions);
    }
    return;
  }

  try {
    const transactionDoc = doc(db, "users", userId, "transactions", id);
    const { id: docId, ...transactionData } = updatedTransaction;
    
    await updateDoc(transactionDoc, {
      ...transactionData,
      updatedAt: serverTimestamp()
    });
    
    // Update localStorage backup
    const transactions = await getTransactions();
    const index = transactions.findIndex((t) => t.id === id);
    if (index !== -1) {
      transactions[index] = updatedTransaction;
      saveTransactions(transactions);
    }
  } catch (error) {
    console.error("Error updating transaction:", error);
    // Fallback to localStorage
    const transactions = await getTransactions();
    const index = transactions.findIndex((t) => t.id === id);
    if (index !== -1) {
      transactions[index] = updatedTransaction;
      saveTransactions(transactions);
    }
    throw error;
  }
};

export const deleteTransaction = async (id: string): Promise<void> => {
  const userId = getCurrentUserId();
  if (!userId) {
    // Fallback to localStorage
    const transactions = await getTransactions();
    const filtered = transactions.filter((t) => t.id !== id);
    saveTransactions(filtered);
    return;
  }

  try {
    const transactionDoc = doc(db, "users", userId, "transactions", id);
    await deleteDoc(transactionDoc);
    
    // Update localStorage backup
    const transactions = await getTransactions();
    const filtered = transactions.filter((t) => t.id !== id);
    saveTransactions(filtered);
  } catch (error) {
    console.error("Error deleting transaction:", error);
    // Fallback to localStorage
    const transactions = await getTransactions();
    const filtered = transactions.filter((t) => t.id !== id);
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
