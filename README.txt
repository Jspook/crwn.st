================================================================================
crwn.st — Smart Fitting Room & Retail Point-of-Sale (POS) System
เอกสารคู่มือระบบและคำแนะนำการติดตั้งระดับมาตรฐานสากล (Production-Grade Documentation)
================================================================================

1. ภาพรวมของโครงการ (Project Overview)
--------------------------------------------------------------------------------
crwn.st คือระบบเว็บแอปพลิเคชันจัดการร้านค้าปลีกแฟชั่นและห้องลองเสื้อผ้าอัจฉริยะ 
(Omnichannel O2O Retail Platform) ที่เชื่อมต่อประสบการณ์การช้อปปิ้งหน้าร้าน (Offline) 
เข้ากับระบบดิจิทัล (Online) อย่างไร้รอยต่อ โดยครอบคลุม:
- การสแกน QR Code เข้าใช้งานห้องลองเสื้อผ้า (Smart Fitting Room Entrance)
- การขอลองชุด เปลี่ยนไซส์ หรือเปลี่ยนสีเสื้อผ้าจากภายในห้องลองแบบเรียลไทม์
- ระบบกระดานคันบัน (Fitting Kanban Board) สำหรับพนักงานจัดการคำขอนำส่งชุด
- ระบบเคาน์เตอร์แคชเชียร์ (POS Counter) ค้นหาสินค้าด้วยบาร์โค้ด ตัดสต็อกอัตโนมัติ และพิมพ์ใบเสร็จ
- ระบบชำระเงินด้วยตนเอง (Self-Checkout) พร้อมเชื่อมต่อตะกร้าสินค้าจากห้องลองสู่การสั่งซื้อ

URL สำหรับการเข้าใช้งานระบบ (เริ่มต้นที่ Localhost):
- หน้าหลักร้านค้าและพอร์ทัลลูกค้า (Customer Storefront): http://localhost:3000
- หน้าเข้าสู่ระบบและสมัครสมาชิก (Authentication Portal): http://localhost:3000/login
- หน้าพอร์ทัลพนักงาน (Staff Portal): http://localhost:3000/staff


2. สถาปัตยกรรมและเทคโนโลยีที่ใช้ (Tech Stack & Architecture)
--------------------------------------------------------------------------------
ระบบได้รับการออกแบบตามมาตรฐาน Clean Architecture และ SOLID Principles:

- Backend Runtime  : Node.js (v22.0.0 หรือใหม่กว่า)
- Web Framework    : Express.js (v5.x)
- View Engine      : EJS (Embedded JavaScript Templates) พร้อมโครงสร้าง Partial Modules
- Styling Engine   : Tailwind CSS ร่วมกับ Vanilla CSS Design System (โทน Quiet Luxury)
- Database Engine  : MySQL 8 (10 Relational Tables ตามข้อกำหนด ERD)
- Database Driver  : mysql2/promise (Connection Pooling + Prepared Statements)
- Security Layer   :
  * การเข้ารหัสรหัสผ่านด้วย Bcrypt.js (Salt Rounds: 10)
  * Signed & HttpOnly Session Cookies (ป้องกัน XSS และ Session Tampering)
  * Security Headers: Permissions-Policy, X-Content-Type-Options: nosniff, 
    X-Frame-Options: DENY, Referrer-Policy: strict-origin-when-cross-origin
  * Rate Limiting & Input Validation ก่อนดำเนินการประมวลผลธุรกรรม (Transactions)
  * Pre-flight Live Database Protection Guard ป้องกันการทำลายข้อมูลจริงขณะรันเทสต์
- Performance      :
  * Compression Middleware (Gzip/Deflate)
  * Static Asset Caching (ETag, Cache-Control: maxAge 1d)
  * Lazy Loading และ Asynchronous Image Decoding


3. สิทธิ์การใช้งานและบัญชีผู้ใช้สำหรับทดสอบ (Actor Credentials)
--------------------------------------------------------------------------------

[1] แคชเชียร์ประจำจุดขาย (Cashier)
- เส้นทางเข้าใช้งาน: http://localhost:3000/staff/cashier
- รหัสพนักงาน (ID): 68070254
- รหัสผ่าน (Password): 68070254
- สิทธิ์และหน้าที่: ค้นหาสินค้าด้วยบาร์โค้ด EAN-13, ค้นหาสมาชิกด้วยเบอร์โทรศัพท์,
  รวมยอดคำนวณเงินทอน, บันทึกการชำระเงิน, ตัดสต็อกแบบ Real-time, และออกใบเสร็จรับเงิน

[2] พนักงานดูแลห้องลองเสื้อ (Fitting Staff)
- เส้นทางเข้าใช้งาน: http://localhost:3000/staff/fitting
- รหัสพนักงาน (ID): 68070056
- รหัสผ่าน (Password): 68070056
- สิทธิ์และหน้าที่: ตรวจสอบสถานะการใช้งานห้องลอง 4 ห้อง, จัดการคิวงานคำขอลองชุด
  (รับงาน/จัดเตรียม/ส่งมอบ), บันทึกเวลาแล้วเสร็จแบบ Immutable Timestamp

[3] ลูกค้าทั่วไปและสมาชิก (Customer)
- เส้นทางเข้าใช้งาน: http://localhost:3000
- บัญชีทดสอบที่ 1:
  * เบอร์โทรศัพท์: 0812345678 (u1 - สมชาย ใจดี)
  * รหัสผ่าน: 123456
- บัญชีทดสอบที่ 2:
  * เบอร์โทรศัพท์: 0899999999 (u2 - สมหญิง ใจงาม)
  * รหัสผ่าน: 123456
- สิทธิ์และหน้าที่: ค้นหาสินค้าในร้าน, สแกน QR Code เพื่อเข้าใช้งานห้องลอง, 
  ส่งคำขอลองไซส์/สีไปยังพนักงาน, นำชุดที่ลองแล้วเข้าสู่ตะกร้า, ชำระเงิน Self-Checkout


4. ข้อมูลรหัสบาร์โค้ดสินค้าและห้องลองสำหรับทดสอบ (Test Catalog & Room Barcodes)
--------------------------------------------------------------------------------

4.1 ข้อมูลห้องลองเสื้อผ้า (Canonical Fitting Rooms - 4 Physical Rooms)
รหัสมาตรฐาน EAN-13 ประจำห้องลอง (กำหนดเป็น Single Source of Truth):
- ห้องที่ 1 : Barcode = 5684848452325 (Alias: 1)
- ห้องที่ 2 : Barcode = 5684848452326 (Alias: 2)
- ห้องที่ 3 : Barcode = 5684848452327 (Alias: 3)
- ห้องที่ 4 : Barcode = 5684848452328 (Alias: 4)
* ระบบรองรับ Atomic Transaction Lock, ตรวจสอบความเป็นเจ้าของเซสชัน (Same-Owner Resume),
  และปฏิเสธ QR Code แปลกปลอม/Phantom ด้วย 400 Bad Request ทันที

4.2 รหัสบาร์โค้ดสินค้าตัวอย่าง (Product SKUs - EAN-13 13 หลัก)
ฐานข้อมูลมีสินค้าหลัก 67 รายการ (p1 - p67) รวม 96 SKUs สามารถคัดลอกไปทดสอบได้ทันที:

[กลุ่มเสื้อ (Tops)]
- 8850010140000 : Classic Cotton Crewneck T-Shirt (฿690) - ไซส์ XL / สี Black (สต็อก: 21) [LOC-01]
- 8850010310001 : Classic Cotton Crewneck T-Shirt (฿690) - ไซส์ S / สี Navy (สต็อก: 13) [LOC-01]
- 8850020640002 : Vintage Wash Graphic T-Shirt (฿840) - ไซส์ XL / สี Beige (สต็อก: 20) [LOC-03]
- 8850030220004 : Oversized Heavyweight T-Shirt (฿990) - ไซส์ M / สี White (สต็อก: 12) [LOC-04]
- 8850110320020 : Classic Oxford Cotton Shirt (฿690) - ไซส์ M / สี Navy (สต็อก: 14) [LOC-01]

[กลุ่มเสื้อแจ็คเก็ตและเสื้อคลุม (Outerwear)]
- 8850160440030 : Chunky Knit Wool Cardigan (฿1,990) - ไซส์ XL / สี Navy (สต็อก: 11) [LOC-03]
- 8850170540032 : Fleece Zip-Up Jacket (฿2,290) - ไซส์ XL / สี Khaki (สต็อก: 5) [LOC-02]
- 8850180110033 : Classic Trench Coat (฿2,590) - ไซส์ S / สี Black (สต็อก: 18) [LOC-04]
- 8850380420063 : Oversized Denim Jacket (฿2,590) - ไซส์ M / สี Navy (สต็อก: 29) [LOC-02]

[กลุ่มกางเกง (Bottoms)]
- 8850410332068 : High-Waist Wide Leg Trousers (฿990) - ไซส์ 30 / สี DarkGrey (สต็อก: 22) [LOC-04]
- 8850420434069 : Slim Fit Stretch Chinos (฿1,140) - ไซส์ 32 / สี Beige (สต็อก: 25) [LOC-01]
- 8850430110071 : Relaxed Fit Denim Jeans (฿1,290) - ไซส์ S / สี Black (สต็อก: 25) [LOC-04]
- 8850460510074 : High-Waist Denim Shorts (฿990) - ไซส์ S / สี Khaki (สต็อก: 4) [LOC-03]

[กลุ่มกระโปรง (Skirts - Reclassified to Female Category)]
- 8850510332079 : Pleated Tennis Mini Skirt (฿990) - ไซส์ 30 / สี Navy (สต็อก: 4) [LOC-01]
- 8850520432080 : A-Line Denim Mini Skirt (฿1,140) - ไซส์ 30 / สี Brown (สต็อก: 21) [LOC-03]
- 8850570320085 : Satin Slip Midi Skirt (฿1,140) - ไซส์ M / สี Navy (สต็อก: 4) [LOC-02]

[กลุ่มเครื่องประดับและอุปกรณ์ตกแต่ง (Accessories)]
- 8850610500089 : Classic Ribbed Crew Socks (฿390) - ไซส์ OS / สี Charcoal (สต็อก: 26) [LOC-01]
- 8850660300094 : Cashmere Feel Winter Scarf (฿390) - ไซส์ OS / สี Grey (สต็อก: 19) [LOC-02]
- 8850670400095 : Silk Twill Neck Scarf (฿490) - ไซส์ OS / สี Brown (สต็อก: 23) [LOC-02]


5. โครงสร้างฐานข้อมูลเชิงสัมพันธ์ (Database Schema - 10 Core Tables)
--------------------------------------------------------------------------------
ฐานข้อมูลรองรับ Foreign Key Constraints และ B-Tree Indexes เพื่อประสิทธิภาพสูงสุด:

1. EMPLOYEE         : บัญชีและสิทธิ์การใช้งานของพนักงาน (CASHIER, FITTING_STAFF)
2. CUSTOMER         : ข้อมูลสมาชิก รหัสผ่านที่แฮช และเบอร์โทรศัพท์สำหรับระบุตัวตน
3. ITEM             : รายการสินค้าหลัก (ITM_ID, ITM_Name, ITM_Price, ITM_Category, ITM_Tag)
4. ITEM_VARIANT     : รายการย่อยสินค้า (ITV_SKUID EAN-13, ITV_Color, ITV_Size, ITV_Stock, LOC_ID)
5. LOCATION         : ตำแหน่งจัดเก็บสินค้าในคลังหรือหน้าร้าน (LOC-01 ถึง LOC-04)
6. PAY_CART         : ตะกร้าสินค้าผูกกับบัญชีลูกค้า
7. PAY_CART_ITEM    : รายการสินค้าในตะกร้า (เก็บรายการแบบละเอียดเพื่อคำนวณจำนวนชิ้น)
8. SALE_ORDER       : บันทึกหัวบิลการขาย (ORD_ID, ยอดรวม, วิธีชำระเงิน, วันที่เวลา)
9. SALE_ORDER_LINE  : บันทึกรายการสินค้าในแต่ละบิล (ORD_ID, ITV_SKUID, จำนวน, ราคาต่อหน่วย)
10. FITTING_ROOM    : สถานะห้องลอง คิวคำขอ และประวัติการลองชุด 
                      (FTR_OrderID, ITV_SKUID, FTR_Number, CUS_ID, FTR_OrderTime, FTR_FinishTime)


6. ข้อกำหนดและความปลอดภัยของระบบ (Security & Compliance)
--------------------------------------------------------------------------------
1. Zero Hardcoded Secrets:
   ข้อมูลการเชื่อมต่อและกุญแจความปลอดภัยถูกจัดเก็บในตัวแปรสภาพแวดล้อม (.env) เท่านั้น
2. Injection Prevention:
   คำสั่ง SQL ทุกจุดใช้ Parameterized Queries (Prepared Statements) 100%
3. Cryptographic Storage:
   รหัสผ่านทุกบัญชีเข้ารหัสด้วย Bcrypt Salt Hash ไม่มีการเก็บ Plaintext
4. Transaction Integrity:
   การทำธุรกรรมที่มีผลต่อสถานะห้องลอง การตัดสต็อกสินค้า และการแก้ไขตะกร้า 
   ทำงานภายใต้ Database Transaction พร้อมระบบ Rollback เมื่อเกิดข้อผิดพลาด
5. Anti Cart-Wipe:
   การเข้าสู่ระบบของลูกค้าจะไม่ลบข้อมูลตะกร้าสินค้าเดิมที่ค้างอยู่


7. การติดตั้งและเริ่มต้นใช้งาน (Installation & Quick Start)
--------------------------------------------------------------------------------

[ข้อกำหนดเบื้องต้น (Prerequisites)]
- Node.js version 22.0.0 หรือสูงกว่า
- ตัวจัดการแพ็กเกจ npm (ติดตั้งมาพร้อม Node.js) หรือ bun

[ขั้นตอนการติดตั้ง (Step-by-Step Installation)]
1. ทำการ Clone คลังโค้ดและเข้าไปยังไดเรกทอรีโครงการ:
   $ git clone https://github.com/Jspook/crwn.st.git
   $ cd crwn.st

2. ติดตั้ง Dependencies ทั้งหมด:
   $ npm install

3. ตั้งค่าสภาพแวดล้อม (Environment Variables):
   คัดลอกไฟล์ต้นแบบ `.env.example` เป็น `.env`
   $ cp .env.example .env
   
   กำหนดค่าในไฟล์ `.env` ดังนี้:
   --------------------------------------------------
   DB_HOST=webdev.it.kmitl.ac.th
   DB_PORT=3306
   DB_USER=s68070186
   DB_PASSWORD=LPHV425SG215NE
   DB_NAME=s68070186
   COOKIE_SECRET=c8f5e19b02a4d764a859e23bfa136d89e52c938f2b71904a6c8e310d54b87912
   PORT=3000
   NODE_ENV=development
   --------------------------------------------------

4. เริ่มต้นรันเว็บแอปพลิเคชัน:
   - โหมดสำหรับการพัฒนา (Development Mode):
     $ npm run dev
   - โหมดการทำงานจริง (Production Mode):
     $ npm start

5. เข้าใช้งานผ่านเว็บเบราว์เซอร์:
   เปิดไปที่ http://localhost:3000


8. คำสั่งการทดสอบระบบ (Automated Testing)
--------------------------------------------------------------------------------
โครงการนี้มีชุดทดสอบอัตโนมัติแบบครบวงจร (Unit & Regression Tests) 
โดยใช้ Node.js Native Test Runner (node:test และ node:assert) 
ทำงานผ่าน Mock Database Engine ในตัว ทำให้สามารถรันเทสต์ได้อย่างปลอดภัย 100%
โดยไม่มีการเปลี่ยนแปลงหรือทำลายข้อมูลบน Live Production Database

รันชุดทดสอบหลักทั้งหมด (Unit & Regression):
$ npm test

รันเฉพาะชุดทดสอบ Regression:
$ npm run test:regression

ผลลัพธ์การทดสอบปัจจุบัน:
- จำนวนชุดทดสอบ (Suites) : 8 Suites
- จำนวนเคสทดสอบ (Tests)  : 31 Tests
- สถานะ                  : ผ่านทั้งหมด 100% (0 Failures, 0 Skipped)
- เวลาเฉลี่ยในการรัน      : ~300ms


9. คำสั่งจัดการฐานข้อมูล (Database Administration Scripts)
--------------------------------------------------------------------------------
- $ node setup-db.js
  ทำการสร้าง Schema ตารางทั้ง 10 ตาราง และเพิ่มข้อมูลเริ่มต้น (Clean & Initial Setup)

- $ node database/seed.js
  ทำการ Re-seed ข้อมูลเริ่มต้น (สินค้า, บัญชีผู้ใช้, ตำแหน่งจัดเก็บ) ลงในตารางเดิม

- Migration Files:
  * database/migrations/20261005_add_session_id.sql : เพิ่มคอลัมน์ Session และ Customer
  * database/migrations/20261014_fix_skirt_category.sql : ปรับประเภทกระโปรงเป็น 'female'


10. การทดสอบบนอุปกรณ์มือถือผ่าน Cloudflare Tunnel (Mobile QR Testing)
--------------------------------------------------------------------------------
สำหรับการทดสอบการสแกนบาร์โค้ดหรือ QR Code ด้วยกล้องสมาร์ตโฟนจริงผ่านอินเทอร์เน็ต:

1. ติดตั้ง `cloudflared`:
   - Windows (ผ่าน Winget):
     $ winget install --id Cloudflare.cloudflared
   - macOS (ผ่าน Homebrew):
     $ brew install cloudflared

2. เปิดเซิร์ฟเวอร์ระบบหลักไว้ที่ Terminal หน้าต่างที่ 1:
   $ npm run dev

3. เปิด Cloudflare Quick Tunnel ที่ Terminal หน้าต่างที่ 2:
   $ cloudflared tunnel --url http://localhost:3000

4. นำ URL สาธารณะแบบ HTTPS ที่ระบบสร้างขึ้น (เช่น https://xxxx.trycloudflare.com)
   ไปเปิดใช้งานบนมือถือเพื่อทดสอบสแกน QR Code หน้าห้องลองและบาร์โค้ดสินค้าได้ทันที


11. โครงสร้างไดเรกทอรีโครงการ (Project Structure)
--------------------------------------------------------------------------------
crwn.st/
|-- Audit/                 # รายงานการวิเคราะห์และแผนการแก้ไขจุดบกพร่องของระบบ
|-- database/              # ตัวจัดการฐานข้อมูล, Schema, Migrations และ Seeder
|   |-- db.js              # Database Access Layer พร้อม Mock Handler สำหรับ Unit Test
|   |-- schema.sql         # โครงสร้างตารางทั้ง 10 ตาราง
|   |-- seed.js            # ข้อมูลตั้งต้นสำหรับระบบ (สินค้า, สมาชิก, พนักงาน)
|   +-- migrations/        # ไฟล์ SQL Patch สำหรับฐานข้อมูล
|-- middleware/            # มิดเดิลแวร์การตรวจสอบสิทธิ์ (Authentication & Role Guards)
|-- public/                # ไฟล์สถิต (Static Assets: CSS, Client JS, Icons, Images)
|   |-- js/app.js          # Client-side Logic หลัก, การจัดการ Modal และการสแกน QR
|   |-- js/cart.js         # Client-side Shopping Cart Manager
|   +-- js/cashier.js      # Client-side POS Checkout & Barcode Scanner
|-- routes/                # Express API & View Routing Handlers
|   |-- api.js             # REST API Endpoints สำหรับสินค้า, ตะกร้า, ห้องลอง, ใบเสร็จ
|   |-- auth.js            # Authentication Endpoints (Login, Register, Logout)
|   +-- views.js           # Server-side Rendering View Routes
|-- test/                  # ชุดทดสอบเฉพาะทาง (Room Exit Flow)
|-- tests/                 # ชุดทดสอบระดับระบบ (Regression, Room Resolver, API Safety)
|-- utils/                 # โมดูลฟังก์ชันช่วยเหลือ (Canonical Room Resolver)
|-- views/                 # EJS Template Views (Customer, Staff, Cashier, Modals)
|-- .env.example           # แม่แบบตัวแปรสภาพแวดล้อม
|-- package.json           # โครงสร้างโครงการ Dependencies และคำสั่งสคริปต์
|-- README.txt             # คู่มือการใช้งานระบบฉบับทางการภาษาไทย
+-- server.js              # ไฟล์เริ่มต้นระบบเซิร์ฟเวอร์หลัก (Application Entrypoint)

================================================================================
(C) 2026 crwn.st. All rights reserved. Built for Luxury Retail & Smart Fitting Innovation.
================================================================================
