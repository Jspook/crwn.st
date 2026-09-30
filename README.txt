===================================================
crwn.st - E-commerce & Fitting Room System
===================================================

ระบบ Point-of-Sale (POS) และระบบจัดการห้องลองชุดอัจฉริยะ (Seamless O2O Retail Experience) สำหรับธุรกิจแฟชั่นและเสื้อผ้าระดับลักชัวรี

URL สำหรับเข้าใช้งานระบบ:
- หน้าหลัก (Storefront / Customer): http://localhost:3000
- หน้าเข้าสู่ระบบ (Login Portal): http://localhost:3000/login

---------------------------------------------------
1. บัญชีสำหรับเข้าสู่ระบบ (Actor Credentials)
---------------------------------------------------

สามารถใช้ข้อมูลด้านล่างนี้ในการเข้าสู่ระบบและทดสอบฟังก์ชันการทำงานต่างๆ ได้ทันที:

[1. แคชเชียร์ (Cashier)]
- หน้าจอชำระเงิน POS: http://localhost:3000/staff/cashier
- รหัสพนักงาน (ID): 68070254
- รหัสผ่าน (Password): 68070254
- สิทธิ์: เข้าหน้า POS Counter, ยิงบาร์โค้ดสินค้า, ค้นหาสมาชิกด้วยเบอร์โทร, คิดเงิน, พิมพ์ใบเสร็จ, ตัดสต็อกอัตโนมัติ

[2. พนักงานห้องลองเสื้อ (Fitting Staff)]
- หน้าจอจัดการห้องลอง: http://localhost:3000/staff/fitting
- รหัสพนักงาน (ID): 68070056
- รหัสผ่าน (Password): 68070056
- สิทธิ์: เข้าหน้า Fitting Kanban, ตรวจสอบสถานะห้องลอง (ว่าง/มีลูกค้า), จัดการคิวคำขอลองชุด, เปลี่ยนสถานะ เตรียมชุด/นำส่งชุด

[3. ลูกค้า (Customer)]
- หน้าจอเลือกสินค้า / สั่งของไปห้องลอง: http://localhost:3000
- บัญชีทดสอบที่ 1:
  * เบอร์โทรศัพท์: 0812345678 (u1 - สมชาย ใจดี)
  * รหัสผ่าน: 123456
- บัญชีทดสอบที่ 2:
  * เบอร์โทรศัพท์: 0899999999 (u2 - สมหญิง ใจงาม)
  * รหัสผ่าน: 123456
- สิทธิ์: เข้าหน้า Customer Portal, สแกนเข้าห้องลอง, ค้นหาสินค้าตามหมวดหมู่/แท็ก, ส่งคำขอให้พนักงานนำชุดมาส่งในห้องลอง, ตะกร้าสินค้า, Self-checkout
- หมายเหตุ: ลูกค้าสามารถสมัครสมาชิกใหม่ได้ที่หน้า Register

---------------------------------------------------
2. รหัสบาร์โค้ดสินค้าตัวอย่างสำหรับทดสอบ (Test Barcodes - Numeric 13 Digits)
---------------------------------------------------

ฐานข้อมูลมีสินค้าทั้งหมด 67 รายการ (p1 - p67) และมีรหัสบาร์โค้ดย่อย 96 SKU (รหัสตัวเลข EAN-13 รูปแบบ 13 หลัก)
สามารถคัดลอกรหัสบาร์โค้ดด้านล่างไปยิงสแกนค้นหาในหน้า POS หรือหน้าเลือกลองชุดได้ทันที:

[กลุ่มเสื้อยืด & เสื้อเชิ้ต (Tops)]
- 8850010140000 : Classic Cotton Crewneck T-Shirt (฿690) - ไซส์ XL / สี Black (สต็อก: 21) [LOC-01]
- 8850010310001 : Classic Cotton Crewneck T-Shirt (฿690) - ไซส์ S / สี Navy (สต็อก: 13) [LOC-01]
- 8850020640002 : Vintage Wash Graphic T-Shirt (฿840) - ไซส์ XL / สี Beige (สต็อก: 20) [LOC-03]
- 8850020340003 : Vintage Wash Graphic T-Shirt (฿840) - ไซส์ XL / สี Navy (สต็อก: 13) [LOC-03]
- 8850030220004 : Oversized Heavyweight T-Shirt (฿990) - ไซส์ M / สี White (สต็อก: 12) [LOC-04]
- 8850040210006 : Ribbed Slim Fit T-Shirt (฿1,140) - ไซส์ S / สี White (สต็อก: 18) [LOC-02]
- 8850110320020 : Classic Oxford Cotton Shirt (฿690) - ไซส์ M / สี Navy (สต็อก: 14) [LOC-01]

[กลุ่มเสื้อแจ็คเก็ต & เสื้อคลุม (Outerwear)]
- 8850160440030 : Chunky Knit Wool Cardigan (฿1,990) - ไซส์ XL / สี Navy (สต็อก: 11) [LOC-03]
- 8850170540032 : Fleece Zip-Up Jacket (฿2,290) - ไซส์ XL / สี Khaki (สต็อก: 5) [LOC-02]
- 8850180110033 : Classic Trench Coat (฿2,590) - ไซส์ S / สี Black (สต็อก: 18) [LOC-04]
- 8850380420063 : Oversized Denim Jacket (฿2,590) - ไซส์ M / สี Navy (สต็อก: 29) [LOC-02]

[กลุ่มกางเกง & ขาสั้น (Bottoms)]
- 8850410332068 : High-Waist Wide Leg Trousers (฿990) - ไซส์ 30 / สี DarkGrey (สต็อก: 22) [LOC-04]
- 8850420434069 : Slim Fit Stretch Chinos (฿1,140) - ไซส์ 32 / สี Beige (สต็อก: 25) [LOC-01]
- 8850430110071 : Relaxed Fit Denim Jeans (฿1,290) - ไซส์ S / สี Black (สต็อก: 25) [LOC-04]
- 8850460510074 : High-Waist Denim Shorts (฿990) - ไซส์ S / สี Khaki (สต็อก: 4) [LOC-03]

[กลุ่มกระโปรง (Skirts)]
- 8850510332079 : Pleated Tennis Mini Skirt (฿990) - ไซส์ 30 / สี Navy (สต็อก: 4) [LOC-01]
- 8850520432080 : A-Line Denim Mini Skirt (฿1,140) - ไซส์ 30 / สี Brown (สต็อก: 21) [LOC-03]
- 8850570320085 : Satin Slip Midi Skirt (฿1,140) - ไซส์ M / สี Navy (สต็อก: 4) [LOC-02]

[กลุ่มเครื่องประดับ & ถุงเท้า & ผ้าพันคอ (Accessories)]
- 8850610500089 : Classic Ribbed Crew Socks (฿390) - ไซส์ OS / สี Charcoal (สต็อก: 26) [LOC-01]
- 8850660300094 : Cashmere Feel Winter Scarf (฿390) - ไซส์ OS / สี Grey (สต็อก: 19) [LOC-02]
- 8850670400095 : Silk Twill Neck Scarf (฿490) - ไซส์ OS / สี Brown (สต็อก: 23) [LOC-02]

---------------------------------------------------
3. ภาพรวมโปรเจกต์ (Overview)
---------------------------------------------------
crwn.st พัฒนาขึ้นเพื่อเชื่อมต่อประสบการณ์การช้อปปิ้งหน้าร้าน (Offline) เข้ากับระบบดิจิทัล (Online) แบบไร้รอยต่อ (Omnichannel O2O Experience)
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
3. ITEM (ข้อมูลสินค้าหลัก 67 รายการ, มี ITM_Category เป็น male/female และ ITM_Tag เป็น top/bottom/skirt/outerwear/accessory)
4. ITEM_VARIANT (ข้อมูลย่อย: สี, ไซส์, สต็อก, รหัสบาร์โค้ด EAN-13 13 หลัก รวม 96 SKUs)
5. LOCATION (ตำแหน่งจัดเก็บสินค้าและชั้นวาง: LOC-01 ถึง LOC-04)
6. PAY_CART (ตะกร้าสินค้า)
7. PAY_CART_ITEM (รายการสินค้าในตะกร้า)
8. SALE_ORDER (หัวบิลการขาย / ออเดอร์)
9. SALE_ORDER_LINE (รายการสินค้าในบิลการขาย)
10. FITTING_ROOM (สถานะห้องลองเสื้อผ้า)

---------------------------------------------------
6. ประสิทธิภาพและการปรับแต่งความเร็ว (Performance Optimizations)
---------------------------------------------------
1. Database Connection Pooling: ใช้งาน Connection Pool (Max 10 connections) พร้อม KeepAlive เพื่อนำ Connection กลับมาใช้ซ้ำ
2. Database Indexing: สร้าง B-Tree Indexes บน Foreign Keys และฟิลด์ค้นหาหลัก (SKU, เบอร์โทรสมาชิก, ออเดอร์)
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
- /api/products [GET] : ดึงรายการสินค้าทั้งหมด (รองรับ ?page=1&limit=12&category=female&search=shirt)
- /api/products/barcode/:code [GET] : ค้นหารายละเอียดสินค้าจากรหัสบาร์โค้ด (SKU 13 หลัก)
- /api/fitting-orders [GET/POST] : ดึงรายการคำขอลองชุด / สร้างคำขอลองชุดใหม่
- /api/fitting-rooms [GET] : ตรวจสอบสถานะห้องลอง (ว่าง / มีลูกค้า)
- /api/cart [GET/POST/DELETE] : จัดการตะกร้าสินค้า
- /api/receipts [POST] : บันทึกใบเสร็จการชำระเงิน พร้อมตัดสต็อกสินค้าทันที

---------------------------------------------------
8. เริ่มต้นใช้งานและจัดการฐานข้อมูล (Local Setup & Database Commands)
---------------------------------------------------

[การเตรียมการและตั้งค่า Environment Variables (.env)]
สร้างหรือตรวจสอบไฟล์ .env ที่โฟลเดอร์หลักของโปรเจกต์:
DB_HOST=webdev.it.kmitl.ac.th
DB_PORT=3306
DB_USER=s68070186
DB_PASSWORD=LPHV425SG215NE
DB_NAME=s68070186

[ขั้นตอนการติดตั้งและเริ่มเซิร์ฟเวอร์ (Step-by-Step Setup)]
1. ติดตั้ง Dependencies และ Library ทั้งหมด:
   $ npm install

2. สร้าง Schema และลงข้อมูลเริ่มต้นในฐานข้อมูล (Full Database Setup & Seed):
   $ node setup-db.js
   (คำสั่งนี้จะรัน database/schema.sql เพื่อสร้าง 10 ตาราง และรัน database/seed.js ใส่ข้อมูลสินค้า 67 รายการ 96 SKU, พนักงาน, ลูกค้า)

3. เริ่มต้นรันเซิร์ฟเวอร์:
   - โหมด Development:
     $ npm run dev
   - โหมด Production:
     $ npm start

4. เปิดเว็บเบราว์เซอร์เข้าใช้งานระบบ:
   - หน้าหลักสำหรับลูกค้า (Storefront): http://localhost:3000
   - หน้าเข้าสู่ระบบ (Login Portal): http://localhost:3000/login

[คำสั่งจัดการและรีเซ็ตฐานข้อมูล (Database Commands)]
- node setup-db.js : ล้าง/สร้าง Table Schema ใหม่ทั้งหมด และใส่ข้อมูล Seed เริ่มต้น (Full DB Setup)
- node database/seed.js : รีเซ็ตและใส่ข้อมูลจำลองใหม่อย่างเดียวโดยไม่รันสคริปต์สร้างตารางใหม่ (Re-Seed Data Only)

---------------------------------------------------
9. การเปิดใช้งานภายนอกด้วย Cloudflare Tunnel (Online / Mobile Testing)
---------------------------------------------------
Cloudflare Tunnel ช่วยให้สามารถเปิดเว็บจากเครื่อง Local (localhost:3000) ให้คนอื่นเข้าใช้งาน หรือใช้สมาร์ตโฟนสแกน QR Code ทดสอบระบบจริงผ่านสัญญาณอินเทอร์เน็ตได้แบบมี HTTPS โดยไม่ต้อง Forward Port

[วิธีที่ 1: ติดตั้งและรันแบบ Quick Tunnel (แนะนำ - ไม่ต้องสมัครบัญชี)]
1. ดาวน์โหลดและติดตั้ง `cloudflared`:
   - Windows (ผ่าน Winget):
     $ winget install --id Cloudflare.cloudflared
   - หรือดาวน์โหลดไฟล์ .exe โดยตรงจาก: https://github.com/cloudflare/cloudflared/releases

2. เปิดเซิร์ฟเวอร์ระบบหลักไว้ในหน้าต่าง Terminal ที่ 1:
   $ npm run dev

3. เปิดหน้าต่าง Terminal ที่ 2 แล้วรันคำสั่งเปิด Tunnel:
   $ cloudflared tunnel --url http://localhost:3000

4. ระบบจะสร้าง Public URL แบบ HTTPS ขึ้นมา เช่น:
   https://random-name-subdomain.trycloudflare.com
   (สามารถนำลิงก์นี้ไปเปิดบนมือถือเพื่อทดสอบสแกน QR Code และทดลองใช้งานระบบได้ทันที)
