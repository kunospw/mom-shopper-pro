// Usage inside page.evaluate: await window.__seedDemo()
export const seedSource = `
(async () => {
  const d = globalThis.__db;
  d.sales = []; d.purchases = []; d.expenses = []; d.orders = []; d.customers = [];
  const now = new Date();
  const at = (monthsAgo, day, h = 10) => new Date(now.getFullYear(), now.getMonth() - monthsAgo, day, h).toISOString();
  const ff = (status, courier = "", trackingNo = "") => ({ status, courier, trackingNo, deliveryNote: "", updatedAt: new Date().toISOString() });
  const pay = (amount, date, method = "Transfer") => ({ id: Math.random().toString(36).slice(2), amount, method, date, note: "" });
  const item = (name, option, quantity, unitPrice, unitCost, kind = "physical") => ({ name, option, quantity, unitPrice, unitCost, kind });
  const people = [["Ayu Lestari","6281277889911"],["Rini Susanti","6281311122233"],["Maya Kusuma","6281399988877"],["Endang Setiawati","6281255544433"],["Sri Wahyuni","6281277766655"],["Lina Marlina","6281244433322"],["Dewi Anggraini","6281233322211"]];
  for (const [name, wa] of people) await globalThis.__saveCustomer({ id: name.replace(/ /g,"-").toLowerCase(), name, whatsapp: wa, address: "Bekasi", note: "" });
  let seq = 1;
  const sale = async (date, who, items, payments, f, extra = {}) => {
    const [name, wa] = people.find((p) => p[0] === who);
    await globalThis.__saveSale({ date, channel: "manual", customer: { name, whatsapp: wa, address: "Bekasi Timur" }, items, shipping: 15000, discount: 0, fees: 0, payments, fulfillment: f, notes: "", ...extra }, undefined, { sequence: seq++ });
  };
  // past months for the chart
  const monthly = [5.2, 6.1, 5.6, 7.4, 8.3];
  for (let m = 5; m >= 1; m--) {
    const target = monthly[5 - m] * 1_000_000;
    let made = 0, day = 2;
    while (made < target) {
      const price = 150000 + ((day * 37) % 5) * 40000, qty = 1 + (day % 3);
      await sale(at(m, day), people[day % people.length][0], [item("Gamis Katun Rayon", "L", qty, price, Math.round(price * 0.55))], [pay(price * qty + 15000, at(m, day))], ff("done"));
      made += price * qty; day += 2; if (day > 27) break;
    }
    await globalThis.__savePurchase({ id: "pm" + m, date: at(m, 3), supplier: "CV Rayon Jaya", items: [{ name: "Gamis Katun Rayon", quantity: 20, unitCost: 110000 }], shipping: 45000, total: 2245000, notes: "" });
    await globalThis.__saveExpense({ id: "em" + m, date: at(m, 12), category: "iklan", amount: 150000, note: "Iklan Instagram" });
  }
  // this month
  await sale(at(0, 2), "Lina Marlina", [item("Hijab Voal Paris", "Mocca", 3, 45000, 22000)], [pay(150000, at(0, 2), "EWallet")], ff("done"));
  await sale(at(0, 3), "Dewi Anggraini", [item("Mukena Travel Parasut", "Sage", 2, 165000, 90000)], [pay(345000, at(0, 3), "QRIS")], ff("done"));
  await sale(at(0, 5), "Sri Wahyuni", [item("Gamis Katun Rayon", "M", 1, 189000, 104000), item("Hijab Voal Paris", "Navy", 2, 45000, 22000)], [pay(159000, at(0, 5))], ff("confirmed"));
  await sale(at(0, 7), "Endang Setiawati", [item("Gamis Katun Rayon", "XL", 1, 199000, 110000), item("Keripik Tempe Pedas", "Level 3", 1, 28000, 15000)], [pay(53000, at(0, 7), "Cash")], ff("packed"));
  await sale(at(0, 9), "Rini Susanti", [item("Gamis Katun Rayon", "L", 2, 189000, 104000), item("Hijab Voal Paris", "Mocca", 1, 45000, 22000)], [pay(200000, at(0, 9), "QRIS")], ff("confirmed"));
  await sale(at(0, 11), "Maya Kusuma", [item("Gamis Katun Rayon", "S", 1, 179000, 99000), item("E-book Resep MPASI", "", 1, 35000, 0, "digital")], [pay(229000, at(0, 11))], ff("packed"));
  await sale(at(0, 12), "Ayu Lestari", [item("Mukena Travel Parasut", "Sage", 1, 165000, 90000)], [], ff("shipped", "JNE", "JNE0198832245"));
  await globalThis.__savePurchase({ id: "p0", date: at(0, 4), supplier: "CV Rayon Jaya", items: [{ name: "Gamis Katun Rayon", quantity: 20, unitCost: 120000 }], shipping: 45000, total: 2445000, notes: "" });
  await globalThis.__saveExpense({ id: "e0", date: at(0, 10), category: "iklan", amount: 150000, note: "Iklan Instagram" });
  const shop = { name: d.store.name, whatsapp: d.store.whatsapp, slug: d.store.slug };
  const req = (id, buyer, hoursAgo, items, note = "") => d.orders.push({ id, status: "pending", progress: "pending", buyerName: buyer, note, items, subtotal: items.reduce((s, i) => s + i.unitPrice * i.quantity, 0), trackingNo: "", sellerNote: "", shop, steps: {}, createdAt: new Date(Date.now() - hoursAgo * 3600000).toISOString() });
  const oi = (productId, name, option, quantity, unitPrice, kind = "physical") => ({ productId, name, option, kind, unitPrice, quantity, availability: "ready", leadTime: "" });
  req("k7q2mdx1", "Ayu Lestari", 2, [oi("p1", "Kemeja Linen", "Hitam", 1, 150000), oi("p2", "Voucher Game", "", 2, 50000, "digital")], "Kak, bisa kirim ke Bekasi Timur? Mau dipakai Minggu.");
  req("p3xw9ax2", "Fitri Handayani", 5, [oi("p1", "Kemeja Linen", "Putih", 1, 155000)]);
  req("z8lm2cx3", "Nadia Putri", 100, [oi("p3", "Tas Rajut", "", 1, 200000)]);
  localStorage.setItem("__mockdb_v1", JSON.stringify(d));
})()`;
