# crwn.st (surreal-fit)

> ระบบ Point-of-Sale (POS) และระบบจัดการห้องลองชุดอัจฉริยะ (Seamless O2O Retail Experience) สำหรับธุรกิจแฟชั่นและเสื้อผ้าระดับลักชัวรี

---

## 🧪 ข้อมูลสำหรับทดสอบระบบ (Test Data & Demo Credentials)

สำหรับผู้ทดสอบระบบ สามารถใช้ข้อมูลด้านล่างนี้ในการเข้าสู่ระบบและทดสอบฟังก์ชันการทำงานต่างๆ ได้ทันที:

### 1. บัญชีผู้ใช้งานทดสอบ (Test Accounts)

| บทบาท (Role) | เบอร์โทรศัพท์ / รหัสพนักงาน (Identifier) | รหัสผ่าน (Password) | สิทธิ์และการเข้าถึง |
| :--- | :--- | :--- | :--- |
| 👤 **ลูกค้า (Customer)** | `0812345678` | `123456` | เข้าหน้า Customer Portal (`/customer/dashboard`), สแกนเข้าห้องลอง, ค้นหาสินค้า, ส่งคำขอให้พนักงานนำชุดมาส่ง, ชำระเงิน Self-checkout |
| 👤 **ลูกค้า (Customer 2)** | `0899999999` | `123456` | บัญชีลูกค้าสำรองสำหรับทดสอบ |
| 💼 **แคชเชียร์ (Cashier / POS)** | `68070254` | `68070254` | เข้าหน้า POS Counter (`/staff/cashier`), ยิงบาร์โค้ดสินค้า, ค้นหาสมาชิก, คิดเงิน, พิมพ์ใบเสร็จ, ตัดสต็อก |
| 🚪 **พนักงานห้องลอง (Fitting Staff)** | `68070056` | `68070056` | เข้าหน้า Fitting Kanban (`/staff/fitting`), จัดการคิวคำขอลองชุด, เปลี่ยนสถานะ เตรียมชุด/นำส่งชุด |

> 💡 **หมายเหตุ:** ลูกค้ายังสามารถกดปุ่ม **"สมัครสมาชิกใหม่ที่นี่"** บนหน้าแรกเพื่อสร้างบัญชีด้วยเบอร์โทรศัพท์และชื่อของตนเองได้

---

### 2. รหัสบาร์โค้ดสินค้าสำหรับทดสอบ (Test Barcodes)

สามารถพิมพ์หรือนำเลขบาร์โค้ดด้านล่างไปสแกนในระบบ (ทั้งหน้าลูกค้าและหน้าแคชเชียร์ POS):

| รหัสบาร์โค้ด (Barcode) | ชื่อสินค้า (Product Name) | หมวดหมู่ | ราคา (บาท) | ไซส์/สี ที่มี |
| :--- | :--- | :--- | :--- | :--- |
| `8901234567891` | **Oversized Cashmere Scarf** | Accessories | ฿2,490 | OS (Navy, Camel, Grey) |
| `8901234567892` | **Chunky Knit Wool Sweater** | Tops | ฿3,890 | S, M, L (Grey, Cream, Black) |
| `8901234567893` | **Tailored Double-Breasted Coat** | Outerwear | ฿8,900 | S, M, L (Black, Navy, Camel) |
| `8901234567894` | **Wide-Leg Pleated Trousers** | Bottoms | ฿3,290 | S, M, L (Black, Beige, Charcoal) |
| `8901234567895` | **Silk Crepe Midi Skirt** | Skirts | ฿4,190 | S, M (Ivory, Champagne) |

---

### 3. ข้อมูลห้องลองเสื้อ (Fitting Rooms)

| หมายเลขห้อง | สถานะเริ่มต้น (Status) | การทดสอบ |
| :--- | :--- | :--- |
| **ห้อง 01** | `Available` (ว่าง) | พร้อมสแกน QR Code เข้าใช้งาน |
| **ห้อง 02** | `Occupied` (มีคนใช้งาน) | ระบบจะแจ้งเตือนว่าห้องไม่ว่าง ไม่อนุญาตให้เข้า |
| **ห้อง 03** | `Available` (ว่าง) | พร้อมสแกน QR Code เข้าใช้งาน |

---

### 4. ลำดับขั้นตอนการทดสอบ (Recommended Test Flows)

#### Flow A: การลองชุดในห้องลอง (In-Store Fitting Experience)
1. เข้าสู่ระบบด้วยบัญชีลูกค้า (`0812345678` / `123456`)
2. กด **"สแกนเข้าห้องลอง"** แล้วเลือก/สแกนเข้า **ห้อง 01**
3. เลือกสินค้าที่ต้องการลอง ไซส์ และสี แล้วกด **"สั่งมาลอง"**
4. รายการคำขอจะแสดงในกล่อง **"สินค้าที่คุณสั่งมาลองในห้องนี้"** ด้วยสถานะ *รอดำเนินการ (Pending)*
5. เปิดแท็บใหม่ เข้าสู่ระบบด้วยบัญชีพนักงานห้องลอง (`68070056` / `68070056`)
6. บนบอร์ด Kanban พนักงานจะเห็นการ์ดคำขอ กด **"รับงานจัดเตรียม"** และเมื่อนำส่งเสร็จให้กด **"นำส่งที่ตู้เสื้อผ้าห้องลองแล้ว"**
7. ในหน้าห้องลองของลูกค้า สถานะจะเปลี่ยนเป็น *นำส่งที่ตู้เสื้อผ้าแล้ว ✓* แบบเรียลไทม์

#### Flow B: การคิดเงินและตัดสต็อก (POS Cashier Counter)
1. เข้าสู่ระบบด้วยบัญชีแคชเชียร์ (`68070254` / `68070254`)
2. ยิงบาร์โค้ดสินค้า เช่น `8901234567891` หรือ `8901234567892`
3. ค้นหาสมาชิกด้วยเบอร์โทร `0812345678` เพื่อสะสมแต้ม
4. กดชำระเงิน เลือกว่าเป็นเงินสด บัตรเครดิต หรือ QR PromptPay
5. กดยืนยันชำระเงิน ระบบจะออก E-Receipt คำนวณภาษีมูลค่าเพิ่ม และตัดสต็อกสินค้าในฐานข้อมูลทันที

---

## 📌 ภาพรวมโปรเจกต์ (Overview)

**crwn.st** พัฒนาขึ้นเพื่อเชื่อมต่อประสบการณ์การช้อปปิ้งหน้าร้าน (Offline) เข้ากับระบบดิจิทัล (Online) แบบไร้รอยต่อ โดยครอบคลุมการทำงาน 3 บทบาทหลักผ่านอินเทอร์เฟซที่ออกแบบตามหลักสุนทรียศาสตร์แบบ Quiet Luxury:

1. **Customer (ลูกค้า):** สแกน QR ประตูห้องลองเพื่อเช็กอิน, สแกนบาร์โค้ดเสื้อผ้าเพื่อตรวจดูไซส์และสต็อก, ส่งคำขอให้พนักงานนำชุดมาส่งถึงห้องลอง และชำระเงินได้ด้วยตัวเอง (Self-checkout)
2. **Fitting Room Staff (พนักงานห้องลอง):** บอร์ดคิวติดตามและจัดการคำร้องขอลองชุดแบบ Real-time เพื่อเตรียมและนำชุดไปส่งลูกค้าตามห้องลอง
3. **Cashier (พนักงานแคชเชียร์):** ระบบ POS หน้าเคาน์เตอร์ สแกนบาร์โค้ดสินค้า ค้นหาสมาชิก คำนวณราคารวมและภาษี ออกใบเสร็จ และตัดสต็อกสินค้าในระบบ

---

## 🛠 เทคโนโลยีที่ใช้ (Tech Stack)

* **Backend & Server:** [Node.js](https://nodejs.org/) & [Express 5](https://expressjs.com/)
* **View Engine:** [EJS (Embedded JavaScript templates)](https://ejs.co/)
* **Styling:** [Tailwind CSS](https://tailwindcss.com/) (Quiet Luxury Palette)
* **Icons & Visuals:** [Lucide Icons](https://lucide.dev/), Canvas Confetti
* **Database Engine:** Relational Database (SQLite / MySQL Dual Driver) รองรับโครงสร้างตาม ER Diagram 14 ตาราง

---

## 📂 โครงสร้างโปรเจกต์ (Directory Structure)

```text
surreal-fit/
├── database/                     # ระบบฐานข้อมูล Relational Database
│   ├── schema.sql                # DDL สร้างตาราง 14 ตารางตาม ER Diagram
│   ├── db.js                     # ตัวเชื่อมต่อฐานข้อมูล (SQLite / MySQL)
│   └── seed.js                   # ตัวตั้งต้นข้อมูลสินค้า สมาชิก และสต็อก
│
├── routes/                       # Express Route Handlers
│   ├── auth.js                   # ระบบ Login, Register, Session RBAC
│   ├── customer.js               # Dashboard, Fitting Room, Checkout
│   ├── staff.js                  # Cashier POS และ Fitting Staff Kanban
│   └── api.js                    # REST APIs (Products, Orders, Receipts, etc.)
│
├── views/                        # EJS Templates
│   ├── customer/                 # หน้าสำหรับลูกค้า (Dashboard, Fitting Room, Checkout)
│   ├── staff/                    # หน้าสำหรับพนักงาน (Cashier POS, Fitting Room Queue)
│   ├── partials/                 # Header, Footer, Modals (Barcode, Room QR)
│   └── index.ejs                 # หน้าจอ Login & Register หลัก
│
├── public/                       # Static Assets & Client-side Scripts
│   ├── js/                       # app.js, cart.js, fitting.js, pos.js
│   └── images/                   # รูปภาพและไอคอน
│
├── server.js                     # จุดเริ่มต้นของแอปพลิเคชัน (Application Entry Point)
└── package.json                  # การจัดการ Dependencies และ Scripts
```

---

## 🌐 API Reference

| Endpoint | Method | คำอธิบาย |
| :--- | :--- | :--- |
| `/api/auth/login` | `POST` | ล็อกอิน (Customer ใช้เบอร์โทรศัพท์ / Staff ใช้รหัสพนักงาน) |
| `/api/auth/register` | `POST` | สมัครสมาชิกใหม่สำหรับลูกค้า |
| `/api/auth/logout` | `POST` | ออกจากระบบและล้าง Cookie Session |
| `/api/products` | `GET` | เรียกดูรายการสินค้าทั้งหมดในระบบ |
| `/api/products/barcode/:code` | `GET` | ค้นหารายละเอียดสินค้าจากรหัสบาร์โค้ด |
| `/api/fitting-orders` | `GET` / `POST` | ดึงรายการคำขอลองชุด / สร้างคำขอลองชุดใหม่ |
| `/api/fitting-orders/:id` | `PATCH` | อัปเดตสถานะคิวคำขอ (`pending` / `preparing` / `complete`) |
| `/api/receipts` | `POST` | บันทึกใบเสร็จการชำระเงิน พร้อมตัดสต็อกสินค้าทันที |
| `/api/rooms` | `GET` | ตรวจสอบสถานะห้องลอง (ว่าง / ไม่ว่าง) |

---

## 🚀 เริ่มต้นใช้งาน (Getting Started)

### ความต้องการของระบบ (Prerequisites)

* [Node.js](https://nodejs.org/) (เวอร์ชัน 20 หรือใหม่กว่า)
* แพ็กเกจเมเนเจอร์: `npm`

### การติดตั้งและเปิดเซิร์ฟเวอร์

```bash
# 1. ติดตั้ง Dependencies
npm install

# 2. เริ่มต้นรันเซิร์ฟเวอร์
npm run dev
# หรือ
npm start
```

เปิดเว็บเบราว์เซอร์ไปที่ [http://localhost:3000](http://localhost:3000) เพื่อเข้าสู่ระบบ