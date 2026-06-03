# Panduan Lengkap & Skrip Presentasi Proyek Akhir PBL - Keamanan Informasi (KOM1315)

Dokumen ini disusun sebagai panduan *ultra-detail* untuk memandu presentasi Anda. Setiap slide dilengkapi dengan **Poin Utama** (teks yang akan tampil di slide) dan **Catatan Pembicara / Skrip Presentasi** (teks yang harus Anda ucapkan atau pahami secara mendalam). Jangan ragu untuk membaca bagian catatan secara perlahan dan meyakinkan, karena di situlah letak kedalaman teknis (*depth*) proyek Anda.

---

## Slide 1. Judul Proyek
**Poin Utama:**
* **Sistem:** TUMBUH - Platform Karir dan Magang Mahasiswa IPB
* **Anggota Kelompok:** 
  1. [Nama Anggota 1]
  2. [Nama Anggota 2]
  3. [Nama Anggota 3]
* **Mata Kuliah:** KOM1315 – Keamanan Informasi
* **Dosen Pengampu:** [Nama Dosen]

**Catatan Pembicara (Skrip):**
> "Selamat pagi/siang Bapak/Ibu dosen dan rekan-rekan. Hari ini kami akan mempresentasikan hasil implementasi keamanan informasi pada proyek kami, yaitu TUMBUH. TUMBUH adalah sebuah platform pelacakan karir dan magang khusus untuk mahasiswa IPB. Di platform ini, mahasiswa dapat melamar pekerjaan, dan HR perusahaan dapat mengelola status pelamar. Mengingat sensitivitas data yang dikelola, kami telah menerapkan arsitektur keamanan tingkat lanjut yang mencakup Authentication, Authorization, Accounting (AAA), serta lapisan kriptografi seperti Enkripsi AES dan Tanda Tangan Digital Ed25519."

---

## Slide 2. Latar Belakang
**Poin Utama:**
* **Konteks:** Platform menangani data sensitif mahasiswa dan keputusan rekrutmen.
* **Masalah Keamanan Utama:** 
  1. Eksposur Data Pribadi (CV, IPK, Riwayat, Surat Lamaran).
  2. Manipulasi keputusan rekrutmen secara ilegal.
  3. Sengketa Transaksi (*Repudiation*).
* **Risiko Tanpa Keamanan:**
  - Pencurian Identitas (Identity Theft) mahasiswa.
  - Hilangnya integritas data lamaran magang.
  - Hancurnya reputasi institusi IPB jika terjadi *Data Breach*.

**Catatan Pembicara (Skrip):**
> "Mengapa keamanan bukan sekadar fitur tambahan di TUMBUH, melainkan fondasi utama? Platform kami memproses ribuan data mahasiswa IPB yang sangat sensitif—mulai dari NIM, CV, nomor telepon, hingga IPK dan Surat Lamaran. 
> 
> Jika sistem ini tidak diamankan, risiko pertama adalah **Pencurian Identitas**. Peretas bisa mencuri ribuan CV mahasiswa. Risiko kedua adalah **Manipulasi**. Seseorang bisa meretas akun HR dan secara sepihak mengubah status pelamar dari 'Ditolak' menjadi 'Diterima'. Risiko ketiga adalah **Sengketa atau Repudiation**, di mana HR dapat mengklaim tidak pernah menolak mahasiswa, atau mahasiswa mengklaim tidak pernah melamar. Oleh karena itu, sistem kami menuntut implementasi kriptografi yang dapat membuktikan integritas dan keaslian setiap transaksi rekrutmen."

---

## Slide 3. Gambaran Sistem & Arsitektur
**Poin Utama:**
* **3 Aktor Utama:** 
  - **Student:** Hanya bisa melamar & edit profil (menggunakan domain `@ipb.ac.id`).
  - **HR:** Hanya bisa kelola lowongan & pelamar dari perusahaannya.
  - **Admin:** Memiliki visibilitas sistem & Audit Keamanan.
* **Arsitektur Microservices:**
  - **Frontend:** React + Vite (menyimpan JWT di LocalStorage).
  - **Backend API:** FastAPI (Python) + PostgreSQL.
  - **Audit Log Service:** Express (Node.js) + Winston (Fire-and-forget logger).

**Catatan Pembicara (Skrip):**
> "Platform kami terdiri dari tiga aktor dengan pemisahan hak akses (segregation of duties) yang tegas: Mahasiswa, HR Perusahaan, dan Admin. 
> 
> Dari segi arsitektur, kami memisahkan antara sistem fungsional dan sistem keamanan. Kami menggunakan arsitektur berbasis *microservice* parsial. Frontend dibangun menggunakan React, yang berkomunikasi dengan Backend API berbasis Python FastAPI. Menariknya, untuk kebutuhan *Accounting/Audit*, kami mendedikasikan satu server Node.js terpisah yang secara khusus hanya berfungsi menerima dan merangkai log aktivitas (fire-and-forget). Hal ini menjamin bahwa proses pencatatan log keamanan tidak akan pernah membebani kinerja server utama kami."

---

## Slide 4. Threat Modeling (Pemodelan Ancaman)
**Poin Utama:**
* **Aset Terpenting:**
  1. *Credentials* (JWT Tokens, Hashed Passwords).
  2. Dokumen Privat (CV PDF di direktori tertutup).
  3. Data Aplikasi (Cover Letter).
  4. Log Sistem.
* **Vektor Ancaman Utama:**
  - *Privilege Escalation:* Mahasiswa memalsukan token untuk mendapatkan akses HR.
  - *Data Exfiltration:* Eksploitasi endpoint publik untuk mengunduh CV orang lain.
  - *Log Tampering:* Admin nakal yang menghapus jejak kejahatannya di log.
* **Risiko yang Teridentifikasi:** Skala risiko berkisar dari *High* (Kebocoran DB) hingga *Critical* (Log yang dimanipulasi tanpa terdeteksi).

**Catatan Pembicara (Skrip):**
> "Dalam melakukan *Threat Modeling*, kami mengidentifikasi aset-aset kritis kami. Aset ini bukan sekadar 'database', melainkan spesifik pada Token JWT pengguna, file PDF CV, hingga teks log sistem itu sendiri. 
> 
> Ancaman terbesar yang kami antisipasi adalah *Privilege Escalation*—bagaimana jika mahasiswa pintar mencoba memanipulasi request API agar server mengira dia adalah HR? Atau ancaman *Log Tampering*—bagaimana jika seorang peretas yang berhasil menembus server mencoba menghapus rekam jejaknya di file `.log`? Identifikasi ancaman inilah yang melahirkan rancangan keamanan berbasis *Hash-Chain* dan *Strict Ownership Authorization* yang kami bangun."

---

## Slide 5. Kebutuhan Keamanan (CIA & AAA)
**Poin Utama:**
* **Confidentiality:** Data sensitif (Cover Letter) dienkripsi di dalam database. CV disimpan di area tertutup, bukan URL statis/publik.
* **Integrity:** Algoritma Hash Chaining menjamin log tidak bisa dimodifikasi.
* **Availability:** *Rate Limiting* agresif untuk memblokir bot / *brute-force* / DDoS.
* **Authentication:** Verifikasi identitas *multi-channel* (Email/Password & Google OAuth).
* **Authorization:** Pengecekan multi-layer (Role check -> Ownership check).
* **Accountability:** *Non-repudiation* via *Digital Signature* dan Audit terpusat.

**Catatan Pembicara (Skrip):**
> "Desain kami menjawab penuh konsep CIA Triad dan AAA. Untuk **Confidentiality**, kami memastikan bahkan jika seseorang mencuri database (dump SQL), mereka tidak bisa membaca surat lamaran mahasiswa karena sudah dienkripsi (Data at Rest). Untuk **Integrity**, kami pastikan setiap baris log sistem terkait secara matematis dengan baris sebelumnya menggunakan *Hash Chain*. Untuk **Availability**, kami menerapkan *Rate Limiting* via SlowAPI agar server tidak lumpuh diserang bot.
> 
> Konsep AAA kami juga sangat kuat. **Authentication** memverifikasi 'Siapa Anda', **Authorization** membatasi 'Apa yang boleh Anda lakukan pada resource spesifik', dan **Accountability** membuktikan 'Anda tidak bisa menyangkal telah melakukan aksi tersebut'."

---

## Slide 6. Desain Keamanan: At Rest, In Transit, & Key Management

![Security Architecture](./security_architecture.png)

**Poin Utama:**
* **Data at Rest (Saat Disimpan):** 
  - Password menggunakan `bcrypt` dengan auto-salting.
  - Kolom spesifik (Cover letter) diamankan dengan `Fernet` (AES-128-CBC).
* **Data in Transit (Saat Mengalir):** 
  - Komunikasi diproteksi oleh HTTPS/TLS.
  - Implementasi *Security Headers* (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`).
* **Key Management:**
  - Tidak ada kunci statis di dalam *source code*.
  - Pemisahan total: `SECRET_KEY` (JWT), `FIELD_ENCRYPTION_KEY` (AES), dan `DIGITAL_SIGNATURE_PRIVATE_KEY` (Ed25519) diload via Environment Variables.

**Catatan Pembicara (Skrip):**
> "Kunci dari keamanan kriptografi yang baik bukanlah pada algoritmanya, melainkan pada manajemen kuncinya (Key Management). Dalam sistem kami, algoritma enkripsi (Fernet/AES) dan algoritma hashing (Bcrypt) diterapkan untuk *Data at Rest*. Namun, yang membuatnya benar-benar aman adalah kami tidak pernah memasukkan kunci enkripsi (Secret Keys) ke dalam kode sumber (repository Git).
> 
> Semuanya dikonfigurasi melalui *Environment Variables* di server production. Jika kunci-kunci ini tidak ada, backend memiliki mekanisme *fallback derivation* khusus menggunakan *hash sha-256* dari *root secret*, untuk memastikan keamanan lokal tetap berjalan tanpa mengharuskan developer mengetahui kunci *production*. Selain itu, di level *Transit*, kami melindungi frontend dengan *Security Headers* yang keras untuk memitigasi serangan *Clickjacking* dan MIME *sniffing*."

---

## Slide 7. Implementasi Authentication yang Komprehensif
**Poin Utama:**
* **Secure Registration:** Validasi email Institusi (`@ipb.ac.id` untuk mahasiswa). Flow registrasi dikunci sampai pengguna memvalidasi *token hash* tunggal yang dikirim ke email mereka.
* **Password Hashing (Bcrypt):** Default *cost factor* 12 rounds. Menghasilkan *random salt* berukuran 16-byte untuk setiap pengguna, menggagalkan serangan *Rainbow Tables*.
* **Dual-Token System (JWT):**
  - **Access Token:** Sangat berumur pendek (60 menit) untuk mengurangi jendela serangan jika tercuri.
  - **Refresh Token:** Berlaku 7 hari untuk kenyamanan UX, memutar access token di latar belakang.
* **Google OAuth Validation:** Memverifikasi tanda tangan publik (Google Public Key ID token) dan menangkal celah manipulasi nama pengguna.

**Catatan Pembicara (Skrip):**
> "Untuk Authentication, kami tidak sekadar membuat fungsi 'cek password'. Ketika pengguna mendaftar, password mereka melalui proses hashing menggunakan `bcrypt`. Bcrypt otomatis menyisipkan 16-byte *random salt* yang di-*embed* ke dalam hasil hash. Artinya, jika ada dua pengguna dengan password 'rahasia123', *hash* yang tersimpan di database akan 100% berbeda. Ini menghancurkan ancaman serangan kamus (*Rainbow Table*).
> 
> Sistem JWT kami memisahkan antara Access Token dan Refresh Token. Access token hanya hidup 60 menit. Mengapa? Karena JWT bersifat *stateless* dan sulit direvokasi secara instan. Jika token ini diretas, peretas hanya punya waktu kurang dari 60 menit sebelum aksesnya hangus. Setelah itu, frontend akan meminta token baru menggunakan *Refresh Token* yang jauh lebih terkontrol."

---

## Slide 8. Implementasi Authorization (RBAC & Strict Ownership)
**Poin Utama:**
* **Dependency Injection di API:** Pengamanan otomatis di level struktur framework (`Require_role("student")`).
* **Strict Ownership Validation (Bukan Sekadar Role):**
  - "Hanya karena Anda seorang HR, BUKAN berarti Anda bisa melihat lamaran di perusahaan lain."
  - Backend memvalidasi `company_id` HR dengan `opportunity_id` lamaran secara absolut di database.
* **Privasi Akses CV PDF:**
  - CV tidak dilayani sebagai file statis publik seperti gambar.
  - Menggunakan rute khusus `/api/v1/users/{id}/cv`.
  - Hanya bisa diunduh oleh: 1) Pemiliknya, 2) Admin, 3) HR dari perusahaan yang sedang dilamar oleh mahasiswa tersebut.

**Catatan Pembicara (Skrip):**
> "Implementasi Authorization kami menerapkan prinsip *Least Privilege* tingkat tinggi. Di banyak sistem, fitur Role-Based Access Control (RBAC) hanya mengecek 'Apakah dia HR? Jika ya, izinkan'. Di TUMBUH, itu tidak cukup.
> 
> Kami menerapkan lapisan *Strict Ownership*. Saat seorang HR mencoba memperbarui status aplikasi mahasiswa (misalnya dari 'Interview' menjadi 'Diterima'), API kami tidak hanya mengecek token HR-nya. Backend kami memotong hingga ke tabel database untuk memastikan: 'Apakah pekerjaan (Opportunity) yang dilamar ini benar-benar milik Perusahaan (Company) HR tersebut?'. Jika tidak, sistem merespon dengan `403 Forbidden`. Kami juga menerapkan logika ini pada akses dokumen CV, yang hanya bisa diunduh jika ada benang merah relasi antara HR dan pelamar."

---

## Slide 9. Implementasi Accounting (Hash Chained Audit Log)
**Poin Utama:**
* **Asynchronous Logging:** Mengirim data log secara *fire-and-forget* menggunakan `threading.Thread`, menjamin keamanan tanpa mengorbankan *Response Time* pengguna.
* **Asynchronous Logging:** Mengirim data log secara *fire-and-forget* menggunakan `threading.Thread`, menjamin keamanan tanpa mengorbankan *Response Time* pengguna.
* **Rotasi Log Terstruktur:** Memanfaatkan `winston-daily-rotate-file`, max 20MB per file dengan batas *retention* 30 hari.
* **Tamper Evidence dengan Hash-Chain (Seperti Blockchain):**
  - Event ke-N menyimpan atribut `previousHash` (milik N-1) dan `eventHash` (Hash SHA-256 miliknya sendiri).
  - Jika file `.log` diedit secara manual di server, verifikasi matematis keseluruhan *chain* akan langsung mendeteksi kerusakan pada rantai tersebut.

**Catatan Pembicara (Skrip):**
> "Di sinilah letak keunikan proyek kami pada aspek *Accounting*. Log tidak ditulis biasa ke database, karena log di database mudah di-update atau dihapus oleh admin nakal (Log Tampering).
> 
> Kami membangun arsitektur mirip Blockchain sederhana. Setiap log peristiwa (misalnya Mahasiswa A login, atau HR B menerima mahasiswa A) dienkapsulasi menjadi format JSON. Kami mengambil Hash (SHA-256) dari peristiwa tersebut digabungkan dengan Hash dari log sebelumnya. Hasilnya adalah sebuah **Hash Chain**. Jika seseorang meretas server dan mengubah kata 'Ditolak' menjadi 'Diterima' pada log lama, hash dari baris tersebut akan berubah. Akibatnya, baris berikutnya tidak akan cocok dengan hash baru tersebut. Sistem Admin Audit kami memiliki fitur verifikasi yang akan memindai rantai log ini dari awal hingga akhir dan langsung menampilkan `Invalid` jika satu spasi saja diubah."

---

## Slide 10. Implementasi Kriptografi Lanjutan
**Poin Utama:**
* **AES (Fernet via Cryptography):** AES-128-CBC + HMAC-SHA256. 
  - *Target:* Melindungi Data (Surat Lamaran) dari pencurian.
  - *Konsep:* *Authenticated Encryption* mencegah cipher dirusak/dimanipulasi.
* **Ed25519 (Elliptic Curve Cryptography):**
  - *Target:* Digital Signature untuk kejadian vital (*Non-Repudiation*).
  - *Konsep:* Mengubah status lamaran membutuhkan penandatanganan payload JSON rahasia menggunakan *Private Key* (32 byte seed). Signature kemudian divalidasi oleh Admin menggunakan *Public Key*.
* **SHA-256:** Keamanan hashing asimetrik tak berbalik (Hashing email verification & hash chains).

**Catatan Pembicara (Skrip):**
> "Untuk Kriptografi, kami membagi penggunaan algoritma secara spesifik. 
> Pertama, **Symmetric Encryption**. Kami memakai `Fernet` (kombinasi AES-128-CBC dan HMAC-SHA256) untuk melindungi Cover Letter di database. Kami memilih algoritma ini karena HMAC memberikan *Authenticated Encryption*—artinya, selain dienkripsi, teks sandi diberi 'segel'. Jika hacker di database mengubah 1 karakter pada teks sandi, proses dekripsi akan langsung gagal total.
> 
> Kedua, **Asymmetric Cryptography**. Kami menggunakan Ed25519, algoritma kurva eliptik modern yang sangat cepat dan kebal terhadap serangan *timing attack*. Kami tidak mengenkripsi lamaran dengannya, melainkan men-*sign* (Tanda Tangan Digital) aktivitas krusial. Saat HR mengubah status pelamar, sistem membungkus waktu kejadian, ID mahasiswa, ID HR, dan status akhir menjadi sebuah payload JSON, lalu men-tandatanganinya. Admin kelak bisa memverifikasi signature ini. Ini menghancurkan kemungkinan penyangkalan (Non-Repudiation) di masa depan."

---

## Slide 11. Hasil Pengujian Sistem Keamanan
**Poin Utama:**
* **Functional Testing:** (Tunjukkan screenshot) Seluruh API *Green/Passed*. Alur proses registrasi, aplikasi, enkripsi terjadi secara transparan tanpa mengganggu UX pengguna.
* **Security Testing:**
  1. *Negative Testing (RBAC)*: Akses API Admin dengan JWT Student terblokir secara permanen.
  2. *Brute-Force Protection*: Sistem SlowAPI otomatis membekukan IP (*HTTP 429*) setelah percobaan login ke-5 dalam 1 menit.
  3. *Zero-Knowledge Response*: Menginspeksi payload HTTP Response memastikan hash password tidak pernah bocor ke sisi *Client*.
* **Integration Testing:** UI Admin (Verifikasi Signature) berhasil menarik data signature Base64 dari PostgreSQL backend dan memverifikasinya menggunakan *Ed25519 Public Key* yang sinkron secara matematika.

**Catatan Pembicara (Skrip):**
> "Kami telah melaksanakan tiga pilar pengujian. Secara fungsional, semua fitur kriptografi bekerja sempurna di latar belakang tanpa menambah kerumitan bagi *end-user* (Seamless UX).
> 
> Untuk Security Testing, kami sengaja melakukan serangan pada sistem sendiri. Kami memborbardir endpoint Login untuk menguji SlowAPI, dan terbukti serangan *brute-force* berhasil ditangkal dan IP diblokir. Kami juga menguji *Data Leakage*, dan kami pastikan melalui interceptor jaringan bahwa hash bcrypt tidak pernah sekalipun terkirim dalam payload JSON respons ke frontend. Pengujian integrasi memvalidasi bahwa Public Key dan Private Key pada arsitektur Ed25519 kami tersinkronisasi sempurna pada Dashboard Admin."

---

## Slide 12. Analisis Kinerja (Performance Impact)
**Poin Utama:**
* **Tantangan Keamanan vs Kinerja:** Setiap lapisan kriptografi memakan siklus komputasi.
* **Metrik Komparasi (Estimasi Kasar):**
  - *Response Time Tanpa Keamanan:* ~20-30 ms (Query DB murni).
  - *Response Time Dengan Keamanan:* ~60-80 ms.
* **Penyebab Overhead:**
  - Hashing Bcrypt 12-round sengaja didesain *berat* (butuh waktu pemrosesan CPU).
  - Enkripsi Fernet (AES) + Digital Signature (Ed25519).
* **Storage Overhead:**
  - Ukuran teks di DB mengembang karena format Base64 url-safe. Tambahan dua kolom besar untuk `signature_payload` dan `digital_signature`.

**Catatan Pembicara (Skrip):**
> "Penerapan keamanan yang ketat tentu memiliki kompromi atau *trade-off* terhadap kinerja (*Performance*). Kami menganalisis hal ini.
> 
> Waktu respon (*Latency*) endpoint kami sedikit meningkat jika dibandingkan dengan operasi *Create-Read-Update-Delete* (CRUD) polos. Mengapa? Karena ketika mahasiswa melamar pekerjaan, *server* harus melakukan Enkripsi AES pada cover letternya, menyusun Canonical JSON, dan membuat Digital Signature Ed25519 di waktu yang bersamaan. Terlebih pada endpoint login, algoritma Bcrypt (cost 12) secara sengaja didesain untuk memperlambat CPU demi mempersulit peretas. Demikian juga dengan penyimpanan database, kolom bertambah untuk menampung format Base64 enkripsi. Namun, penambahan sekitar 30-50 milidetik ini sangat tidak terasa oleh manusia, sehingga ini adalah pengorbanan (*trade-off*) yang sangat sepadan demi kemanan platform kelas *enterprise*."

---

## Slide 13. Kesimpulan & Future Works
**Poin Utama:**
* **Pencapaian Final:**
  - 100% Implementasi AAA dengan arsitektur modern (JWT + Winston Logging).
  - 100% Mitigasi kerentanan database via Enkripsi *Field-level* (AES).
  - *Non-Repudiation* dijamin oleh *Digital Signature* berbasis Elliptic Curve.
* **Keterbatasan Sistem Saat Ini:**
  - *Rate Limiting* masih berbasis memori (In-Memory). Jika container *Docker* restart, penghitungan limit akan reset.
  - Belum adanya implementasi otentikasi multi-faktor (MFA).
* **Pengembangan Selanjutnya (Future Works):**
  - Migrasi *Rate Limit* ke *Redis cache* agar limit bertahan secara terdistribusi.
  - Implementasi *Key Rotation Mechanism* (misalnya mengganti `FIELD_ENCRYPTION_KEY` setiap 6 bulan tanpa merusak data lama menggunakan skema `enc:v2`).
  - Menambah Time-Based One Time Password (TOTP) untuk MFA Admin.

**Catatan Pembicara (Skrip):**
> "Sebagai kesimpulan, kami telah berhasil membangun sistem yang bukan sekadar 'asal ada login'. Sistem ini dilengkapi dengan 3A yang kuat, dipersenjatai dengan kriptografi militer (AES & Ed25519), dan diproteksi dari ancaman internal (Admin/Log Tampering) melalui Hash Chaining.
> 
> Tentu sistem ini memiliki batasan. Rate limit kami saat ini berbasis RAM internal server. Jika server *restart*, memori pemblokiran IP akan hilang. Ke depan, kami berencana memindahkan manajemen rate-limit ini ke penyimpanan Redis, membangun rotasi kunci kriptografi secara periodik, dan mewajibkan MFA untuk akses masuk Administrator. Terima kasih atas perhatiannya, kami siap mendemonstrasikan sistem ini secara *live*."

---
---

## BONUS PENILAIAN YANG HARUS ANDA TEKANKAN DI PRESENTASI 
*(Saat demo atau kesimpulan, sebutkan poin-poin ini dengan jelas ke Dosen untuk mengamankan poin bonus +5 dari Rubrik)*

1. **"Pak/Bu, kami mengimplementasikan JWT + Role Based Access Control yang sangat spesifik dan lengkap."** (Tunjukkan bagaimana JWT dikombinasikan dengan validasi ID Perusahaan agar HR tidak bisa menyentuh pelamar perusahaan lain).
2. **"Pak/Bu, kami juga mengimplementasikan Digital Signature pada mekanisme transaksional lamaran."** (Tunjukkan di database atau dashboard Admin bahwa setiap lamaran punya *payload JSON* dan *signature 64-byte Ed25519*).
3. **"Pak/Bu, kami telah membangun Security Logging Dashboard tersendiri."** (Tunjukkan halaman `/admin/audit` di frontend. Tunjukkan tombol *Verify Chain* yang memvalidasi SHA-256 dan bagaimana UI menolak *signature* yang korup/palsu).

---
---

## PERSIAPAN Q&A DOSEN (BACA & PAHAMI INI)

Berikut adalah pendalaman untuk setiap kemungkinan pertanyaan (Kisi-kisi):

### Aspek Keamanan
* **Q: Mengapa memilih AES? (Spesifiknya, Fernet)**
  * **Jawaban Superior:** "AES adalah standar industri (*Advanced Encryption Standard*). Namun AES murni hanya menjamin kerahasiaan (*Confidentiality*). Kami menggunakan varian AES yang disebut **Fernet**. Fernet adalah AES-128-CBC yang digabungkan secara kriptografis dengan **HMAC-SHA256**. Artinya, data kami mendapat *Authenticated Encryption*. Jika ada peretas masuk ke DB dan mengubah satu huruf dari Cover Letter yang sudah terenkripsi, proses dekripsi di server kami akan gagal total secara aman (mencegah manipulasi data)."
* **Q: Mengapa menggunakan SHA-256?**
  * **Jawaban Superior:** "SHA-256 menghasilkan *digest* 256-bit yang tahan benturan (*Collision Resistant*). Kami menggunakannya pada sistem *Hash-Chain* audit kami karena kecepatannya sangat tinggi (penting karena kami me-log setiap aktivitas) namun secara matematis mustahil dibalik (*One-way function*). Ini memastikan setiap baris log secara kriptografis mengikat baris sebelumnya."
* **Q: Apa risiko jika kunci bocor?**
  * **Jawaban Superior:** "Risiko kebocoran kunci sangat fatal. Jika `SECRET_KEY` bocor, peretas bisa mencetak Token JWT palsu dan membajak sesi siapapun sebagai Admin. Jika `FIELD_ENCRYPTION_KEY` bocor, seluruh teks rahasia di DB bisa didekripsi (Data Breach). Oleh karena itu, kunci kami TIDAK PERNAH berada di *source code*, melainkan di-injeksi di level *Operating System* via Environment Variables pada platform deployment (Dokploy)."
* **Q: Apa ancaman terbesar pada sistem Anda?**
  * **Jawaban Superior:** "Ancaman terbesarnya adalah XSS (Cross-Site Scripting). Karena kami menyimpan JWT di *LocalStorage* frontend demi kemudahan, script jahat bisa mencuri JWT tersebut. Sebagai mitigasi, JWT *Access Token* kami buat berumur sangat pendek (hanya 60 menit). Jika tercuri, masa aktif eksploitasinya sangat sempit."

### Aspek Sistem
* **Q: Apa perbedaan authentication dan authorization?**
  * **Jawaban Superior:** "Authentication (Otentikasi) membuktikan identitas kredensial: 'Apakah Anda benar-benar Budi?' (via Password Hash / OAuth). Authorization (Otorisasi) memvalidasi *Policy*: 'Budi berhasil login, tapi apakah Budi (Student) berhak menekan tombol hapus lowongan ini?'. Authentication dipegang oleh JWT & Bcrypt, sedangkan Authorization dipegang oleh *dependency route* dan *Ownership Rules* di Backend."
* **Q: Mengapa fitur ini memerlukan accounting?**
  * **Jawaban Superior:** "Accounting (Audit Logging) menyediakan fitur *Non-Repudiation* (Anti Penyangkalan) dan *Traceability*. Tanpa accounting, jika ada perusahaan fiktif yang menyedot data CV pelamar massal dan kemudian menghapus lowongannya, kami sebagai Admin tidak akan memiliki jejak digital (Forensik) siapa pelaku sebenarnya dan kapan itu terjadi."
* **Q: Apa yang terjadi jika database dicuri (Dumping)?**
  * **Jawaban Superior:** "Pertama, tidak ada password *plaintext* yang bisa dipakai peretas, karena semuanya terlindungi algoritma *Bcrypt* yang berjalan dengan iterasi *12 rounds* dan garam (*salt*) unik per user. Kedua, surat lamaran mahasiswa tampak seperti string acak (Base64 dari AES Ciphertext). Data ini tidak berguna bagi peretas tanpa memiliki `FIELD_ENCRYPTION_KEY` yang hanya berada di memori server aplikasi."

### Aspek Implementasi
* **Q: Bagian mana yang paling sulit?**
  * **Jawaban Superior:** "Merancang arsitektur **Audit Hash-Chain** dan **Digital Signature**. Kami harus memastikan pembuatan log *Hash-Chain* tidak menjadi *bottleneck* (memperlambat) proses API aplikasi utama. Solusinya, kami menerapkan komunikasi *fire-and-forget* secara asinkron (background task) di mana Backend mengirim data log via jaringan internal ke server Node.js terpisah."
* **Q: Apa yang akan diperbaiki jika proyek dilanjutkan?**
  * **Jawaban Superior:** "Sistem manajemen kunci (*Key Management*). Saat ini sistem belum memiliki prosedur otomatis untuk memutar kunci enkripsi secara aman (*Key Rotation*). Ke depan, kami ingin menambahkan mekanisme di mana kunci enkripsi (AES) diganti setiap 6 bulan, dan sistem secara bertahap men-dekripsi dan me-re-enkripsi data lama dengan kunci versi baru (misal menggunakan marker prefix `enc:v2:`)."
