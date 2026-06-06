# Senaryo 6 (İntibak) — Manuel Test Rehberi (Tarayıcı)

> Artık İntibak UI'ı gerçek backend'e (Neon + in-memory) bağlı. Bu rehber, test
> report'taki 6A–6L case'lerini tarayıcıda adım adım denemen içindir.

## Hazırlık

1. Backend çalışıyor: `cd backend && npm run dev` → http://localhost:3001
2. Frontend çalışıyor: `npm run dev` (kökte) → **http://localhost:3000**
3. **Her case'ten önce temiz başlangıç** (kilit/önceki intibakları sıfırlar):
   ```bash
   curl -X POST http://localhost:3001/api/dev/reset      # in-memory (intibak tabloları, kilitler)
   cd backend && npx ts-node prisma/seed.ts              # Neon başvuru durumları → baseline
   ```
4. Giriş bilgileri:
   - **YGK Üyesi** (6A–6H, 6K, 6L): TCKN `22222222222`, şifre `ygk123`
   - **YGK Başkanı** (6I, 6J): TCKN `33333333333`, şifre `ygkchair123`
5. Navigasyon: Giriş → **YGK Komisyon Paneli** → **"Ders Muafiyeti (İntibak)"** kartı → **İntibak Kuyruğu**.
   - Kuyruğun üstündeki açılır menüden **bölüm** seçilir (6F için Elektrik-Elektronik).

## Bu kurulumdaki gerçek müfredat kodları (rapordakilerden farklı olabilir)

Bilgisayar Müh. hedef müfredatı: **CMPE101** (Introduction to Programming),
**CMPE112** (Discrete Mathematics), **CMPE213** (Data Structures),
**MATH101** (Calculus I), **MATH102** (Calculus II), **MATH100** (Calculus I+II Combined),
**PHYS101** (Physics I), **ENG101** (English I), **ENG111** (English Elective).

> **Kaydetme kuralı:** Tablo kaydedilebilmesi için **her hedef ders** karara
> bağlanmalı. Kaynak dersleri eşleştirdikten sonra, alttaki **"Hedef Müfredat
> Kapsamı"** panelinde kalan dersler için **"Kalanları 'Eşdeğeri Yok' işaretle"**
> butonuna basıp sonra **Kaydet**.

---

## Case adımları

### 6A — Başarılı İntibak (Ahmet Kaya)
1. Kuyrukta **Ahmet Kaya** → "İntibak Hazırla".
2. 4 önceki ders + yeşil **"Önerilen Eşleşme"** rozetleri görünür (CMPE101→CMPE101, Calculus I→MATH101, PHYS101→PHYS101, ENG101→ENG101).
3. **"Tüm Önerileri Onayla"** → rozetler **"Onaylandı"**.
4. **"Kalanları 'Eşdeğeri Yok' işaretle"** → kalan hedefler karara bağlanır.
5. **"İntibak Tablosunu Kaydet"** → ✅ "İntibak tablosu kaydedildi.". Kuyrukta Ahmet artık **"İntibak Tamamlandı"**.
- **Beklenen:** Başarı; başvuru durumu Neon'da `INTIBAK_COMPLETED`.

### 6B — Manuel Override (Zeynep Demir)
1. Zeynep Demir → Hazırla. Calculus I satırının önerisi **MATH101**.
2. O satırın açılırından **MATH102 — Calculus II** seç → rozet **"Manuel Eşleşme"** (turuncu).
3. Diğer öneriyi onayla, kalanları "Eşdeğeri Yok", Kaydet.
- **Beklenen:** Override satırı turuncu; kaydedilir. (Tekrar açınca override korunur.)

### 6C — Çoktan-Teke Eşleme (Berk Yilmaz)
1. Berk Yilmaz → Hazırla. CALC1 ve CALC2 satırları (öneri yok, "Karar bekliyor").
2. **CALC1** için açılırdan **MATH100 — Calculus I+II Combined** seç.
3. **CALC2** için de **MATH100** seç. (İki kaynak → tek hedef.)
4. Kalanları "Eşdeğeri Yok", Kaydet.
- **Beklenen:** Her iki satır MATH100'e bağlı (Manuel Eşleşme); kaydedilir.

### 6D — Muaf Değil (Duru Celik)
1. Duru Celik → Hazırla. CMPE101 önerilir; **HIST200** (Ottoman History) önerisiz.
2. HIST200 satırında açılırdan **"Muaf Değil / Eşdeğeri Yok"** seç → kırmızı **"Muaf Değil"** rozeti.
3. CMPE101'i onayla, kalanları "Eşdeğeri Yok", Kaydet.
- **Beklenen:** HIST200 "Muaf Değil"; kaydedilir, durum `INTIBAK_COMPLETED`.

### 6E — OCR Başarısız → Manuel Giriş (Elif Yildiz)
1. Elif Yildiz → Hazırla. **Sarı uyarı**: "Transkript otomatik okunamadı…", kaynak listesi boş.
2. Formdan ders ekle (ör. Kod `CMPE101`, Ad `Introduction to Programming`, Not `AA`, AKTS `6`) → **Ekle**. Birkaç ders ekle.
3. **"Öneri"** (Önerileri Oluştur) → eklenen dersler için öneriler gelir.
4. Onayla, kalanları "Eşdeğeri Yok", Kaydet.
- **Beklenen:** Manuel giriş sonrası kaydedilir.

### 6F — Müfredat Tanımsız → Bloklu (Can Aydin)
1. Kuyruk üstünden bölümü **"Elektrik-Elektronik Müh. (müfredat tanımsız)"** seç.
2. **Can Aydin** → İntibak Hazırla.
- **Beklenen:** Kırmızı **"İntibak Başlatılamadı"** kartı, kod `CURRICULUM_NOT_DEFINED`. Tablo açılmaz, durum değişmez.

### 6G — Öneri Yok → Tam Manuel (Sude Arslan)
1. (Bilgisayar Müh.) Sude Arslan → Hazırla. **Sarı uyarı**: "Otomatik eşleşme bulunamadı." Tüm satırlar "Karar bekliyor".
2. FA240 → açılırdan **ENG111** (Manuel Eşleşme). FA210/FA230/FA250 → **"Muaf Değil"**.
3. Kalan hedefleri "Eşdeğeri Yok", Kaydet.
- **Beklenen:** Tümü elle karara bağlanır; kaydedilir.

### 6H — Kaydet Engeli (Mert Koc)
1. Mert Koc → Hazırla. Önerileri Onayla.
2. **Bilerek** CMPE112'yi "Eşdeğeri Yok" yapma (kapsam panelinde kararsız bırak). Kaydet.
- **Beklenen:** ❌ "Her hedef ders için karar verilmeli…"; **CMPE112 kırmızı** vurgulanır. Durum değişmez.
3. CMPE112 için "Eşdeğeri Yok" → Kaydet.
- **Beklenen:** ✅ kaydedilir.

### 6K — OCR Başarılı (Selin Aksoy)
1. Selin Aksoy → Hazırla.
- **Beklenen:** Sarı uyarı **yok**; tam **4 ders** (CMPE101/AA/6, MATH151/BA/7, PHYS101/CB/6, ENG101/AA/3) ve öneriler görünür.

### 6L — Benzerlik Eşiği (Cem Polat)
1. Cem Polat → Hazırla. Satırları incele:
- **Beklenen:**
  - CMP101 → **CMPE101** (Önerilen Eşleşme)
  - MAT150 → **MATH101** (Önerilen Eşleşme)
  - CSE220 → **CMPE213** (Önerilen Eşleşme)
  - HIST200 → öneri yok ("Karar bekliyor")
  - CMPE999 → öneri yok ("Karar bekliyor")
  - (Önerili satırlarda "Benzerlik skoru" görünür.)

### 6J — Paket Bloklu (YGK Başkanı)
1. Başkan olarak giriş (`33333333333` / `ygkchair123`). İntibak → Kuyruk → **"Paket / Dekanlığa Gönder"**.
- **Beklenen:** Kırmızı kart "N başvurunun intibakı bekliyor — paket gönderilemez", bekleyen isimler listelenir; gönder butonu kilitli. (En az 1 Asil tamamlanmamışken.)

### 6I — Başarılı Paket Gönderimi (YGK Başkanı)
> **Ön koşul:** O bölümdeki **tüm Asil** adayların intibakı tamamlanmış olmalı.
> Bilgisayar Müh.'de 11 Asil var; hepsini tamamlamak manuel olarak uzundur.
> Pratik öneri: 6I'yı doğrulamak için ya hepsini tamamla, ya da otomatik teste güven
> (`npx jest tests/intibak/6i-package-export-success.test.ts`).
1. Tüm Asil tamamlandığında: Kuyruk yeşil **"Paket gönderime hazır"**.
2. "Paket / Dekanlığa Gönder" → "Paketi Gönder" → imza şifresi **`ygk-chair-signature`** → "İmzala ve Gönder".
- **Beklenen:** ✅ "Paket Dekanlığa iletildi."; Asil/Yedek/Red başvuru durumları "Dekanlık İncelemesi Bekliyor" olur.

---

## Notlar
- Backend mantığı + bu akışlar otomatik testlerle de doğrulanır: `cd backend && npm test` (49 suite / 106 test).
- "Görüntüle" ile açılan **tamamlanmış** intibak salt-görünümdür (kilitli).
- Bir case'i tekrar denemeden önce 3. adımdaki reset komutlarını çalıştır.
