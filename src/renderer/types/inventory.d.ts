/* ═══════════════════════════════════════════════════════════════════════════ */
/*                     ENVANTER ÖĞESİ TİP TANIMI                            */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── InventoryItem Arayüzü ─────────────────── */

interface InventoryItem {
  date: string;
  component: string;
  brand: string;
  specs: string;
  price: number | string;
  vendor: string;
  status: string;
  url: string;
  imageUrl: string;
  star: number;
  opinion: string;
  _searchTag?: string;
  _statusNorm?: string;
}
