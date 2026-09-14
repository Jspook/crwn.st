# รายงานสาเหตุปัญหา (Root Cause Analysis)

## 1. สถานะห้องลองฝั่งลูกค้าและพนักงานห้องลองไม่ตรงกัน และเด้งไปมา
- **สาเหตุ:** ในไฟล์ `views/staff/fitting.ejs` ฝั่งหน้าจอพนักงาน มีการใช้ `setInterval(() => refreshAllFittingData(), 4000);` เพื่อดึงข้อมูลสถานะและรายการคำขอทุกๆ 4 วินาที แต่การเปรียบเทียบข้อมูลที่เปลี่ยนไปนั้นทำโดยสร้าง signature `roomSig` จากข้อมูลดิบ ซึ่งอาจมีการเปลี่ยนค่าของ occupancy status หรือ `occupantName` เมื่อมีการสร้าง session ใหม่ แต่ API ดึงข้อมูลจากฐานข้อมูลโดยบางครั้งไม่สัมพันธ์กับ action ลูกค้า (เช่น การ release room หรือเข้าห้อง) ใน `routes/api.js` อาจไม่มีการ update status ฐานข้อมูลให้ตรงกัน ทำให้พนักงานมองเห็นข้อมูลห้องมีการเด้งไปมาระหว่างว่างและไม่ว่าง และสถานะขัดแย้งกับหน้าห้องของลูกค้า
- **การแก้ไขที่แนะนำ:** ตรวจสอบกระบวนการใน `POST /api/fitting-sessions` และ `POST /api/fitting-rooms/:num/release` ว่าฐานข้อมูล `FITTING_ROOM` ได้อัปเดต `FTR_Status` อย่างถูกต้อง และพิจารณาลดหรือปรับการทำงานของ `setInterval` หรือใช้ WebSockets สำหรับการ push status

## 2. ออเดอร์ของพนักงานหายไปเมื่อกดรับ และสถานะเด้งกลับมารอรับ
- **สาเหตุ:** ในหน้า `views/staff/fitting.ejs` มีการใช้งาน **Optimistic UI Update** ในฟังก์ชัน `updateOrderStatus` คือการที่ UI ปรับสถานะจาก `pending` -> `preparing` แบบทันทีเพื่อ response time ที่ 0ms โดยเปลี่ยนแปลง data ในตัวแปร `currentKanbanOrders` ชั่วคราว ก่อนที่จะยิง API (`PATCH /api/fitting-orders/:id`) ไปเซิร์ฟเวอร์
- เมื่อมีการใช้ `setInterval` ควบคู่ไปด้วย หากเซิร์ฟเวอร์อัปเดตช้าหรือ API ล้มเหลว/ทำงานซ้อนกัน ข้อมูลจากการดึงด้วย `loadFittingOrders()` ใน interval ต่อไป (ทุก 4 วิ) จะดึงข้อมูล state เก่าจาก DB กลับมาทับตัวแปรทำให้เห็นเป็นของเก่า (เช่น กลับไปเป็น Pending) และบางครั้งทำให้เกิด Race condition ทำให้บางออเดอร์ตกหล่นหายไปจาก Kanban หรือเด้งกลับไปมา
- **การแก้ไขที่แนะนำ:** จัดการกับ Optimistic update ให้สมบูรณ์ขึ้น หรือยกเลิก optimistic update ชั่วคราว และให้แสดงตัวโหลดจนกว่า API `PATCH` จะสำเร็จ แล้วจึงดึงของใหม่มา หรือใช้ mutex lock เพื่อหยุด polling ขณะที่มี action กำลังทำงานอยู่

## 3. ปัญหาการเปิดกล้องผ่าน Vercel และขึ้นว่าไม่สามารถเข้าถึงได้
- **สาเหตุ:** การเรียกใช้ API ผ่าน Web browser (`navigator.mediaDevices.getUserMedia()`) เพื่อเข้าถึงกล้องและ scan บาร์โค้ด จะต้องการให้หน้าเว็บเสิร์ฟผ่านช่องทางที่มีความปลอดภัยและอาจต้องได้รับอนุญาตผ่าน `Permissions-Policy` อย่างชัดเจนในบาง browser/environment เมื่อนำไปวางใน Vercel ตัว Web environment หรือ iFrame (ถ้ามี) อาจจะไม่ยอมรับ permission การเข้าถึงกล้องเนื่องจากนโยบายด้านความปลอดภัย
- **การแก้ไขที่แนะนำ:** ในไฟล์ `vercel.json` หรือ `server.js` (Express headers) ต้องระบุ HTTP header เพื่อเพิ่ม `Permissions-Policy` เข้าไป ตัวอย่างเช่น การตั้งค่า `camera=*` หรือกำหนด URL ปลายทางที่แน่นอน เพื่ออนุญาตให้ web app มีสิทธิ์เรียกกล้องได้สำเร็จบน environment ของ Vercel
