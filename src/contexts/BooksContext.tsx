import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getCustomers,
  getExpenses,
  getInventory,
  getPurchases,
  getSales,
  migrateLegacyTransactions,
} from "@/lib/books-storage";
import type {
  Customer,
  Expense,
  Inventory,
  Purchase,
  Sale,
} from "@/types/books";

interface BooksState {
  sales: Sale[];
  purchases: Purchase[];
  expenses: Expense[];
  customers: Customer[];
  inventory: Record<string, Inventory>;
  loading: boolean;
  error: boolean;
  reload: () => Promise<void>;
}
const BooksContext = createContext<BooksState | null>(null);

export function BooksProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [data, setData] = useState({
    sales: [] as Sale[],
    purchases: [] as Purchase[],
    expenses: [] as Expense[],
    customers: [] as Customer[],
    inventory: {} as Record<string, Inventory>,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async (migrate: boolean) => {
    try {
      // Migration is best-effort and idempotent; never block the books on it.
      if (migrate) await migrateLegacyTransactions().catch(() => 0);
      const [sales, purchases, expenses, customers, inventory] =
        await Promise.all([
          getSales(),
          getPurchases(),
          getExpenses(),
          getCustomers(),
          getInventory(),
        ]);
      setData({ sales, purchases, expenses, customers, inventory });
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);
    void load(true);
  }, [user?.uid, load]);

  const value = useMemo<BooksState>(
    () => ({ ...data, loading, error, reload: () => load(false) }),
    [data, loading, error, load],
  );
  return <BooksContext.Provider value={value}>{children}</BooksContext.Provider>;
}

export function useBooks() {
  const value = useContext(BooksContext);
  if (!value) throw new Error("useBooks must be used inside BooksProvider");
  return value;
}
