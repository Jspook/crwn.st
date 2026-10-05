// ==========================================================
// crwn.st Database Seeder
// Populates tables from hardcoded data (MySQL)
// ==========================================================

const bcrypt = require('bcryptjs');

async function seedDatabase() {
  const { run, query } = require('./db');

  // 1. Locations
  const locations = [
    { id: 'LOC-01', zone: 'Zone A', lock: 'Rack 1', shelf: 'Shelf 1', label: 'Main Floor' },
    { id: 'LOC-02', zone: 'Zone A', lock: 'Rack 2', shelf: 'Shelf 2', label: 'Knitwear' },
    { id: 'LOC-03', zone: 'Zone B', lock: 'Rack 1', shelf: 'Shelf 1', label: 'Silk & Dresses' },
    { id: 'LOC-04', zone: 'Zone B', lock: 'Rack 2', shelf: 'Shelf 3', label: 'Outerwear' },
  ];

  for (const loc of locations) {
    await run(
      `INSERT IGNORE INTO LOCATION (LOC_ID, LOC_Zone, LOC_Lock, LOC_Shelf, LOC_Label) VALUES (?, ?, ?, ?, ?)`,
      [loc.id, loc.zone, loc.lock, loc.shelf, loc.label]
    );
  }

  // 2. Employees
  const empPass1 = bcrypt.hashSync('68070254', 10);
  const empPass2 = bcrypt.hashSync('68070056', 10);
  await run(
    `INSERT IGNORE INTO EMPLOYEE (EMP_ID, EMP_FName, EMP_LName, EMP_Tel, EMP_Email, EMP_Pass, EMP_Role) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['68070254', 'แคชเชียร์', '(POS)', '0891234567', 'cashier@crwn.st', empPass1, 'CASHIER']
  );
  await run(
    `INSERT IGNORE INTO EMPLOYEE (EMP_ID, EMP_FName, EMP_LName, EMP_Tel, EMP_Email, EMP_Pass, EMP_Role) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['68070056', 'พนักงาน', 'ห้องลอง', '0891234568', 'fitting@crwn.st', empPass2, 'FITTING_STAFF']
  );

  // 3. Customers
  const cusPass = bcrypt.hashSync('123456', 10);
  await run(
    `INSERT IGNORE INTO CUSTOMER (CUS_ID, CUS_FName, CUS_LName, CUS_Email, CUS_Tel, CUS_Pass) VALUES (?, ?, ?, ?, ?, ?)`,
    ['u1', 'สมชาย', 'ใจดี', 'u1@crwn.st', '0812345678', cusPass]
  );
  await run(
    `INSERT IGNORE INTO CUSTOMER (CUS_ID, CUS_FName, CUS_LName, CUS_Email, CUS_Tel, CUS_Pass) VALUES (?, ?, ?, ?, ?, ?)`,
    ['u2', 'สมหญิง', 'ใจงาม', 'u2@crwn.st', '0899999999', cusPass]
  );

  // --- TRUNCATE OLD PRODUCT DATA ---
  // Disable FK checks to allow truncation
  await run('SET FOREIGN_KEY_CHECKS = 0;');
  await run('TRUNCATE TABLE PAY_CART_ITEM;');
  await run('TRUNCATE TABLE SALE_ORDER_LINE;');
  await run('TRUNCATE TABLE FITTING_ROOM;');
  await run('TRUNCATE TABLE ITEM_VARIANT;');
  await run('TRUNCATE TABLE ITEM;');
  await run('SET FOREIGN_KEY_CHECKS = 1;');
  // ---------------------------------

  // 4. Products (Items)
  const products = [
    {
        "id": "p1",
        "name": "Classic Cotton Crewneck T-Shirt",
        "desc": "เสื้อยืดคอกลมผ้าคอตตอนแท้ 100% สัมผัสนุ่มสบาย สวมใส่ง่าย ระบายอากาศได้ดีเยี่ยม เหมาะสำหรับสวมใส่ในวันสบายๆ หรือใส่เป็นเสื้อตัวในในลุคแคชชวลสุดชิค",
        "price": 690,
        "category": "male",
        "tag": "top"
    },
    {
        "id": "p2",
        "name": "Vintage Wash Graphic T-Shirt",
        "desc": "เสื้อยืดพิมพ์ลายวินเทจ ดีไซน์สุดเท่ ผลิตจากผ้าฝ้ายฟอกนุ่มพิเศษให้ผิวสัมผัสเซอร์ๆ แต่ใส่สบาย ไม่ระคายเคืองผิว เหมาะกับการแมทช์กับยีนส์ตัวโปรด",
        "price": 840,
        "category": "male",
        "tag": "top"
    },
    {
        "id": "p3",
        "name": "Oversized Heavyweight T-Shirt",
        "desc": "เสื้อยืดทรงโอเวอร์ไซส์เนื้อผ้าหนากำลังดี ทรงสวยอยู่ทรงไม่ย้วยง่าย ตัดเย็บอย่างประณีต ช่วยคอมพลีทลุคสตรีทแฟชั่นให้ดูโดดเด่นและทันสมัยในทุกๆ วัน",
        "price": 990,
        "category": "male",
        "tag": "top"
    },
    {
        "id": "p4",
        "name": "Ribbed Slim Fit T-Shirt",
        "desc": "เสื้อยืดทรงเข้ารูปผ้าคอตตอนริบยืดหยุ่นสูง ดีไซน์กระชับสัดส่วนช่วยให้รูปร่างดูเพรียวสวย แมทช์ง่ายกับกางเกงเอวสูงหรือกระโปรงเพื่อลุคสวยมั่นใจ",
        "price": 1140,
        "category": "male",
        "tag": "top"
    },
    {
        "id": "p5",
        "name": "Pocket Detail Basic T-Shirt",
        "desc": "เสื้อยืดเบสิกแต่งกระเป๋าหน้าอกดีไซน์มินิมอล ผลิตจากผ้าฝ้ายเนื้อละเอียด ใส่สบายตลอดวัน สีสันคลาสสิกที่สามารถหยิบมาใส่ได้บ่อยไม่มีเบื่อ",
        "price": 1290,
        "category": "male",
        "tag": "top"
    },
    {
        "id": "p6",
        "name": "Ribbed Long Sleeve Top",
        "desc": "เสื้อแขนยาวผ้าเนื้อร่องยืดหยุ่น นุ่มละมุนผิว สวมใส่สบายในวันที่อากาศเย็นสบาย ดีไซน์เรียบหรูสามารถใส่เดี่ยวๆ หรือใส่สวมทับด้านในก็ดูดีมีสไตล์",
        "price": 690,
        "category": "male",
        "tag": "top"
    },
    {
        "id": "p7",
        "name": "Striped Cotton Long Sleeve",
        "desc": "เสื้อแขนยาวลายทางสไตล์คลาสสิก ผลิตจากผ้าฝ้ายคอตตอนธรรมชาติ ระบายอากาศได้ดีเยี่ยม ตัดเย็บประณีต ให้ลุคกึ่งทางการที่ดูอบอุ่นและเป็นกันเอง",
        "price": 840,
        "category": "female",
        "tag": "top"
    },
    {
        "id": "p8",
        "name": "Thermal Base Layer Long Sleeve",
        "desc": "เสื้อแขนยาวลองจอห์นเก็บความอบอุ่น เนื้อผ้าเบาแนบเนื้อแต่ยืดหยุ่นดีเยี่ยม เหมาะสำหรับใส่เดินทางท่องเที่ยวต่างประเทศหรือวันอากาศหนาวเย็น",
        "price": 990,
        "category": "male",
        "tag": "top"
    },
    {
        "id": "p9",
        "name": "Drop Shoulder Long Sleeve Tee",
        "desc": "เสื้อแขนยาวทรงไหล่ตกสไตล์สตรีทแวร์ เนื้อผ้าคอตตอนเกรดพรีเมียม นุ่มนวล ทรงหลวมสวมใส่สบาย ช่วยเสริมลุคให้ดูเท่และเซอร์อย่างลงตัว",
        "price": 1140,
        "category": "female",
        "tag": "top"
    },
    {
        "id": "p10",
        "name": "Button Placket Long Sleeve Henley",
        "desc": "เสื้อแขนยาวคอเฮนลีย์แต่งกระดุมหน้า ดีไซน์เรียบง่ายแต่มีมิติ ตัดเย็บจากผ้าเนื้อนุ่มที่ให้ความรู้สึกสบายในทุกการเคลื่อนไหว",
        "price": 1290,
        "category": "male",
        "tag": "top"
    },
    {
        "id": "p11",
        "name": "Classic Oxford Cotton Shirt",
        "desc": "เสื้อเชิ้ตผ้าอ็อกฟอร์ดเนื้อหนานุ่ม ทรงคลาสสิกตัดเย็บเนี๊ยบทุกตะเข็บ เหมาะสำหรับใส่ทำงานหรือออกงานทางการที่ต้องการลุคสุภาพและน่าเชื่อถือ",
        "price": 690,
        "category": "female",
        "tag": "top"
    },
    {
        "id": "p12",
        "name": "Relaxed Fit Linen Shirt",
        "desc": "เสื้อเชิ้ตผ้าลินินธรรมชาติ ระบายอากาศได้ดีเยี่ยม ให้ความรู้สึกเย็นสบาย เหมาะสำหรับวันพักผ่อนริมทะเลหรือวันสบายๆ ในเมืองหลวง",
        "price": 840,
        "category": "male",
        "tag": "top"
    },
    {
        "id": "p13",
        "name": "Oversized Poplin Shirt",
        "desc": "เสื้อเชิ้ตผ้าป๊อปปลินเนื้อเนียนเรียบ ทรงโอเวอร์ไซส์สุดอินเทรนด์ สามารถใส่เป็นเสื้อคลุมหรือใส่ผูกเอวเก๋ๆ เพื่อเพิ่มความชิคให้กับลุคประจำวัน",
        "price": 990,
        "category": "female",
        "tag": "top"
    },
    {
        "id": "p14",
        "name": "Denim Utility Shirt",
        "desc": "เสื้อเชิ้ตเดนิมฟอกสีสวยคลาสสิก ดีไซน์กระเป๋าคู่หน้าใช้งานได้จริง เนื้อผ้าทนทาน สวมใส่สบาย ยิ่งซักยิ่งนุ่ม ลุคเท่ๆ ที่ใส่ได้ตลอดกาล",
        "price": 1140,
        "category": "male",
        "tag": "top"
    },
    {
        "id": "p15",
        "name": "Striped Business Formal Shirt",
        "desc": "เสื้อเชิ้ตทำงานลายทางแนวตั้ง ดีไซน์ช่วยอำพรางรูปร่างให้ดูเพรียวสง่า ตัดเย็บจากผ้าเนื้อดีรีดง่าย ยับยาก เหมาะสำหรับนักธุรกิจยุคใหม่",
        "price": 1290,
        "category": "female",
        "tag": "top"
    },
    {
        "id": "p16",
        "name": "Chunky Knit Wool Cardigan",
        "desc": "เสื้อคลุมคาร์ดิแกนไหมพรมถักลายหนานุ่ม ให้ความอบอุ่นได้ดีเยี่ยมในหน้าหนาว ดีไซน์กระดุมหน้าและกระเป๋าใช้งานได้จริง ลุควินเทจสุดอบอุ่น",
        "price": 1990,
        "category": "male",
        "tag": "outerwear"
    },
    {
        "id": "p17",
        "name": "Fleece Zip-Up Jacket",
        "desc": "เสื้อแจ็คเก็ตผ้าฟลีซสัมผัสนุ่มนิ่ม กันหนาวได้ดี น้ำหนักเบาสวมใส่สบาย ซิปหน้าเต็มตัวพร้อมกระเป๋าข้าง เหมาะสำหรับใส่เที่ยวภูเขาหรือห้องแอร์",
        "price": 2290,
        "category": "female",
        "tag": "outerwear"
    },
    {
        "id": "p18",
        "name": "Classic Trench Coat",
        "desc": "เสื้อโค้ทกันหนาวทรงยาวสไตล์คลาสสิก ตัดเย็บจากผ้ากันละอองน้ำเนื้อดี มาพร้อมเข็มขัดคาดเอวช่วยให้ทรงสวยหรูหรา สง่างามทุกมุมมอง",
        "price": 2590,
        "category": "male",
        "tag": "outerwear"
    },
    {
        "id": "p19",
        "name": "Quilted Puffer Vest",
        "desc": "เสื้อกั๊กบุนวมกันหนาว ดีไซน์น้ำหนักเบาคล่องตัว ช่วยรักษาความอบอุ่นบริเวณลำตัวได้อย่างดีเยี่ยม แมทช์กับสเวตเตอร์ตัวโปรดได้อย่างลงตัว",
        "price": 2890,
        "category": "female",
        "tag": "outerwear"
    },
    {
        "id": "p20",
        "name": "Plaid Wool Blend Coat",
        "desc": "เสื้อโค้ทผ้าผสมวูลลายตารางสไตล์อังกฤษ ดีไซน์ปกเสื้อกว้างสุดหรู ให้ความอบอุ่นสูงและยกระดับการแต่งตัวหน้าหนาวให้ดูแพงยิ่งขึ้น",
        "price": 3190,
        "category": "male",
        "tag": "outerwear"
    },
    {
        "id": "p21",
        "name": "Minimalist Crewneck Sweater",
        "desc": "เสื้อสเวตเตอร์คอกลมเนื้อผ้าฟลีซด้านในนุ่มฟู ให้ความอบอุ่นสบาย ดีไซน์เรียบง่ายสีพื้น แมทช์กับกางเกงตัวไหนก็ดูดีในสไตล์มินิมอล",
        "price": 690,
        "category": "female",
        "tag": "top"
    },
    {
        "id": "p22",
        "name": "Cable Knit Wool Sweater",
        "desc": "เสื้อสเวตเตอร์ไหมพรมถักลายเคเบิลนูนสวยคลาสสิก เนื้อผ้าแคชเมียร์ผสมวูลให้สัมผัสอบอุ่นและหรูหรา เหมาะสำหรับวันอากาศหนาวจัด",
        "price": 840,
        "category": "male",
        "tag": "top"
    },
    {
        "id": "p23",
        "name": "V-Neck Ribbed Pullover",
        "desc": "เสื้อสเวตเตอร์คอวีเนื้อผ้าถักร่อง ดีไซน์คอวีช่วยเผยช่วงคอให้ดูเพรียวระหง สามารถใส่เดี่ยวๆ หรือใส่ซ้อนทับเสื้อเชิ้ตด้านในได้ลุคสมาร์ท",
        "price": 990,
        "category": "female",
        "tag": "top"
    },
    {
        "id": "p24",
        "name": "Graphic Printed Sweatshirt",
        "desc": "เสื้อสเวตเตอร์พิมพ์ลายกราฟิกสุดชิค ทรงหลวมสวมใส่สบาย ผลิตจากผ้าฝ้ายผสมโพลีเอสเตอร์เนื้อนุ่ม ไม่ย้วยง่าย ลุคสตรีทที่วัยรุ่นชื่นชอบ",
        "price": 1140,
        "category": "male",
        "tag": "top"
    },
    {
        "id": "p25",
        "name": "Mock Neck Fleece Pullover",
        "desc": "เสื้อสเวตเตอร์คอตั้งเตี้ยซิปสั้น ดีไซน์สปอร์ตทันสมัย ให้ความอบอุ่นบริเวณลำคอ เนื้อผ้าด้านในสำลีนุ่ม สวมใส่สบายตลอดวัน",
        "price": 1290,
        "category": "female",
        "tag": "top"
    },
    {
        "id": "p26",
        "name": "Satin Silk Camisole",
        "desc": "เสื้อสายเดี่ยวผ้าซาตินเนื้อเงางามเนียนนุ่ม สัมผัสเย็นสบายผิว ดีไซน์เรียบหรูสามารถใส่เดี่ยวหรือใส่เป็นตัวในสูทเพื่อลุคเซ็กซี่น่าค้นหา",
        "price": 690,
        "category": "male",
        "tag": "top"
    },
    {
        "id": "p27",
        "name": "Ribbed Cotton Tank Top",
        "desc": "เสื้อสายเดี่ยวผ้าคอตตอนริบยืดหยุ่นกระชับเข้ารูป ดีไซน์สายเดี่ยวเส้นเล็กสไตล์เกาหลี แมทช์ง่ายกับกางเกงยีนส์ขาสั้นหรือขายาว",
        "price": 840,
        "category": "female",
        "tag": "top"
    },
    {
        "id": "p28",
        "name": "Lace Trim Silk Camisole",
        "desc": "เสื้อสายเดี่ยวตกแต่งขอบลูกไม้ลายสวยหวาน เพิ่มความละมุนและเซ็กซี่เบาๆ ตัดเย็บจากผ้าไหมเทียมเนื้อพริ้วไหว สวมใส่สบายไม่อึดอัด",
        "price": 990,
        "category": "male",
        "tag": "top"
    },
    {
        "id": "p29",
        "name": "Cropped Knit Cami",
        "desc": "เสื้อสายเดี่ยวไหมพรมถักโครเชต์สไตล์ซัมเมอร์ ดีไซน์ความยาวระดับเอว เผยลุคสดใส ร่าเริง เหมาะสำหรับใส่ไปเที่ยวทะเลหรือคาเฟ่ชิคๆ",
        "price": 1140,
        "category": "female",
        "tag": "top"
    },
    {
        "id": "p30",
        "name": "Double Strap Minimalist Cami",
        "desc": "เสื้อสายเดี่ยวดีไซน์สายไขว้คู่สุดเก๋ ผ้าโพลีเอสเตอร์ผสมสแปนเดกซ์เนื้อนุ่มทิ้งตัวสวย ไม่ต้องรีดก็สวยเป๊ะได้ตลอดวัน",
        "price": 1290,
        "category": "male",
        "tag": "top"
    },
    {
        "id": "p31",
        "name": "Structured Bandeau Top",
        "desc": "เสื้อเกาะอกทรงโครงเข้ารูปกระชับมั่นใจ ไม่เลื่อนหลุดง่าย ตัดเย็บจากผ้าเนื้อหนาคุณภาพดี ช่วยเน้นสัดส่วนให้ดูสวยงามสะดุดตา",
        "price": 690,
        "category": "female",
        "tag": "top"
    },
    {
        "id": "p32",
        "name": "Ribbed Knit Tube Top",
        "desc": "เสื้อเกาะอกผ้าไหมพรมริบยืดหยุ่นสูง สวมใส่สบายไม่อึดอัด ดีไซน์เรียบง่ายสีพื้น เหมาะสำหรับแมทช์กับเสื้อคลุมเก๋ๆ ในวันพักผ่อน",
        "price": 840,
        "category": "male",
        "tag": "top"
    },
    {
        "id": "p33",
        "name": "Denim Corset Tube Top",
        "desc": "เสื้อเกาะอกเดนิมดีไซน์คอร์เซ็ตเสริมโครง ดันทรงสวยและช่วยเก็บเอวให้ดูคอดกิ่ว ลุคยีนส์สุดแซ่บที่สายแฟชั่นห้ามพลาด",
        "price": 990,
        "category": "female",
        "tag": "top"
    },
    {
        "id": "p34",
        "name": "Pleated Halter Tube Top",
        "desc": "เสื้อเกาะอกจับจีบพลีทเนื้อผ้าพริ้วไหวสวยงาม ดีไซน์เล่นระดับเพิ่มมิติให้ตัวเสื้อ ดูหรูหราและน่าสนใจในยามค่ำคืน",
        "price": 1140,
        "category": "male",
        "tag": "top"
    },
    {
        "id": "p35",
        "name": "Satin Wrap Bandeau",
        "desc": "เสื้อเกาะอกผ้าซาตินไขว้ทับด้านหน้า ดีไซน์เรียบหรูเงางาม เหมาะสำหรับใส่ไปงานปาร์ตี้หรือดินเนอร์สุดพิเศษคู่กับกางเกงขายาวทรงกระบอก",
        "price": 1290,
        "category": "female",
        "tag": "top"
    },
    {
        "id": "p36",
        "name": "Lightweight Linen Cardigan",
        "desc": "เสื้อคลุมคาร์ดิแกนผ้าลินินบางเบา ระบายอากาศดีเยี่ยม เหมาะสำหรับใส่กันแดดหรือใส่คลุมในห้องแอร์เย็นๆ ดีไซน์โปร่งสบาย",
        "price": 1990,
        "category": "male",
        "tag": "outerwear"
    },
    {
        "id": "p37",
        "name": "Chiffon Kimono Cover-Up",
        "desc": "เสื้อคลุมกิโมโนผ้าชีฟองพิมพ์ลายดอกไม้พริ้วไหว สไตล์โบฮีเมียนสุดชิค เหมาะสำหรับใส่คลุมชุดว่ายน้ำไปเที่ยวทะเลหรือใส่เดินชายหาด",
        "price": 2290,
        "category": "female",
        "tag": "outerwear"
    },
    {
        "id": "p38",
        "name": "Oversized Denim Jacket",
        "desc": "เสื้อคลุมแจ็คเก็ตเดนิมทรงโอเวอร์ไซส์สุดคลาสสิก ดีไซน์กระเป๋าหน้าและกระดุมโลหะรมดำ ลุคเท่ๆ ลุยๆ ที่ใส่คลุมทับอะไรก็ดูดี",
        "price": 2590,
        "category": "male",
        "tag": "outerwear"
    },
    {
        "id": "p39",
        "name": "Tailored Casual Blazer",
        "desc": "เสื้อคลุมสูทเบลเซอร์ทรงแคชชวล ตัดเย็บเนี๊ยบแต่สวมใส่สบาย ไม่เป็นทางการจนเกินไป เหมาะสำหรับใส่ทำงานหรือไปประชุมด่วน",
        "price": 2890,
        "category": "female",
        "tag": "outerwear"
    },
    {
        "id": "p40",
        "name": "Cropped Windbreaker Jacket",
        "desc": "เสื้อคลุมแจ็คเก็ตกันลมทรงครอป ดีไซน์สปอร์ตฮู้ดดี้ น้ำหนักเบาพับเก็บง่าย เหมาะสำหรับสาวสายวิ่งหรือสายสตรีทแวร์",
        "price": 3190,
        "category": "male",
        "tag": "outerwear"
    },
    {
        "id": "p41",
        "name": "High-Waist Wide Leg Trousers",
        "desc": "กางเกงขายาวเอวสูงทรงขากว้าง ช่วยอำพรางสะโพกและทำให้ขาดูยาวขึ้น ผลิตจากผ้าโพลีเอสเตอร์ผสมเรยอน ทิ้งตัวสวยและรีดง่าย",
        "price": 990,
        "category": "female",
        "tag": "bottom"
    },
    {
        "id": "p42",
        "name": "Slim Fit Stretch Chinos",
        "desc": "กางเกงขายาวชิโน่ทรงสลิมฟิต เนื้อผ้าคอตตอนทวิลล์ผสมสแปนเดกซ์ ยืดหยุ่นคล่องตัว ทรงสวยเนี้ยบเหมาะกับลุคทำงานและวันหยุด",
        "price": 1140,
        "category": "male",
        "tag": "bottom"
    },
    {
        "id": "p43",
        "name": "Relaxed Fit Denim Jeans",
        "desc": "กางเกงยีนส์ขายาวทรงรีแลกซ์วินเทจ ฟอกสีสวยเป็นธรรมชาติ เนื้อผ้าเดนิมแท้ทนทาน สวมใส่สบายไม่รัดอึดอัด",
        "price": 1290,
        "category": "female",
        "tag": "bottom"
    },
    {
        "id": "p44",
        "name": "Pleated Tailored Slacks",
        "desc": "กางเกงสแล็คขายาวจีบหน้าทรงทางการ ตัดเย็บอย่างประณีตด้วยผ้าสูทเนื้อดี ให้ลุคสุภาพ เรียบร้อย และดูเป็นมืออาชีพ",
        "price": 1440,
        "category": "male",
        "tag": "bottom"
    },
    {
        "id": "p45",
        "name": "Casual Drawstring Jogger Pants",
        "desc": "กางเกงจ็อกเกอร์ขายาวเอวยางยืดผูกเชือก เนื้อผ้าสำลีนุ่มนิ่มใส่สบาย มีกระเป๋าข้างใช้งานสะดวก ลุคสปอร์ตแคชชวลสุดฮิต",
        "price": 1590,
        "category": "female",
        "tag": "bottom"
    },
    {
        "id": "p46",
        "name": "High-Waist Denim Shorts",
        "desc": "กางเกงยีนส์ขาสั้นเอวสูงแต่งชายรุ่ยสไตล์วินเทจ เนื้อผ้าเดนิมหนากำลังดี ใส่สบาย ไม่อึดอัด แมทช์กับเสื้อยืดตัวโปรดง่ายๆ",
        "price": 990,
        "category": "male",
        "tag": "bottom"
    },
    {
        "id": "p47",
        "name": "Linen Beach Shorts",
        "desc": "กางเกงขาสั้นผ้าลินินแท้เอวยางยืดมีเชือกผูก ให้สัมผัสเย็นสบายและระบายอากาศดีเยี่ยม เหมาะสำหรับวันพักผ่อนชายหาดหรือเดินชิล",
        "price": 1140,
        "category": "female",
        "tag": "bottom"
    },
    {
        "id": "p48",
        "name": "Tailored Chic Shorts",
        "desc": "กางเกงขาสั้นทรงสูทตัดเย็บเนี๊ยบ มีจีบหน้าเพิ่มความเก๋ สามารถใส่แมทช์กับเบลเซอร์เข้าชุดกันเพื่อให้ได้ลุคสมาร์ทแคชชวล",
        "price": 1290,
        "category": "male",
        "tag": "bottom"
    },
    {
        "id": "p49",
        "name": "Cotton Lounge Shorts",
        "desc": "กางเกงขาสั้นผ้าคอตตอนเจอร์ซีย์เนื้อนุ่ม ยืดหยุ่นสูง สวมใส่นอนหรือใส่เล่นอยู่บ้านได้อย่างสบายตัวตลอดวัน",
        "price": 1440,
        "category": "female",
        "tag": "bottom"
    },
    {
        "id": "p50",
        "name": "Cargo Utility Shorts",
        "desc": "กางเกงขาสั้นคาร์โก้แต่งกระเป๋าด้านข้างสไตล์ยูทิลิตี้ เนื้อผ้าทนทาน ทรงหลวมใส่สบาย ลุคลุยๆ สตรีทแฟชั่น",
        "price": 1590,
        "category": "male",
        "tag": "bottom"
    },
    {
        "id": "p51",
        "name": "Pleated Tennis Mini Skirt",
        "desc": "กระโปรงเทนนิสสั้นจีบรอบตัวสไตล์เกาหลี ด้านในมีซับในกางเกงมั่นใจทุกการเคลื่อนไหว ทรงสวยช่วยให้ขาดูเรียวยาว",
        "price": 990,
        "category": "female",
        "tag": "skirt"
    },
    {
        "id": "p52",
        "name": "A-Line Denim Mini Skirt",
        "desc": "กระโปรงยีนส์สั้นทรงเอแต่งกระดุมหน้าเรียงยาวสไตล์วินเทจ เนื้อผ้าเดนิมฟอกนุ่ม ทนทาน แมทช์กับเสื้อเชิ้ตหรือเสื้อยืดก็สวย",
        "price": 1140,
        "category": "male",
        "tag": "skirt"
    },
    {
        "id": "p53",
        "name": "High-Waist Wrap Skirt",
        "desc": "กระโปรงสั้นป้ายหน้าผูกโบว์ข้าง ดีไซน์เก๋ไก๋ทันสมัย ตัดเย็บจากผ้าเนื้อพริ้วไหวทิ้งตัวสวย เหมาะกับวันออกเดทหรือคาเฟ่",
        "price": 1290,
        "category": "female",
        "tag": "skirt"
    },
    {
        "id": "p54",
        "name": "Suede Button Skirt",
        "desc": "กระโปรงสั้นผ้าหนังกลับสัมผัสนุ่มมือ ดีไซน์เรียบหรูให้ลุคอบอุ่นช่วงหน้าหนาว แมทช์กับบูทสั้นและเสื้อสเวตเตอร์ได้ลงตัว",
        "price": 1440,
        "category": "male",
        "tag": "skirt"
    },
    {
        "id": "p55",
        "name": "Faux Leather Mini Skirt",
        "desc": "กระโปรงสั้นหนังเทอ PU เงางาม ทรงเข้ารูปกระชับสัดส่วน เพิ่มความเปรี้ยวแซ่บมั่นใจในลุคปาร์ตี้กลางคืน",
        "price": 1590,
        "category": "female",
        "tag": "skirt"
    },
    {
        "id": "p56",
        "name": "Flowy Boho Maxi Skirt",
        "desc": "กระโปรงยาวแม็กซี่สไตล์โบฮีเมียนผ้าชีฟองพิมพ์ลายพริ้วไหว สวมใส่สบายระบายอากาศดีเยี่ยม เดินเหินคล่องตัวในวันหยุดพักผ่อน",
        "price": 990,
        "category": "male",
        "tag": "skirt"
    },
    {
        "id": "p57",
        "name": "Satin Slip Midi Skirt",
        "desc": "กระโปรงยาวปานกลางผ้าซาตินเนื้อเงา ทรงสลิมทิ้งตัวแนบเนื้อสวยหรูหรา ช่วยยกระดับลุคให้ดูแพงและเรียบโก้ในเวลาเดียวกัน",
        "price": 1140,
        "category": "female",
        "tag": "skirt"
    },
    {
        "id": "p58",
        "name": "Tiered Cotton Long Skirt",
        "desc": "กระโปรงยาวผ้าคอตตอนต่อระบายเป็นชั้นๆ สไตล์วินเทจหวานละมุน ขอบเอวยางยืดใส่สบาย ไม่อึดอัด แมทช์กับเสื้อยืดง่ายๆ",
        "price": 1290,
        "category": "male",
        "tag": "skirt"
    },
    {
        "id": "p59",
        "name": "Button-Front Linen Midi Skirt",
        "desc": "กระโปรงยาวผ้าลินินแต่งกระดุมไม้ด้านหน้าตลอดแนว ดีไซน์เรียบง่ายสไตล์มินิมอล ให้ความรู้สึกเป็นธรรมชาติและสดใส",
        "price": 1440,
        "category": "female",
        "tag": "skirt"
    },
    {
        "id": "p60",
        "name": "Knitted Ribbed Long Skirt",
        "desc": "กระโปรงยาวไหมพรมถักร่องผ่าข้างเล็กน้อยเพื่อความสะดวกในการเดิน เนื้อผ้าหนานุ่มให้อุ่นสบายในหน้าหนาว",
        "price": 1590,
        "category": "male",
        "tag": "skirt"
    },
    {
        "id": "p61",
        "name": "Classic Ribbed Crew Socks",
        "desc": "ถุงเท้าข้อกลางผ้าคอตตอนทอริบหนานุ่ม ซับเหงื่อได้ดีเยี่ยม ยืดหยุ่นกระชับข้อเท้า ไม่ย้วยง่าย ใส่เล่นกีฬาหรือใส่กับสนีกเกอร์",
        "price": 390,
        "category": "female",
        "tag": "accessory"
    },
    {
        "id": "p62",
        "name": "Thick Winter Wool Socks",
        "desc": "ถุงเท้ากันหนาวขนแกะหนานุ่มพิเศษ ช่วยเก็บความอบอุ่นให้เท้าในอุณหภูมิติดลบ สวมใส่สบายไม่ระคายเคืองผิว",
        "price": 490,
        "category": "male",
        "tag": "accessory"
    },
    {
        "id": "p63",
        "name": "Minimalist Ankle Socks",
        "desc": "ถุงเท้าข้อสั้นซ่อนขอบผ้าฝ้ายผสมสแปนเดกซ์ ระบายอากาศดีเยี่ยม เหมาะสำหรับใส่กับรองเท้าผ้าใบหรือรองเท้าคัทชูโดยไม่เห็นถุงเท้า",
        "price": 590,
        "category": "female",
        "tag": "accessory"
    },
    {
        "id": "p64",
        "name": "Ruffle Trim Cute Socks",
        "desc": "ถุงเท้าข้อสั้นแต่งระบายลูกไม้ขอบน่ารักสไตล์คุณหนู ผลิตจากผ้าฝ้ายเนื้อละเอียด ใส่แมทช์กับรองเท้าคัทชูหรือรองเท้าแตะแฟชั่น",
        "price": 690,
        "category": "male",
        "tag": "accessory"
    },
    {
        "id": "p65",
        "name": "Athletic Compression Socks",
        "desc": "ถุงเท้ากีฬากระชับกล้ามเนื้อน่อง ช่วยลดความเมื่อยล้าขณะออกกำลังกายหรือเดินนานๆ เนื้อผ้าแห้งไวไม่อับชื้น",
        "price": 790,
        "category": "female",
        "tag": "accessory"
    },
    {
        "id": "p66",
        "name": "Cashmere Feel Winter Scarf",
        "desc": "ผ้าพันคอผ้าแคชเมียร์สังเคราะห์เนื้อนุ่มละมุน ไม่ระคายเคืองผิว ให้ความอบอุ่นดีเยี่ยมในหน้าหนาว ดีไซน์สีพื้นคลาสสิก",
        "price": 390,
        "category": "male",
        "tag": "accessory"
    },
    {
        "id": "p67",
        "name": "Silk Twill Neck Scarf",
        "desc": "ผ้าพันคอผ้าไหมซาตินผืนเล็กพิมพ์ลายกราฟิกหรูหรา สามารถผูกคอ ผูกกระเป๋า หรือคาดผมเพื่อเพิ่มความชิคให้ลุคทำงาน",
        "price": 490,
        "category": "female",
        "tag": "accessory"
    }
];

  for (const p of products) {
    await run(
      `INSERT INTO ITEM (ITM_ID, ITM_Name, ITM_Description, ITM_Price, ITM_Category, ITM_Tag) VALUES (?, ?, ?, ?, ?, ?)`,
      [p.id, p.name, p.desc, p.price, p.category, p.tag]
    );
  }

  // 5. Product Variants (Numeric Barcodes / EAN-13 style)
  const variants = [
    {
        "sku": "8850010140000",
        "itemId": "p1",
        "color": "Black",
        "size": "XL",
        "stock": 21,
        "loc": "LOC-01"
    },
    {
        "sku": "8850010310001",
        "itemId": "p1",
        "color": "Navy",
        "size": "S",
        "stock": 13,
        "loc": "LOC-01"
    },
    {
        "sku": "8850020640002",
        "itemId": "p2",
        "color": "Beige",
        "size": "XL",
        "stock": 20,
        "loc": "LOC-03"
    },
    {
        "sku": "8850020340003",
        "itemId": "p2",
        "color": "Navy",
        "size": "XL",
        "stock": 13,
        "loc": "LOC-03"
    },
    {
        "sku": "8850030220004",
        "itemId": "p3",
        "color": "White",
        "size": "M",
        "stock": 12,
        "loc": "LOC-04"
    },
    {
        "sku": "8850030640005",
        "itemId": "p3",
        "color": "Beige",
        "size": "XL",
        "stock": 21,
        "loc": "LOC-04"
    },
    {
        "sku": "8850040210006",
        "itemId": "p4",
        "color": "White",
        "size": "S",
        "stock": 18,
        "loc": "LOC-02"
    },
    {
        "sku": "8850040420007",
        "itemId": "p4",
        "color": "Grey",
        "size": "M",
        "stock": 4,
        "loc": "LOC-02"
    },
    {
        "sku": "8850050130008",
        "itemId": "p5",
        "color": "Black",
        "size": "L",
        "stock": 28,
        "loc": "LOC-04"
    },
    {
        "sku": "8850050620009",
        "itemId": "p5",
        "color": "Beige",
        "size": "M",
        "stock": 12,
        "loc": "LOC-04"
    },
    {
        "sku": "8850060630010",
        "itemId": "p6",
        "color": "Beige",
        "size": "L",
        "stock": 17,
        "loc": "LOC-03"
    },
    {
        "sku": "8850060130011",
        "itemId": "p6",
        "color": "Black",
        "size": "L",
        "stock": 30,
        "loc": "LOC-01"
    },
    {
        "sku": "8850070520012",
        "itemId": "p7",
        "color": "Cream",
        "size": "M",
        "stock": 13,
        "loc": "LOC-03"
    },
    {
        "sku": "8850070320013",
        "itemId": "p7",
        "color": "Navy",
        "size": "M",
        "stock": 14,
        "loc": "LOC-04"
    },
    {
        "sku": "8850080130014",
        "itemId": "p8",
        "color": "Black",
        "size": "L",
        "stock": 4,
        "loc": "LOC-01"
    },
    {
        "sku": "8850080630015",
        "itemId": "p8",
        "color": "Beige",
        "size": "L",
        "stock": 22,
        "loc": "LOC-04"
    },
    {
        "sku": "8850090430016",
        "itemId": "p9",
        "color": "Grey",
        "size": "L",
        "stock": 25,
        "loc": "LOC-01"
    },
    {
        "sku": "8850090540017",
        "itemId": "p9",
        "color": "Cream",
        "size": "XL",
        "stock": 23,
        "loc": "LOC-03"
    },
    {
        "sku": "8850100210018",
        "itemId": "p10",
        "color": "White",
        "size": "S",
        "stock": 26,
        "loc": "LOC-04"
    },
    {
        "sku": "8850100120019",
        "itemId": "p10",
        "color": "Black",
        "size": "M",
        "stock": 18,
        "loc": "LOC-01"
    },
    {
        "sku": "8850110320020",
        "itemId": "p11",
        "color": "Navy",
        "size": "M",
        "stock": 14,
        "loc": "LOC-01"
    },
    {
        "sku": "8850110540021",
        "itemId": "p11",
        "color": "Cream",
        "size": "XL",
        "stock": 12,
        "loc": "LOC-04"
    },
    {
        "sku": "8850120240022",
        "itemId": "p12",
        "color": "White",
        "size": "XL",
        "stock": 28,
        "loc": "LOC-02"
    },
    {
        "sku": "8850120510023",
        "itemId": "p12",
        "color": "Cream",
        "size": "S",
        "stock": 16,
        "loc": "LOC-03"
    },
    {
        "sku": "8850130140024",
        "itemId": "p13",
        "color": "Black",
        "size": "XL",
        "stock": 2,
        "loc": "LOC-04"
    },
    {
        "sku": "8850130330025",
        "itemId": "p13",
        "color": "Navy",
        "size": "L",
        "stock": 27,
        "loc": "LOC-02"
    },
    {
        "sku": "8850140420026",
        "itemId": "p14",
        "color": "Grey",
        "size": "M",
        "stock": 17,
        "loc": "LOC-02"
    },
    {
        "sku": "8850140620027",
        "itemId": "p14",
        "color": "Beige",
        "size": "M",
        "stock": 28,
        "loc": "LOC-03"
    },
    {
        "sku": "8850150410028",
        "itemId": "p15",
        "color": "Grey",
        "size": "S",
        "stock": 14,
        "loc": "LOC-01"
    },
    {
        "sku": "8850150120029",
        "itemId": "p15",
        "color": "Black",
        "size": "M",
        "stock": 6,
        "loc": "LOC-02"
    },
    {
        "sku": "8850160440030",
        "itemId": "p16",
        "color": "Navy",
        "size": "XL",
        "stock": 11,
        "loc": "LOC-03"
    },
    {
        "sku": "8850160240031",
        "itemId": "p16",
        "color": "Grey",
        "size": "XL",
        "stock": 14,
        "loc": "LOC-04"
    },
    {
        "sku": "8850170540032",
        "itemId": "p17",
        "color": "Khaki",
        "size": "XL",
        "stock": 5,
        "loc": "LOC-02"
    },
    {
        "sku": "8850180110033",
        "itemId": "p18",
        "color": "Black",
        "size": "S",
        "stock": 18,
        "loc": "LOC-04"
    },
    {
        "sku": "8850180540034",
        "itemId": "p18",
        "color": "Khaki",
        "size": "XL",
        "stock": 14,
        "loc": "LOC-02"
    },
    {
        "sku": "8850190110035",
        "itemId": "p19",
        "color": "Black",
        "size": "S",
        "stock": 4,
        "loc": "LOC-02"
    },
    {
        "sku": "8850200430036",
        "itemId": "p20",
        "color": "Navy",
        "size": "L",
        "stock": 18,
        "loc": "LOC-02"
    },
    {
        "sku": "8850200340037",
        "itemId": "p20",
        "color": "Camel",
        "size": "XL",
        "stock": 21,
        "loc": "LOC-03"
    },
    {
        "sku": "8850210630038",
        "itemId": "p21",
        "color": "Beige",
        "size": "L",
        "stock": 13,
        "loc": "LOC-04"
    },
    {
        "sku": "8850220340039",
        "itemId": "p22",
        "color": "Navy",
        "size": "XL",
        "stock": 9,
        "loc": "LOC-04"
    },
    {
        "sku": "8850220110040",
        "itemId": "p22",
        "color": "Black",
        "size": "S",
        "stock": 11,
        "loc": "LOC-01"
    },
    {
        "sku": "8850230630041",
        "itemId": "p23",
        "color": "Beige",
        "size": "L",
        "stock": 26,
        "loc": "LOC-04"
    },
    {
        "sku": "8850240440042",
        "itemId": "p24",
        "color": "Grey",
        "size": "XL",
        "stock": 6,
        "loc": "LOC-04"
    },
    {
        "sku": "8850240330043",
        "itemId": "p24",
        "color": "Navy",
        "size": "L",
        "stock": 11,
        "loc": "LOC-01"
    },
    {
        "sku": "8850250140044",
        "itemId": "p25",
        "color": "Black",
        "size": "XL",
        "stock": 5,
        "loc": "LOC-04"
    },
    {
        "sku": "8850260230045",
        "itemId": "p26",
        "color": "White",
        "size": "L",
        "stock": 3,
        "loc": "LOC-01"
    },
    {
        "sku": "8850260610046",
        "itemId": "p26",
        "color": "Beige",
        "size": "S",
        "stock": 18,
        "loc": "LOC-04"
    },
    {
        "sku": "8850270310047",
        "itemId": "p27",
        "color": "Navy",
        "size": "S",
        "stock": 28,
        "loc": "LOC-03"
    },
    {
        "sku": "8850280530048",
        "itemId": "p28",
        "color": "Cream",
        "size": "L",
        "stock": 25,
        "loc": "LOC-02"
    },
    {
        "sku": "8850280230049",
        "itemId": "p28",
        "color": "White",
        "size": "L",
        "stock": 18,
        "loc": "LOC-03"
    },
    {
        "sku": "8850290330050",
        "itemId": "p29",
        "color": "Navy",
        "size": "L",
        "stock": 12,
        "loc": "LOC-03"
    },
    {
        "sku": "8850300130051",
        "itemId": "p30",
        "color": "Black",
        "size": "L",
        "stock": 16,
        "loc": "LOC-02"
    },
    {
        "sku": "8850300220052",
        "itemId": "p30",
        "color": "White",
        "size": "M",
        "stock": 9,
        "loc": "LOC-03"
    },
    {
        "sku": "8850310240053",
        "itemId": "p31",
        "color": "White",
        "size": "XL",
        "stock": 17,
        "loc": "LOC-04"
    },
    {
        "sku": "8850320230054",
        "itemId": "p32",
        "color": "White",
        "size": "L",
        "stock": 23,
        "loc": "LOC-02"
    },
    {
        "sku": "8850320420055",
        "itemId": "p32",
        "color": "Grey",
        "size": "M",
        "stock": 21,
        "loc": "LOC-02"
    },
    {
        "sku": "8850330630056",
        "itemId": "p33",
        "color": "Beige",
        "size": "L",
        "stock": 11,
        "loc": "LOC-04"
    },
    {
        "sku": "8850340330057",
        "itemId": "p34",
        "color": "Navy",
        "size": "L",
        "stock": 20,
        "loc": "LOC-03"
    },
    {
        "sku": "8850340510058",
        "itemId": "p34",
        "color": "Cream",
        "size": "S",
        "stock": 27,
        "loc": "LOC-04"
    },
    {
        "sku": "8850350540059",
        "itemId": "p35",
        "color": "Cream",
        "size": "XL",
        "stock": 19,
        "loc": "LOC-04"
    },
    {
        "sku": "8850360440060",
        "itemId": "p36",
        "color": "Navy",
        "size": "XL",
        "stock": 25,
        "loc": "LOC-01"
    },
    {
        "sku": "8850360340061",
        "itemId": "p36",
        "color": "Camel",
        "size": "XL",
        "stock": 25,
        "loc": "LOC-02"
    },
    {
        "sku": "8850370330062",
        "itemId": "p37",
        "color": "Camel",
        "size": "L",
        "stock": 13,
        "loc": "LOC-03"
    },
    {
        "sku": "8850380420063",
        "itemId": "p38",
        "color": "Navy",
        "size": "M",
        "stock": 29,
        "loc": "LOC-02"
    },
    {
        "sku": "8850380110064",
        "itemId": "p38",
        "color": "Black",
        "size": "S",
        "stock": 4,
        "loc": "LOC-04"
    },
    {
        "sku": "8850390220065",
        "itemId": "p39",
        "color": "Grey",
        "size": "M",
        "stock": 7,
        "loc": "LOC-01"
    },
    {
        "sku": "8850400540066",
        "itemId": "p40",
        "color": "Khaki",
        "size": "XL",
        "stock": 24,
        "loc": "LOC-03"
    },
    {
        "sku": "8850400410067",
        "itemId": "p40",
        "color": "Navy",
        "size": "S",
        "stock": 14,
        "loc": "LOC-01"
    },
    {
        "sku": "8850410332068",
        "itemId": "p41",
        "color": "DarkGrey",
        "size": "30",
        "stock": 22,
        "loc": "LOC-04"
    },
    {
        "sku": "8850420434069",
        "itemId": "p42",
        "color": "Beige",
        "size": "32",
        "stock": 25,
        "loc": "LOC-01"
    },
    {
        "sku": "8850420334070",
        "itemId": "p42",
        "color": "DarkGrey",
        "size": "32",
        "stock": 26,
        "loc": "LOC-02"
    },
    {
        "sku": "8850430110071",
        "itemId": "p43",
        "color": "Black",
        "size": "S",
        "stock": 25,
        "loc": "LOC-04"
    },
    {
        "sku": "8850440510072",
        "itemId": "p44",
        "color": "Khaki",
        "size": "S",
        "stock": 25,
        "loc": "LOC-03"
    },
    {
        "sku": "8850450134073",
        "itemId": "p45",
        "color": "Black",
        "size": "32",
        "stock": 3,
        "loc": "LOC-01"
    },
    {
        "sku": "8850460510074",
        "itemId": "p46",
        "color": "Khaki",
        "size": "S",
        "stock": 4,
        "loc": "LOC-03"
    },
    {
        "sku": "8850470434075",
        "itemId": "p47",
        "color": "Beige",
        "size": "32",
        "stock": 29,
        "loc": "LOC-01"
    },
    {
        "sku": "8850480310076",
        "itemId": "p48",
        "color": "DarkGrey",
        "size": "S",
        "stock": 21,
        "loc": "LOC-03"
    },
    {
        "sku": "8850490132077",
        "itemId": "p49",
        "color": "Black",
        "size": "30",
        "stock": 26,
        "loc": "LOC-02"
    },
    {
        "sku": "8850500132078",
        "itemId": "p50",
        "color": "Black",
        "size": "30",
        "stock": 3,
        "loc": "LOC-03"
    },
    {
        "sku": "8850510332079",
        "itemId": "p51",
        "color": "Navy",
        "size": "30",
        "stock": 4,
        "loc": "LOC-01"
    },
    {
        "sku": "8850520432080",
        "itemId": "p52",
        "color": "Brown",
        "size": "30",
        "stock": 21,
        "loc": "LOC-03"
    },
    {
        "sku": "8850530232081",
        "itemId": "p53",
        "color": "White",
        "size": "30",
        "stock": 3,
        "loc": "LOC-04"
    },
    {
        "sku": "8850540510082",
        "itemId": "p54",
        "color": "Cream",
        "size": "S",
        "stock": 5,
        "loc": "LOC-03"
    },
    {
        "sku": "8850550232083",
        "itemId": "p55",
        "color": "White",
        "size": "30",
        "stock": 28,
        "loc": "LOC-01"
    },
    {
        "sku": "8850560232084",
        "itemId": "p56",
        "color": "White",
        "size": "30",
        "stock": 7,
        "loc": "LOC-02"
    },
    {
        "sku": "8850570320085",
        "itemId": "p57",
        "color": "Navy",
        "size": "M",
        "stock": 4,
        "loc": "LOC-02"
    },
    {
        "sku": "8850580510086",
        "itemId": "p58",
        "color": "Cream",
        "size": "S",
        "stock": 19,
        "loc": "LOC-03"
    },
    {
        "sku": "8850590134087",
        "itemId": "p59",
        "color": "Black",
        "size": "32",
        "stock": 24,
        "loc": "LOC-03"
    },
    {
        "sku": "8850600520088",
        "itemId": "p60",
        "color": "Cream",
        "size": "M",
        "stock": 5,
        "loc": "LOC-04"
    },
    {
        "sku": "8850610500089",
        "itemId": "p61",
        "color": "Charcoal",
        "size": "OS",
        "stock": 26,
        "loc": "LOC-01"
    },
    {
        "sku": "8850620300090",
        "itemId": "p62",
        "color": "Grey",
        "size": "OS",
        "stock": 3,
        "loc": "LOC-03"
    },
    {
        "sku": "8850630200091",
        "itemId": "p63",
        "color": "White",
        "size": "OS",
        "stock": 25,
        "loc": "LOC-03"
    },
    {
        "sku": "8850640500092",
        "itemId": "p64",
        "color": "Charcoal",
        "size": "OS",
        "stock": 4,
        "loc": "LOC-04"
    },
    {
        "sku": "8850650400093",
        "itemId": "p65",
        "color": "Brown",
        "size": "OS",
        "stock": 2,
        "loc": "LOC-01"
    },
    {
        "sku": "8850660300094",
        "itemId": "p66",
        "color": "Grey",
        "size": "OS",
        "stock": 19,
        "loc": "LOC-02"
    },
    {
        "sku": "8850670400095",
        "itemId": "p67",
        "color": "Brown",
        "size": "OS",
        "stock": 23,
        "loc": "LOC-02"
    }
];

  for (const v of variants) {
    await run(
      `INSERT INTO ITEM_VARIANT (ITV_SKUID, ITM_ID, ITV_Color, ITV_Size, ITV_Stock, LOC_ID) VALUES (?, ?, ?, ?, ?, ?)`,
      [v.sku, v.itemId, v.color, v.size, v.stock, v.loc]
    );
  }

  console.log('🌱 Seed data inserted successfully.');
}

module.exports = { seedDatabase };

if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('✅ Seeding completed.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Seeding failed:', err);
      process.exit(1);
    });
}
