import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useBooks } from "@/contexts/BooksContext";
import { watchPendingOrders } from "@/lib/orders-owner-storage";
import { newOrderIds, playChime, readAlertPrefs } from "@/lib/order-alerts";
import { showNotification } from "@/lib/pwa";
import { orderCode, orderSubtotal } from "@/lib/catalog";
import { formatRupiah } from "@/lib/currency";

/**
 * Watches pending order requests while the app is open (also when it is in the
 * background) and announces new ones: pop-up, chime, system notification and
 * the app icon badge. Push while the app is fully closed needs a server and is
 * not part of the free setup.
 */
export function OrderAlerts() {
  const books = useBooks();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const seen = useRef<Set<string> | null>(null);
  const reload = useRef(books.reload);
  reload.current = books.reload;
  const where = useRef(pathname);
  where.current = pathname;
  const hasShop = !!books.store;

  useEffect(() => {
    if (!hasShop) return;
    let stop = () => {};
    try {
      stop = watchPendingOrders((orders) => {
        const ids = orders.map((o) => o.id);
        const fresh = newOrderIds(seen.current, ids);
        seen.current = new Set(ids);
        const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
        if (ids.length) void nav.setAppBadge?.(ids.length).catch(() => undefined);
        else void nav.clearAppBadge?.().catch(() => undefined);
        if (!fresh.length) return;
        const prefs = readAlertPrefs();
        const news = orders.filter((o) => fresh.includes(o.id));
        if (prefs.sound) playChime();
        for (const order of news.slice(0, 3)) {
          const title = `Pesanan baru dari ${order.buyerName}`;
          const body = `#${orderCode(order.id)} · ${order.items.length} produk · ${formatRupiah(orderSubtotal(order.items))}`;
          toast(title, {
            description: body,
            duration: 10000,
            action: { label: "Lihat", onClick: () => navigate(`/orders?id=${order.id}`) },
          });
          if (prefs.notify && (document.hidden || where.current !== "/orders"))
            void showNotification(title, body, `/orders?id=${order.id}`, `order-${order.id}`);
        }
        if (news.length > 3) toast(`${news.length - 3} pesanan baru lainnya`, { action: { label: "Buka Pesanan", onClick: () => navigate("/orders") } });
        void reload.current();
      });
    } catch {
      /* Signed out or no shop yet. */
    }
    return () => stop();
  }, [hasShop, navigate]);

  return null;
}
