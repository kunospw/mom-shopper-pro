export interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  businessAccent?: "forest" | "teal" | "blue" | "violet";
  businessLogo?: string;
  // Business information
  businessName?: string;
  businessAddress?: string;
  businessPhone?: string;
  // Payment information
  bankAccounts?: BankAccount[];
  qrisImageBase64?: string;
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfileForm {
  businessAccent?: "forest" | "teal" | "blue" | "violet";
  businessLogo?: string;
  displayName: string;
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  bankAccounts: BankAccount[];
  qrisImage?: FileList;
}

// Auth context types
export interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
}