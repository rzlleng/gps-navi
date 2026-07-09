# GPS Navigator V2

ระบบจัดเก็บรายการงานภาคสนามและนำทาง GPS สำหรับเจ้าหน้าที่องค์กรปกครองส่วนท้องถิ่น
สร้างด้วย HTML5 / CSS3 / Vanilla JavaScript (ES2023) ล้วน — ไม่มี Framework
รองรับ PWA, Offline Shell, Dark Mode และ Safe Area ของ iPhone

---

## 1. โครงสร้างโปรเจกต์

```
gps-navi/
├── index.html
├── style.css
├── app.js
├── api.js
├── manifest.json
├── sw.js
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
├── GoogleAppsScript/
│   └── Code.gs
└── README.md
```

---

## 2. ตั้งค่า Google Sheets + Google Apps Script (Backend)

1. สร้าง Google Sheet ใหม่ 1 ไฟล์
2. เปลี่ยนชื่อแท็บแรกเป็น `Jobs`
3. ใส่หัวตารางในแถวที่ 1 ตามลำดับนี้ **เป๊ะๆ**:

   ```
   id | workType | parcelId | requestNo | fullName | phone | createdDate | status | lat | lon
   ```

   > หากไม่ใส่หัวตารางไว้ก่อน ระบบจะสร้างให้อัตโนมัติเมื่อเรียกใช้ครั้งแรก แต่แนะนำให้สร้างเองเพื่อความชัดเจน

4. เมนู **ส่วนขยาย (Extensions) > Apps Script**
5. ลบโค้ดเริ่มต้นทั้งหมด แล้ววางเนื้อหาไฟล์ `GoogleAppsScript/Code.gs` ลงไปแทน
6. กด **ปรับใช้ (Deploy) > การปรับใช้ใหม่ (New deployment)**
   - ประเภท (Type): **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
7. กด Deploy แล้วอนุญาตสิทธิ์ (Authorize) ตามที่ระบบขอ
8. คัดลอก **Web app URL** ที่ได้ (รูปแบบ `https://script.google.com/macros/s/XXXXXXXX/exec`)

### เชื่อม Frontend เข้ากับ Backend

เปิดไฟล์ `api.js` แล้วแก้ค่า:

```js
DEFAULT_API_URL: 'https://script.google.com/macros/s/REPLACE_WITH_YOUR_DEPLOYMENT_ID/exec',
```

เป็น URL ที่คัดลอกมาจากขั้นตอนที่ 8

> ทางเลือก: ไม่ต้องแก้ไฟล์ก็ได้ โดยเปิด Console ของเบราว์เซอร์แล้วรัน
> `Api.setApiUrl('https://script.google.com/macros/s/XXXX/exec')`
> ค่าจะถูกจำไว้ใน localStorage ของเบราว์เซอร์นั้น

---

## 3. ทำไม Backend ใช้ POST + action แทน PUT/DELETE จริง

Google Apps Script Web App รองรับเฉพาะ `doGet(e)` และ `doPost(e)` เท่านั้น
ไม่มีการ route ตาม HTTP verb PUT/DELETE โดยตรง ดังนั้นระบบนี้จึงออกแบบให้:

- **GET** `?action=list` → ดึงรายการงานทั้งหมด
- **POST** พร้อม body เป็น JSON ที่มี field `action`:
  - `action: "create"` → เพิ่มงานใหม่
  - `action: "update"` → แก้ไขงาน
  - `action: "updateStatus"` → เปลี่ยนสถานะอย่างเดียว (ใช้จากปุ่มในการ์ด)
  - `action: "delete"` → ลบงาน

Request POST จาก `api.js` จะส่ง header `Content-Type: text/plain` (แทน
`application/json`) โดยตั้งใจ เพื่อให้ browser เห็นเป็น "simple request" และ
**ไม่เกิด CORS preflight (OPTIONS)** ซึ่ง Apps Script Web App ไม่รองรับ
ฝั่งเซิร์ฟเวอร์ (`Code.gs`) จะ `JSON.parse(e.postData.contents)` เอาเองอยู่แล้ว
จึงยังคงได้ JSON payload ตามปกติ

---

## 4. Deploy บน GitHub Pages

1. สร้าง Repository ใหม่บน GitHub
2. อัปโหลดไฟล์ทั้งหมดในโฟลเดอร์ `gps-navi/` (ยกเว้นโฟลเดอร์ `GoogleAppsScript/`
   ซึ่งใช้แค่สำหรับอ้างอิง ไม่ต้อง deploy ขึ้นเว็บ) ไปไว้ที่ root ของ repo
   หรือโฟลเดอร์ `/docs`
3. ไปที่ **Settings > Pages**
4. เลือก Branch และโฟลเดอร์ที่ใช้ deploy (เช่น `main` / root)
5. รอสักครู่ ระบบจะให้ URL เช่น `https://<username>.github.io/<repo>/`
6. เปิด URL นั้นบนมือถือ แล้วเลือก "เพิ่มลงหน้าจอโฮม" (Add to Home Screen)
   เพื่อใช้งานแบบแอป PWA

---

## 5. การใช้งาน

| ฟีเจอร์ | วิธีใช้ |
|---|---|
| เพิ่มงาน | กดปุ่ม `+ เพิ่มงาน` มุมขวาล่าง (มือถือ) หรือมุมขวาบน (เดสก์ท็อป) |
| ใช้ตำแหน่งปัจจุบัน | ในฟอร์มเพิ่ม/แก้ไขงาน กดปุ่ม "ใช้ตำแหน่งปัจจุบัน" เพื่อดึงพิกัด GPS จากอุปกรณ์ |
| แก้ไขงาน | กดปุ่ม "แก้ไข" บนการ์ด |
| เปลี่ยนสถานะเร็ว | เลือกสถานะใหม่จาก dropdown บนการ์ดได้ทันที ไม่ต้องเปิดฟอร์ม |
| ลบงาน | กดปุ่ม "ลบ" แล้วยืนยันในหน้าต่างถัดไป |
| นำทาง | กดปุ่ม "🚗 นำทาง" เพื่อเปิด Google Maps ไปยังพิกัดของงานนั้น |
| ค้นหา/กรอง | ใช้ช่องค้นหาด้านบน หรือ dropdown กรองประเภทงาน/สถานะ |
| โหมดกลางคืน | กดไอคอนพระอาทิตย์/พระจันทร์มุมขวาบน (จำค่าไว้อัตโนมัติ) |
| ใช้งานออฟไลน์ | เปิดแอปได้แม้ไม่มีเน็ต โดยแสดงข้อมูลชุดล่าสุดที่เคยโหลดสำเร็จ (อ่านอย่างเดียว
จนกว่าจะกลับมาออนไลน์) |

---

## 6. ข้อจำกัดที่ควรทราบ

- Google Maps ("🚗 นำทาง") ต้องใช้อินเทอร์เน็ต หรือแผนที่ออฟไลน์ที่ดาวน์โหลดไว้ล่วงหน้าในแอป Google Maps เอง
- Service Worker แคชเฉพาะ App Shell (HTML/CSS/JS/ไอคอน) เท่านั้น ข้อมูลงานจริง
  ดึงจาก Google Sheets ทุกครั้งที่ออนไลน์ และสำรองด้วย localStorage เมื่อออฟไลน์
- Google Apps Script มี Quota การเรียกใช้งานต่อวันตามนโยบายของ Google Workspace/บัญชี
  หากมีผู้ใช้งานพร้อมกันจำนวนมาก ควรพิจารณาย้ายไปใช้ฐานข้อมูลอื่นที่รองรับ
  ปริมาณการเรียกใช้สูงกว่าในระยะยาว
