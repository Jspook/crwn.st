# crwn.st (surreal-fit)

> ระบบ Point-of-Sale (POS) และระบบจัดการห้องลองชุดอัจฉริยะ (Seamless O2O Retail Experience) สำหรับธุรกิจแฟชั่นและเสื้อผ้าระดับลักชัวรี

---

## 📌 ภาพรวมโปรเจกต์ (Overview)

**crwn.st** พัฒนาขึ้นเพื่อเชื่อมต่อประสบการณ์การช้อปปิ้งหน้าร้าน (Offline) เข้ากับระบบดิจิทัล (Online) แบบไร้รอยต่อ โดยครอบคลุมการทำงาน 3 บทบาทหลักผ่านอินเทอร์เฟซที่ออกแบบตามหลักสุนทรียศาสตร์แบบ Quiet Luxury:

1. **Customer (ลูกค้า):** สแกน QR ประตูห้องลองเพื่อเช็กอิน, สแกนบาร์โค้ดเสื้อผ้าเพื่อตรวจดูไซส์และสต็อก, ส่งคำขอให้พนักงานนำชุดมาส่งถึงห้องลอง และชำระเงินได้ด้วยตัวเอง (Self-checkout)
2. **Fitting Room Staff (พนักงานห้องลอง):** บอร์ดคิวติดตามและจัดการคำร้องขอลองชุดแบบ Real-time (Auto-refresh ทุก 5 วินาที) เพื่อเตรียมและนำชุดไปส่งลูกค้าตามห้องลอง
3. **Cashier (พนักงานแคชเชียร์):** ระบบ POS หน้าเคาน์เตอร์ สแกนบาร์โค้ดสินค้า ค้นหาสมาชิก คำนวณราคารวมและภาษี ออกใบเสร็จ และตัดสต็อกสินค้าในระบบ

---

## 🛠 เทคโนโลยีที่ใช้ (Tech Stack)

* **Core Framework:** [Next.js (App Router)](https://nextjs.org/)
* **Language:** [TypeScript](https://www.typescriptlang.org/)
* **Styling:** [Tailwind CSS](https://tailwindcss.com/)
* **Animations:** [Framer Motion](https://www.framer.com/motion/)
* **Database (Prototype):** Local JSON Flat-file Storage

---

## 📂 โครงสร้างโปรเจกต์ (Directory Structure)

```text
surreal-fit/
├── data/                         # ฐานข้อมูลจำลอง (JSON Storage)
│   ├── cart.json                 # ตะกร้าสินค้าชั่วคราว
│   ├── fittingOrders.json        # รายการคิวคำขอลองชุด
│   ├── fittingRooms.json         # สถานะห้องลองชุด (fr1, fr2, fr3)
│   ├── products.json             # ข้อมูลสินค้า, บาร์โค้ด, ไซส์, สต็อก
│   ├── receipts.json             # ประวัติการออกใบเสร็จรับเงิน
│   └── users.json                # บัญชีผู้ใช้และบทบาท (RBAC)
│
├── src/
│   ├── app/
│   │   ├── api/                  # Backend REST API Routes
│   │   │   ├── auth/             # เส้นทาง Login / Logout
│   │   │   ├── cart/             # จัดการตะกร้าสินค้า
│   │   │   ├── fitting-orders/   # รับและอัปเดตสถานะคิวลองชุด
│   │   │   ├── products/         # ค้นหาสินค้า และค้นหาผ่าน Barcode
│   │   │   ├── receipts/         # บันทึกใบเสร็จและหักสต็อกสินค้า
│   │   │   └── users/            # สืบค้นข้อมูลสมาชิก
│   │   │
│   │   ├── customer/             # พอร์ทัลลูกค้า
│   │   │   ├── dashboard/        # เมนูหลัก & โมดอลสแกนเนอร์
│   │   │   ├── fitting-room/     # แค็ตตาล็อกดิจิทัล & ฟอร์มขอชุด
│   │   │   ├── checkout/         # หน้าชำระเงิน (Self-checkout)
│   │   │   └── receipt/[id]/     # หน้าใบเสร็จอิเล็กทรอนิกส์ (E-Receipt)
│   │   │
│   │   ├── staff/
│   │   │   ├── fitting/          # พอร์ทัลพนักงานห้องลอง (Kanban Queue)
│   │   │   └── cashier/          # พอร์ทัลแคชเชียร์ (POS Counter)
│   │   │
│   │   ├── login/                # หน้าระบบยืนยันตัวตน
│   │   └── page.tsx              # หน้า Portal Selector
│   │
│   ├── components/ui/            # Shared UI Components & Modals
│   │   ├── AuroraBackground.tsx  # พื้นหลังเคลื่อนไหวแบบหรูหรา
│   │   ├── BarcodeScanner.tsx    # โมดอลสแกนเนอร์จำลองบาร์โค้ดสินค้า
│   │   ├── CartDrawer.tsx        # แผงลิ้นชักตะกร้าสินค้า
│   │   ├── GlassCard.tsx         # ดีไซน์การ์ดกระจกฝ้า (Frosted Glass)
│   │   ├── ItemRequestModal.tsx  # โมดอลเลือกสี/ไซส์ส่งเข้าห้องลอง
│   │   └── RoomScannerModal.tsx  # โมดอลจำลองสแกน QR ประตูห้องลอง
│   │
│   └── lib/
│       ├── db.ts                 # โมดูลตัวอ่าน/เขียนไฟล์ JSON (readData, writeData)
│       ├── session.ts            # การจัดการ Cookie Session (crwn_session)
│       └── proxy.ts              # ระบบตรวจสิทธิ์เข้าถึงหน้าเพจ (RBAC Guard)

```

---

## 🔄 แผนผังการทำงานของระบบ (System Workflows)

### 1. In-Store Fitting Flow (การขอชุดในห้องลอง)

1. ลูกค้าเข้าห้องลองชุด และสแกน QR Code ประจำห้อง (`fr1`, `fr2`, หรือ `fr3`) ผ่านแอป
2. ลูกค้าเลือกสินค้า สี และไซส์ที่ต้องการลองเพิ่ม จากนั้นกดยืนยันคำขอ
3. ระบบส่งข้อมูลเข้า `fittingOrders.json` ด้วยสถานะ `Pending`
4. หน้าจอพนักงานห้องลอง (`/staff/fitting`) อัปเดตรายการใหม่โดยอัตโนมัติ
5. พนักงานกดเปลี่ยนสถานะเป็น `Preparing` (กำลังหยิบสินค้า) และเปลี่ยนเป็น `Complete` เมื่อนำชุดไปแขวนให้ลูกค้าเรียบร้อยแล้ว

### 2. Transaction & Stock Deduct Flow (การคิดเงินและตัดสต็อก)

1. ดำเนินการผ่าน Self-checkout (ลูกค้า) หรือ POS Counter (แคชเชียร์)
2. เมื่อกดยืนยันการชำระเงิน ระบบจะส่ง Payload ไปยัง `POST /api/receipts`
3. ระบบจะบันทึกประวัติการขายลงใน `receipts.json`
4. ระบบทำการหักลบจำนวนสินค้า (Stock Count) ของ SKU นั้น ๆ ออกจาก `products.json` โดยอัตโนมัติ

---

## 🌐 API Reference

| Endpoint | Method | คำอธิบาย |
| --- | --- | --- |
| `/api/auth/login` | `POST` | ล็อกอิน (Customer ใช้เบอร์โทรศัพท์ / Staff ใช้ Username & Password) |
| `/api/auth/logout` | `POST` | ล้าง Cookie Session (`crwn_session`) |
| `/api/products` | `GET` | เรียกดูรายการสินค้าทั้งหมดในแค็ตตาล็อก |
| `/api/products/barcode/[code]` | `GET` | ค้นหารายละเอียดสินค้าจากรหัสบาร์โค้ด |
| `/api/fitting-orders` | `GET` / `POST` | ดึงรายการคำขอลองชุด / สร้างคำขอลองชุดใหม่ |
| `/api/fitting-orders/[id]` | `PUT` | อัปเดตสถานะคิวคำขอ (`Pending` / `Preparing` / `Complete`) |
| `/api/receipts` | `POST` | บันทึกใบเสร็จการชำระเงิน พร้อมตัดสต็อกสินค้าทันที |
| `/api/cart` | `GET` / `DELETE` | ตรวจสอบหรือล้างข้อมูลในตะกร้าสินค้า |

---

## 🚀 เริ่มต้นใช้งาน (Getting Started)

### ความต้องการของระบบ (Prerequisites)

* [Node.js](https://nodejs.org/) (เวอร์ชัน 18.17 หรือใหม่กว่า)
* แพ็กเกจเมเนเจอร์ตัวใดตัวหนึ่ง: `npm`, `yarn`, `pnpm` หรือ `bun`

### การติดตั้งและเปิดเซิร์ฟเวอร์

```bash
# 1. ติดตั้ง Dependencies ทั้งหมด
npm install
# หรือ
yarn install
# หรือ
pnpm install

# 2. เริ่มต้นรัน Local Development Server
npm run dev
# หรือ
yarn dev
# หรือ
pnpm dev

```

เปิดเว็บเบราว์เซอร์ไปที่ [http://localhost:3000](http://localhost:3000) เพื่อเข้าสู่ระบบ