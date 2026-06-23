# Alur Publish Artikel Arasvara

## 1. Penulisan & Status Awal

- Artikel dapat dibuat oleh: Reporter, Writer, Contributor, Editor, Head of, Redpel, Pemred, Admin.
- Status awal default: **DRAFT**
- Artikel DRAFT dapat diedit bebas oleh penulisnya.

## 2. Submit & Review

- Penulis (termasuk Editor/Redpel/Pemred/Admin) dapat mengubah status ke **PENDING_REVIEW** untuk mengajukan artikel ke proses review.
- Jika penulis mengedit artikel setelah statusnya bukan DRAFT, status otomatis kembali ke **PENDING_REVIEW**.
- Notifikasi otomatis dikirim ke role reviewer berikutnya saat status berubah ke PENDING_REVIEW.

## 3. Approval & Transisi Status

- **Editor**:
  - Dapat approve (APPROVED), reject (REJECTED), atau kembalikan ke draft.
  - Bisa submit ke Head of/Redpel jika perlu.
- **Head of/Redpel/Pemred/Admin**:
  - Bisa approve, reject, publish langsung, schedule, atau takedown.
  - Boleh skip status, misal dari DRAFT langsung ke PUBLISHED/SCHEDULED.
  - Semua transisi status yang dilakukan role ini tetap tercatat di activity log.
- **Admin**:
  - Bisa override semua status dan melakukan semua aksi.

## 4. Publish & Takedown

- Artikel yang sudah **APPROVED** bisa diubah ke **PUBLISHED** atau **SCHEDULED** oleh Redpel/Pemred/Admin.
- Artikel yang sudah **PUBLISHED** hanya bisa di-takedown oleh Redpel/Pemred/Admin (status: TAKEN_DOWN).

## 5. Revisi & Rejected

- Artikel yang **REJECTED** dapat diedit kembali oleh penulis, dan status otomatis kembali ke **PENDING_REVIEW** setelah diedit.
- Semua perubahan status dan aksi penting dicatat di **activity log** (siapa, kapan, aksi apa).

## 6. Notifikasi

- Setiap perubahan status penting (submit, approve, reject, publish, takedown) akan mengirimkan notifikasi ke role terkait secara otomatis.

## 7. Skema Transisi Status (Fleksibel)

- Penulis → DRAFT → PENDING_REVIEW → (APPROVED/REJECTED)
- Editor/Redpel/Pemred/Admin dapat melakukan:
  - DRAFT → PUBLISHED/SCHEDULED (boleh skip)
  - PENDING_REVIEW → PUBLISHED/SCHEDULED/REJECTED/APPROVED
  - APPROVED → PUBLISHED/SCHEDULED
  - PUBLISHED → TAKEN_DOWN
  - REJECTED → DRAFT (revisi)

## 8. Catatan

- Semua transisi status dan aksi penting dicatat di activity log.
- Notifikasi otomatis ke role berikutnya setiap status berubah.
- Alur ini mendukung fleksibilitas newsroom modern, namun tetap menjaga jejak audit dan kontrol editorial.
