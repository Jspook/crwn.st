# Dev Pipeline `/ship` (แผนงาน)

## ไอเดียหลัก
ทีมพัฒนา 4 บทบาทที่ทำงานต่อกันผ่านโฟลเดอร์ `.pipeline/` และเริ่มด้วยคำสั่ง `/ship`

| บทบาท | หน้าที่ | โมเดลที่แนะนำ | สิทธิ์ |
|---|---|---|---|
| Planner | รับงานจากผู้ใช้ แล้วแปลงเป็น detailed spec | Opus 5.5 (`claude-opus-5-5`) | อ่าน/เขียนใน `.pipeline/` |
| Coder | ทำตามแผนของ Planner ตรงตามที่เขียนไว้ | Sonnet 5.5 (`claude-sonnet-5-5`) | แก้โค้ดได้ |
| Tester | เขียน test case จาก spec และอ่านโค้ดที่ Coder เขียน | Sonnet 5.5 หรือ Haiku 5.5 (`claude-haiku-5-5`) | เขียน test ได้ |
| Reviewer | อ่านการเปลี่ยนแปลงแล้วส่งผลลัพธ์ให้ผู้ใช้ | Opus 5.5 | อ่านอย่างเดียว (เขียนได้เฉพาะ `.pipeline/`) |

## การปรับแก้ที่แนะนำ
1. **Tester อ่าน spec ของ Planner เป็นหลัก** ไม่ควรอ่านโค้ดของ Coder อย่างเดียว ไม่เช่นนั้น test อาจยืนยันพฤติกรรมที่ผิดให้ถูกได้
2. **กำหนดรอบสูงสุดของการวนลูป** เช่น 3 รอบ ถ้า Tester ไม่ผ่านหลังแก้ครบแล้วให้หยุดและถามผู้ใช้
3. **จำกัดสิทธิ์ Reviewer จริง ๆ** ใช้ tools แค่ Read, Grep, Glob และให้เขียนได้เฉพาะ `.pipeline/`
4. **Subagent เรียก subagent ต่อไม่ได้** ดังนั้น `/ship` ต้องรันในเซสชันหลักแล้วเรียกทีละบทบาทตามลำดับ

## โครงสร้างไฟล์ที่เสนอ
```
.claude/agents/planner.md      (model: opus)
.claude/agents/coder.md        (model: sonnet)
.claude/agents/tester.md       (model: sonnet)
.claude/agents/reviewer.md     (model: opus, tools จำกัด)
.claude/commands/ship.md       (ตัวประสานงาน)
.pipeline/<task-id>/
    spec.md
    changes.md
    tests.md
    review.md
    status.json
```
- ใช้โฟลเดอร์ย่อยต่อหนึ่งงาน เพื่อย้อนดูประวัติได้และไม่ทับกันเมื่อรันหลายงาน

## สถานะ
- ยังไม่ได้สร้างไฟล์ใด ๆ ใน repo
- รอการยืนยันว่าจะให้สร้างโครงสร้างนี้ใน `C:\Users\sirav\Code\WorkSpace` หรือใน `crwn.st`
- ยังไม่ได้ตัดสินใจว่า `.pipeline/` จะถูกเก็บใน git หรือไม่

## เกี่ยวข้อง
- ECC มี agents และ skills จำนวนมาก ควรตรวจว่ามี planner, code-reviewer หรือ tdd agent ที่ใช้แทนได้หรือไม่ก่อนเขียนเอง
