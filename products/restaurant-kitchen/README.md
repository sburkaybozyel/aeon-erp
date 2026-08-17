# AEON QR Menü + Restoran + Mutfak

Bu klasör ana AEON ERP’den bağımsız çalışan ayrı bir Cloudflare Worker ürünüdür.

- Worker: `aeon-restaurant-kitchen`
- D1: `aeon-restaurant-kitchen-db`
- Kendi API’si: `/api/menu`, `/api/orders`, `/api/tables`
- Kendi sayfaları: `/guest`, `/restaurant`, `/kitchen`

Bu üründe ana AEON ERP importu, `AEON_DB`, `AEON_CRM_DB`, ana ERP session’ı, ana tenant yönlendirmesi veya ana ERP frontend dosyası yoktur.
