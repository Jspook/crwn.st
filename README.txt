===================================================
crwn.st - E-commerce & Fitting Room System
===================================================

ระบบ Point-of-Sale (POS) และระบบจัดการห้องลองชุดอัจฉริยะ (Seamless O2O Retail Experience) สำหรับธุรกิจแฟชั่นและเสื้อผ้าระดับลักชัวรี

URL สำหรับเข้าใช้งานระบบ:
- หน้าหลัก: http://localhost:3000

---------------------------------------------------
1. บัญชีสำหรับเข้าสู่ระบบ (Actor Credentials)
---------------------------------------------------

สามารถใช้ข้อมูลด้านล่างนี้ในการเข้าสู่ระบบและทดสอบฟังก์ชันการทำงานต่างๆ ได้ทันทีที่หน้าแรก:

[1. แคชเชียร์ (Cashier)]
- หน้าจอชำระเงิน: http://localhost:3000/staff/cashier
- รหัสพนักงาน (ID): 68070254
- รหัสผ่าน (Password): 68070254
- สิทธิ์: เข้าหน้า POS Counter, ยิงบาร์โค้ดสินค้า, ค้นหาสมาชิก, คิดเงิน, พิมพ์ใบเสร็จ, ตัดสต็อก

[2. พนักงานห้องลองเสื้อ (Fitting Staff)]
- หน้าจอจัดการห้องลอง: http://localhost:3000/staff/fitting
- รหัสพนักงาน (ID): 68070056
- รหัสผ่าน (Password): 68070056
- สิทธิ์: เข้าหน้า Fitting Kanban, ตรวจสอบสถานะห้องลอง (ว่าง/มีลูกค้า), จัดการคิวคำขอลองชุด, เปลี่ยนสถานะ เตรียมชุด/นำส่งชุด

[3. ลูกค้า (Customer)]
- หน้าจอเลือกสินค้า: http://localhost:3000
- เบอร์โทรศัพท์ (Tel): 0812345678 (สำหรับผู้ใช้ u1) หรือ 0899999999 (สำหรับผู้ใช้ u2)
- รหัสผ่าน (Password): 123456
- สิทธิ์: เข้าหน้า Customer Portal, สแกนเข้าห้องลอง, ค้นหาสินค้า, ส่งคำขอให้พนักงานนำชุดมาส่ง, ชำระเงิน Self-checkout
- หมายเหตุ: ลูกค้าสามารถสมัครสมาชิกใหม่ได้ที่หน้าเข้าสู่ระบบ

---------------------------------------------------
2. รหัสบาร์โค้ดสินค้าสำหรับทดสอบ (Test Barcodes - Numeric 13 Digits)
---------------------------------------------------

สามารถพิมพ์หรือนำเลขบาร์โค้ด (SKU เป็นตัวเลข 13 หลัก) ด้านล่างไปสแกนในระบบ (ทั้งหน้าลูกค้าและหน้าแคชเชียร์ POS):

- 8850010001011 : Oversized Cashmere Scarf (฿2,490) - OS (Navy) [Camel: 8850010001028, Grey: 8850010001035]
- 8850020001025 : Chunky Knit Wool Sweater (฿3,890) - M (Grey) [S Grey: 8850020001018, L Cream: 8850020001032, M Black: 8850020001049]
- 8850030001022 : Tailored Double-Breasted Coat (฿8,900) - M (Navy) [S Black: 8850030001015, L Camel: 8850030001039]
- 8850040001029 : Wide-Leg Pleated Trousers (฿3,290) - M (Beige) [S Black: 8850040001012, L Charcoal: 8850040001036]
- 8850050001019 : Silk Crepe Midi Skirt (฿4,190) - S (Ivory) [M Champagne: 8850050001026]

---------------------------------------------------
3. ภาพรวมโปรเจกต์ (Overview)
---------------------------------------------------
crwn.st พัฒนาขึ้นเพื่อเชื่อมต่อประสบการณ์การช้อปปิ้งหน้าร้าน (Offline) เข้ากับระบบดิจิทัล (Online) แบบไร้รอยต่อ
- รองรับการสแกน QR Code เข้าใช้งานห้องลองชุด
- ส่งคำขอลองชุด/เปลี่ยนไซส์/เปลี่ยนสี จากในห้องลองไปยังพนักงานแบบเรียลไทม์
- ระบบจัดการคิวคำขอและสถานะห้องลองสำหรับพนักงาน (Fitting Kanban)
- ระบบเคาน์เตอร์แคชเชียร์ (POS Counter) ยิงบาร์โค้ด ตัดสต็อกอัตโนมัติ และพิมพ์ใบเสร็จ
- ระบบชำระเงิน Self-Checkout ด้วย QR PromptPay

---------------------------------------------------
4. เทคโนโลยีที่ใช้ (Tech Stack)
---------------------------------------------------
- Backend & Server: Node.js & Express 5
- View Engine: EJS (Embedded JavaScript templates)
- Styling: Tailwind CSS & Custom CSS (Quiet Luxury Palette)
- Database Engine: MySQL 8 (10 ERD Tables) ผ่าน Connection Pool (mysql2/promise)
- Security & Middleware: BcryptJS (Password Hashing), Cookie-Parser, CORS, Compression (Gzip)

---------------------------------------------------
5. โครงสร้างฐานข้อมูลหลัก (10 Tables)
---------------------------------------------------
โปรเจกต์นี้ใช้ระบบฐานข้อมูล MySQL โดยแบ่งออกเป็น 10 ตารางหลัก ได้แก่:
1. EMPLOYEE (ข้อมูลพนักงานและสิทธิ์การใช้งาน)
2. CUSTOMER (ข้อมูลสมาชิกลูกค้า)
3. ITEM (ข้อมูลสินค้าหลัก)
4. ITEM_VARIANT (ข้อมูลสี, ไซส์, สต็อก, รหัสบาร์โค้ด 13 หลัก)
5. LOCATION (ตำแหน่งชั้นวางสินค้าและโซนในร้าน)
6. PAY_CART (ตะกร้าสินค้า)
7. PAY_CART_ITEM (รายการสินค้าในตะกร้า)
8. SALE_ORDER (หัวบิลการขาย / ออเดอร์)
9. SALE_ORDER_LINE (รายการสินค้าในบิลการขาย)
10. FITTING_ROOM (สถานะห้องลองเสื้อผ้า)

---------------------------------------------------
6. ประสิทธิภาพและการปรับแต่งความเร็ว (Performance Optimizations)
---------------------------------------------------
1. Database Connection Pooling: ใช้งาน Connection Pool (Max 10 connections) พร้อม KeepAlive เพื่อนำ Connection กลับมาใช้ซ้ำ
2. Database Indexing: สร้าง B-Tree Indexes บน Foreign Keys และฟิลด์ค้นหาหลัก (SKU, หมวดหมู่, สมาชิก)
3. Gzip Payload Compression: บีบอัดหน้าเว็บและ API JSON Response ด้วย Express Compression Middleware
4. Static Asset Caching: ตั้งค่า HTTP Cache-Control (maxAge: 1d, ETag) สำหรับไฟล์ CSS, JS, Fonts
5. Image Optimization & Lazy Loading: ปรับขนาดความละเอียดภาพ และเพิ่ม loading="lazy" พร้อม decoding="async"
6. Debounce Input Handlers: หน่วงเวลา 300-400ms สำหรับช่องค้นหาบาร์โค้ด สมาชิก และการคำนวณเงินทอน
7. Pagination Support: รองรับการแบ่งหน้าข้อมูลสินค้าผ่าน API (/api/products?page=1&limit=12)
8. Defer Non-critical Scripts: ใส่ attribute defer เพื่อไม่ให้บล็อกการแสดงผลโครงสร้างหน้าจอ
9. Global Loading Indicator: แสดง Loading Spinner แบบนุ่มนวลระหว่างรอประมวลผล

---------------------------------------------------
7. API Reference หลัก
---------------------------------------------------
- /api/auth/login [POST] : เข้าสู่ระบบ (พนักงาน / สมาชิก)
- /api/auth/register [POST] : สมัครสมาชิกใหม่สำหรับลูกค้า
- /api/auth/logout [POST] : ออกจากระบบและเคลียร์ Session
- /api/products [GET] : ดึงรายการสินค้าทั้งหมด (รองรับ ?page=1&limit=12&category=Tops&search=shirt)
- /api/products/barcode/:code [GET] : ค้นหารายละเอียดสินค้าจากรหัสบาร์โค้ด (SKU)
- /api/fitting-orders [GET/POST] : ดึงรายการคำขอลองชุด / สร้างคำขอลองชุดใหม่
- /api/fitting-rooms [GET] : ตรวจสอบสถานะห้องลอง (ว่าง / มีลูกค้า)
- /api/cart [GET/POST/DELETE] : จัดการตะกร้าสินค้า
- /api/receipts [POST] : บันทึกใบเสร็จการชำระเงิน พร้อมตัดสต็อกสินค้าทันที

---------------------------------------------------
8. เริ่มต้นใช้งานในเครื่อง (Local Setup)
---------------------------------------------------
รันไฟล์ start.bat เพื่อเริ่มต้นระบบ หรือรันคำสั่ง:
1. npm install
2. npm run dev (หรือ npm start)

*เปิดเว็บเบราว์เซอร์ไปที่ http://localhost:3000

การตั้งค่าฐานข้อมูล (.env):
กำหนดค่าการเชื่อมต่อ MySQL ในไฟล์ .env ดังนี้:
DB_HOST=
DB_PORT=3306
DB_USER=...
DB_PASSWORD=...
DB_NAME=...
