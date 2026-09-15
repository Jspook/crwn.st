# crwn.st (surreal-fit)

> ระบบ Point-of-Sale (POS) และระบบจัดการห้องลองชุดอัจฉริยะ (Seamless O2O Retail Experience) สำหรับธุรกิจแฟชั่นและเสื้อผ้าระดับลักชัวรี

---

## 🧪 ข้อมูลบัญชีสำหรับทดสอบระบบ (Demo Accounts)

สามารถใช้ข้อมูลด้านล่างนี้ในการเข้าสู่ระบบและทดสอบฟังก์ชันการทำงานต่างๆ ได้ทันทีที่หน้าแรก (`/`):

| บทบาท (Role) | เบอร์โทรศัพท์ / รหัสพนักงาน (Identifier) | รหัสผ่าน (Password) | สิทธิ์และการเข้าถึง |
| :--- | :--- | :--- | :--- |
| 👤 **ลูกค้า (Customer)** | `0812345678` หรือ `0899999999` | `123456` | เข้าหน้า Customer Portal (`/customer/dashboard`), สแกนเข้าห้องลอง, ค้นหาสินค้า, ส่งคำขอให้พนักงานนำชุดมาส่ง, ชำระเงิน Self-checkout |
| 💼 **แคชเชียร์ (Cashier / POS)** | `68070254` | `68070254` | เข้าหน้า POS Counter (`/staff/cashier`), ยิงบาร์โค้ดสินค้า, ค้นหาสมาชิก, คิดเงิน, พิมพ์ใบเสร็จ, ตัดสต็อก |
| 🚪 **พนักงานห้องลอง (Fitting Staff)** | `68070056` | `68070056` | เข้าหน้า Fitting Kanban (`/staff/fitting`), ตรวจสอบสถานะห้องลอง (ว่าง/มีลูกค้า), จัดการคิวคำขอลองชุด, เปลี่ยนสถานะ เตรียมชุด/นำส่งชุด |

> 💡 **หมายเหตุ:** ลูกค้ายังสามารถกดปุ่ม **"สมัครสมาชิก"** บนหน้าแรกเพื่อสร้างบัญชีใหม่ของตนเองได้ทันที

---

### 📦 รหัสบาร์โค้ดสินค้าสำหรับทดสอบ (Test Barcodes)

สามารถพิมพ์หรือนำเลขบาร์โค้ด (SKU) ด้านล่างไปสแกนในระบบ (ทั้งหน้าลูกค้าและหน้าแคชเชียร์ POS):

| รหัสบาร์โค้ด (SKU) | ชื่อสินค้า (Product Name) | ราคา (บาท) | ไซส์/สี ที่มี |
| :--- | :--- | :--- | :--- |
| `p1-os-navy` | **Oversized Cashmere Scarf** | ฿2,490 | OS (Navy, Camel, Grey) |
| `p2-m-grey` | **Chunky Knit Wool Sweater** | ฿3,890 | S, M, L (Grey, Cream, Black) |
| `p3-m-navy` | **Tailored Double-Breasted Coat** | ฿8,900 | S, M, L (Black, Navy, Camel) |
| `p4-m-beige` | **Wide-Leg Pleated Trousers** | ฿3,290 | S, M, L (Black, Beige, Charcoal) |
| `p5-s-ivory` | **Silk Crepe Midi Skirt** | ฿4,190 | S, M (Ivory, Champagne) |

---

## 📌 ภาพรวมโปรเจกต์ (Overview)

**crwn.st** พัฒนาขึ้นเพื่อเชื่อมต่อประสบการณ์การช้อปปิ้งหน้าร้าน (Offline) เข้ากับระบบดิจิทัล (Online) แบบไร้รอยต่อ โดยครอบคลุมการทำงาน 3 บทบาทหลัก:

1. **Customer (ลูกค้า):** สแกน QR ประตูห้องลองเพื่อเช็กอิน, สแกนบาร์โค้ดเสื้อผ้าเพื่อตรวจดูไซส์และสต็อก, ส่งคำขอให้พนักงานนำชุดมาส่งถึงห้องลอง และชำระเงินได้ด้วยตัวเอง (Self-checkout)
2. **Fitting Room Staff (พนักงานห้องลอง):** บอร์ดคิวติดตามและจัดการคำร้องขอลองชุดแบบ Real-time จัดการสถานะห้องลอง (เคลียร์ห้องว่าง) และนำชุดไปส่งลูกค้าตามห้องลอง
3. **Cashier (พนักงานแคชเชียร์):** ระบบ POS หน้าเคาน์เตอร์ สแกนบาร์โค้ดสินค้า ค้นหาสมาชิก คำนวณราคารวมและภาษี ออกใบเสร็จ และตัดสต็อกสินค้าในระบบ

---

## 🛠 เทคโนโลยีที่ใช้ (Tech Stack)

* **Backend & Server:** [Node.js](https://nodejs.org/) & [Express 5](https://expressjs.com/)
* **View Engine:** [EJS (Embedded JavaScript templates)](https://ejs.co/)
* **Styling:** [Tailwind CSS](https://tailwindcss.com/) (Quiet Luxury Palette)
* **Database Engine:** **MySQL** (โครงสร้างฐานข้อมูล 10 ตาราง)

---

## 📂 โครงสร้างฐานข้อมูลหลัก (10 Tables)

โปรเจกต์นี้ใช้ระบบฐานข้อมูล MySQL โดยแบ่งออกเป็น 10 ตารางหลัก ได้แก่:
- `EMPLOYEE`, `CUSTOMER`, `ITEM`, `LOCATION`, `ITEM_VARIANT`
- `PAY_CART`, `PAY_CART_ITEM`
- `SALE_ORDER`, `SALE_ORDER_LINE`, `FITTING_ROOM`

---

## 🌐 API Reference หลัก

| Endpoint | Method | คำอธิบาย |
| :--- | :--- | :--- |
| `/api/auth/login` | `POST` | ล็อกอิน (ใช้เบอร์โทรศัพท์สำหรับลูกค้า หรือรหัสพนักงานสำหรับ Staff) |
| `/api/auth/register` | `POST` | สมัครสมาชิกใหม่สำหรับลูกค้า |
| `/api/products/barcode/:code` | `GET` | ค้นหารายละเอียดสินค้าจากรหัสบาร์โค้ด (SKU) |
| `/api/fitting-orders` | `GET` / `POST` | ดึงรายการคำขอลองชุด / สร้างคำขอลองชุดใหม่ |
| `/api/fitting-rooms` | `GET` | ตรวจสอบสถานะห้องลอง (ว่าง / กำลังลองชุด) |
| `/api/receipts` | `POST` | บันทึกใบเสร็จการชำระเงิน พร้อมตัดสต็อกสินค้าทันที |

---

## 🚀 เริ่มต้นใช้งานในเครื่อง (Local Setup)

```bash
# 1. ติดตั้ง Dependencies
npm install

# 2. เริ่มต้นรันเซิร์ฟเวอร์
npm run dev
# หรือ
npm start
```

เปิดเว็บเบราว์เซอร์ไปที่ [http://localhost:3000](http://localhost:3000)