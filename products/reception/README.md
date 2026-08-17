# AEON Ön Büro / Resepsiyon

Bu klasör ana AEON ERP’den bağımsız çalışan ayrı bir Cloudflare Worker ürünüdür.

- Worker: `aeon-reception`
- D1: `aeon-reception-db`
- Kendi API’si: `/api/rooms`, `/api/reservations`, `/api/precheckins`
- Kendi sayfaları: `/reception`, `/precheckin`

Bu üründe ana AEON ERP importu, `AEON_DB`, `AEON_CRM_DB`, ana ERP session’ı, ana tenant yönlendirmesi veya ana ERP frontend dosyası yoktur.
