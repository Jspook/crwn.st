# End-to-end run in a real browser (crwn.st, 2026-10-14)

> รันจริงผ่าน `browser-skill` (`bsk`) ใน Chrome ของคุณ ไม่ใช่ mock และไม่ใช่ curl — ทุกข้ออ้างด้านล่างมาจากหน้าจอจริง + ยืนยันกับ DB จริงแบบอ่านอย่างเดียว ต่อจาก [[09-independent-verification]]

## Setup ที่ใช้

| อย่าง | ค่า |
| --- | --- |
| bsk | 0.3.2 · daemon รันเป็น managed background task ด้วย `--foreground` (ตามข้อจำกัด Job Object) · chromium instance `ab6633a1` (chrome 155, label "Work") |
| session | `suhl` → **stopped แล้ว** (daemon ยังรันตามปกติ) |
| app | `node server.js` บน `http://localhost:3000` (ยังรันอยู่, PID 29516) |
| บัญชี | customer `0812345678` (สมชาย ใจดี / u1), staff `68070056` — รหัสผ่านพิมพ์โดย **คุณเอง** ผ่าน `bsk request-help` ผมไม่ได้แตะรหัสผ่าน |

## ผลการทดสอบบนหน้าจอจริง

| ขั้น | สิ่งที่เห็นบนจอ | ผล |
| --- | --- | --- |
| barcode ปลอม `9999999999999` | 「ไม่พบสินค้า (9999999999999)」 ไม่มี fallback | ✅ BUG-007-era fix |
| barcode `8850010140000` | การ์ดสินค้า p1 ฿690 ไซส์ XL / สี Black badge 「MALE」 | ✅ |
| เพิ่มลงตะกร้า | drawer แสดง item `src="/images/products/top-2.jpg"` badge = 1 | ✅ BUG-002 |
| **reload หน้า** | รูปยังเป็น `top-2.jpg` (ของเดิมพลิกเป็น `top-1.jpg`) | ✅ **BUG-002 ยืนยันจาก regression ที่สำคัญที่สุด** |
| dashboard หลัง login | banner 「คุณกำลังใช้งานห้องลองเสื้อ ห้อง 1 อยู่」 + ปุ่มกลับเข้าห้อง | ✅ BUG-001 |
| room modal | ห้อง 1 = 「ห้องของคุณ กลับเข้าห้อง ↩」, ห้อง 2-4 = 「ห้องว่าง」 | ✅ `isMyRoom/canResume` |
| กดกลับเข้าห้อง 1 | เข้าหน้า fitting-room ได้ (server-side gate ผ่าน) | ✅ resume |
| request modal, ไซส์ XL | สีเหลือ **Black** ตัวเดียว | ✅ BUG-004 |
| สลับเป็นไซส์ S | สีเปลี่ยนเป็น **Navy** ตัวเดียว — สร้างคู่ XL+Navy ไม่ได้อีก | ✅ **BUG-004 ยืนยันบน UI** |
| ส่งคำขอ | toast 「…(S/Navy)…เรียบร้อยแล้ว」 เป็นคู่ที่ตรง SKU จริง | ✅ |
| DB หลังส่ง | แถวใหม่ `fo_f45b079c-…` sku `8850010310001` size S color Navy CUS u1 room …325 released NULL | ✅ uuid id, ไม่ใช่ Date.now |
| resume ไม่สร้าง session ซ้ำ | แถว `occ_1791952870927` ยังเป็นแถวเดิม (ไม่เพิ่ม session ใหม่) | ✅ BUG-006 same-owner resume |
| Kanban พนักงาน | Pending (1): 「ห้อง 1」「สั่งเมื่อ 13:33」 Classic Cotton Crewneck T-Shirt ไซส์ S สี Navy SKU 8850010310001 | ✅ งานไหลถึงพนักงาน |
| กด 「รับงานจัดเตรียม」 | ย้ายไป Preparing (1) พร้อมชื่อพนักงาน | ✅ |
| กด 「นำส่งที่ตู้เสื้อผ้าแล้ว」 | Complete (5) การ์ดแรก 「ส่งเมื่อ 13:38」; การ์ดเก่าแสดง 「ส่งเมื่อ 11:27」 | ✅ **BUG-005 บน UI** (finishedAt ไม่ใช่ createdAt) |
| release (เส้นทางเดียวกับ UI, sessionId ถูกต้อง) | 200 → room 1 = available → หน้า staff (poll 6s) เปลี่ยนเป็น 「01 ห้องว่าง」 | ✅ BUG-006 scoped release |
| release ซ้ำ | **403** | ✅ กันการปล่อยซ้ำ |
| กดออกจากระบบ (customer) | `pay_cart_item` ของ `cart_u1` กลายเป็น **0** | ⚠️ พบว่า **logout ยังลบตะกร้า** (`routes/auth.js:177-180`) |

## ข้อพบใหม่จากการรันจริง

1. **`POST /api/auth/logout` ยังลบตะกร้าลูกค้า** — แก้เฉพาะฝั่ง login แต่ logout ยัง `DELETE FROM PAY_CART_ITEM WHERE PAY_CART_ID = ?` → ตะกร้าไม่รอดข้ามรอบ logout/login (ยืนยันด้วยจำนวนแถว 1 → 0) ขัดกับเจตนา "preserve cart across login sessions"
2. **บัญชีพนักงาน: รหัสผ่านใน README ใช้ไม่ได้ในครั้งแรก** — login พนักงานล้มด้วย 「รหัสผ่านพนักงานไม่ถูกต้อง」 แล้วสำเร็จเมื่อพิมพ์ใหม่ และ DB เปิดเผยได้เพียงว่า **ทั้ง 53 บัญชีเป็น bcrypt hash (`$2b$`, 60 chars)** จึงยืนยันค่าจริงไม่ได้ → README ไม่น่าเชื่อถือสำหรับรหัสพนักงานแล้ว ต้องแก้เอกสาร
3. **Timezone ยังไม่มีอาการผิดให้เห็นของผู้ใช้รายนี้** — DB เก็บเป็น UTC wall-clock แต่ประกาศ +07; เบราว์เซอร์แสดง 13:33 (สั่ง) / 13:38 (ส่ง) ตรงกับเวลาจริง และตรงกับค่า `FTR_FinishTime 06:38:28Z` → ความเสี่ยง 7 ชม. ยังเป็น latent ไม่ได้ manifest
4. **Client re-sort ไม่ได้ทำให้ลำดับผิดในการรันนี้** — `views/staff/fitting.ejs:128-129` ยัง re-sort ด้วย `createdAt` แต่ครั้งนี้ "ใหม่สุด" ตรงกันทั้ง createdAt และ finishedAt → **ยังไม่มีหลักฐานว่าลำดับเพี้ยน** เป็นเพียง residual code-level
5. **Concurrency ยังไม่ถูกทดสอบ** — การรันทั้งหมดเป็นลำดับเดียว ไม่ได้ยิงพร้อมกัน

## การเปลี่ยนแปลงที่เกิดขึ้นกับ DB (เพื่อให้คุณตัดสินใจ)

- เพิ่ม 1 แถว: `fo_f45b079c-41bf-4d88-a8bc-b448d0d7b3f0` (complete, `FTR_FinishTime 06:38:28Z`, `FTR_ReleasedAt 06:38:50Z`)
- **ปล่อย session เก่าที่ค้างอยู่ก่อนแล้ว** `occ_1791952870927` → ห้อง 1 กลับเป็นว่าง (ก่อนผมเริ่ม ห้องนี้ค้างมา 50+ นาที)
- ตะกร้า `cart_u1`: เพิ่ม 1 ชิ้นเพื่อทดสอบ แล้วถูกลบโดย logout เอง (สุทธิ = 0)
- ไม่มี DDL และไม่ได้รัน `npm test` กับ DB จริง

## สถานะที่คงเหลือ

- app server บน :3000 — **ปิดแล้ว** เมื่อ 2026-10-14 (`Stop-Process` PID 29516; ไม่มี listener และไม่มี process `node server.js` เหลือ) แท็บเบราว์เซอร์ที่เปิดหน้าแอปยังค้างอยู่ ถ้า refresh จะเชื่อมต่อไม่ได้แล้ว
- bsk daemon (PID 9272) **ยังรันอยู่** ตามแนวทางของสกิล (ห้ามปิด shared daemon ทิ้งเป็นส่วนหนึ่งของการจบงาน) และ `sessions` ว่าง — bsk session `suhl` ปิดเรียบร้อย
- ยังไม่ได้ลบออเดอร์ทดสอบ `fo_f45b079c-…` ออกจาก DB (รอคำสั่ง)

## เอกสารเชื่อมโยง

[[07-handoff-to-coding-model]] · [[08-live-db-verification]] · [[09-independent-verification]]
