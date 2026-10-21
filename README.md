# under the same sky

เว็บโปรไฟล์ Discord 2 คน ธีมฟ้าเข้ม: หน้า click to enter, พื้นหลังน้ำเงินเกือบดำพร้อมลายโค้ดจาง ๆ, กล่องกระจกใส, สถานะ Discord, เอฟเฟกต์ตัวอักษร a–z ตก และแถบปรับเสียง 0–100% (เริ่มที่ 50%) รองรับมือถือและ reduced motion

## รันในเครื่อง (Windows)

ดับเบิลคลิก `start.bat` แล้วเปิด http://127.0.0.1:8000 หรือรัน:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe app.py
```

หยุดเซิร์ฟเวอร์ด้วย Ctrl+C ไม่ต้องใช้ Node.js

เมื่อแก้ HTML, CSS, JavaScript หรือ `config.json` ให้บันทึกไฟล์แล้วรีเฟรชเว็บเพื่อดูผลได้เลย การรันในเครื่องตรวจเทมเพลตใหม่ทุกครั้งและปิดแคชหน้าเว็บ หากแก้ `app.py` ให้หยุดเซิร์ฟเวอร์แล้วเปิดใหม่ การตั้งค่าโหลดเทมเพลตและปิดแคชนี้ใช้เฉพาะในเครื่อง ไม่ใช้บน Vercel

## เชื่อม Discord ของจริง

ตั้ง ID ของทั้งสองคนให้แล้วใน `config.json`:

- `617690449049681920`
- `348498296836456450`

เลือกได้ 2 วิธี:

1. **ไม่ใช้ Token:** ให้เจ้าของบัญชีทั้งสองเข้าร่วม [Lanyard Discord](https://discord.gg/UrXF2cfJ7F) เว็บจะดึงชื่อ รูป สถานะ และกิจกรรมอัตโนมัติ อัปเดตทุก 30 วินาที รายละเอียด: https://github.com/Phineas/lanyard
2. **ใช้ Bot Token:** คัดลอก `.env.example` เป็น `.env` แล้วใส่ `DISCORD_BOT_TOKEN` จาก [Discord Developer Portal](https://discord.com/developers/applications) และรีสตาร์ตเซิร์ฟเวอร์ วิธีนี้ดึงชื่อและรูปผ่าน Discord API ได้ แต่สถานะออนไลน์จะไม่แสดงถ้าไม่มี Lanyard ใช้เฉพาะ **Bot Token**; เก็บใน `.env` ฝั่งเซิร์ฟเวอร์ ไม่ใส่ใน config.json หรือ JavaScript

ถ้ายังดึงข้อมูลไม่ได้ จะแสดง Profile 01 / Profile 02 และภาพดาว/ดวงจันทร์เป็น placeholder ไม่ใช่ชื่อและรูปจริงของผู้ใช้

## ปรับแต่ง

แก้ `config.json` แล้วรีเฟรชหน้า:

- `title`, `subtitle`: ข้อความด้านบน
- `discord_server_url`: ลิงก์เชิญเซิร์ฟเวอร์ Discord สำหรับปุ่ม Join our Discord ใต้ข้อความปิดท้าย ใช้ URL ที่ขึ้นต้นด้วย `https://` ถ้าเว้นว่างปุ่มจะยังไม่เปิดใช้งาน
- `tab_title` (ไม่จำเป็น): ชื่อบนแท็บเว็บสำหรับเอฟเฟกต์พิมพ์–ลบ โดยเติม `@` ให้อัตโนมัติ ถ้าไม่ตั้งจะใช้ `title` เช่น `@Shynx Team` ผู้ใช้ที่เปิด reduced motion จะเห็นชื่อเต็มแบบคงที่
- `quote`: ข้อความในกล่องของแต่ละคน
- `display_name`: ชื่อที่แสดงบนหน้าเว็บของแต่ละคน ตั้งในแต่ละรายการของ `profiles` เช่น `"display_name": "Haruka"` ถ้าเว้นว่าง `""` หรือใส่แต่ช่องว่าง จะใช้ชื่อจาก Discord ตามเดิม เมื่อ Discord เชื่อมต่อไม่ได้และไม่มีชื่อที่ตั้งเองจะใช้ `fallback_name` ชื่อบัญชี `@username` ในกล่อง Discord ยังคงใช้ข้อมูลจริง
- `links`: URL Instagram, TikTok, YouTube ของแต่ละคน (ใช้ https://); ช่องว่างจะซ่อนปุ่ม มีปุ่ม Discord ใช้ได้แล้ว
- `music_url`: ใช้ `/assets/music.mp3` หลังวางเพลงที่คุณมีสิทธิ์ใช้ใน `public/assets/` หรือใช้ URL เสียงโดยตรง ถ้าเว้นว่างจะใช้เสียง ambient สังเคราะห์ในเบราว์เซอร์ เสียงเริ่มหลังคลิกเข้าเว็บ
- ลายโค้ดพื้นหลัง: `public/assets/code-pattern.svg` (เป็นภาพตกแต่ง ไม่ใช่โค้ดที่รันจริง)
- สีพื้นหลังและความจางของลายโค้ด: `.landscape` และ `.landscape::before` ใน `public/style.css`
- CSS: `public/style.css`

รูปและชื่อเริ่มต้นใช้ข้อมูลจาก Discord โดยตั้งชื่อที่แสดงบนเว็บเองผ่าน `display_name` ได้; quote และลิงก์โซเชียลตั้งเอง ระบบไม่ดึง bio ส่วนตัวของ Discord

แถบเสียงมุมซ้ายบนปรับได้ด้วยการลาก แตะ หรือปุ่มลูกศรบนคีย์บอร์ด กดลำโพงเพื่อปิดเสียงโดยเก็บระดับเดิมไว้ ลากไปที่ 0 เพื่อปิดเสียง และกดลำโพงอีกครั้งเพื่อกลับระดับก่อนหน้า ทุกครั้งที่เปิดหน้าใหม่จะเริ่มที่ 50%

บนคอม ปุ่มเสียงเริ่มเป็นไอคอนลำโพง แล้วขยายและเฟดแถบเสียงเมื่อเอาเมาส์ชี้หรือใช้คีย์บอร์ดโฟกัสปุ่ม เมื่อออกจากปุ่มจะย่อกลับ บนจอสัมผัสแสดงแถบเสียงไว้เสมอเพื่อให้ปรับได้ง่าย

## ลง Vercel ภายหลัง

โปรเจกต์ใช้ Flask entrypoint `app.py` และ public assets อยู่ใน `public/` ตาม [เอกสาร Flask on Vercel](https://vercel.com/docs/frameworks/backend/flask)

1. อัปโหลด source ไป GitHub โดยไม่อัปโหลด `.env` หรือ `.venv` (มี `.gitignore` ให้แล้ว)
2. Import repository ใน Vercel ให้ตรวจจับ Flask อัตโนมัติ ไม่ต้องตั้ง Build Command / Output Directory
3. ถ้าใช้ Bot Token ให้ตั้ง `DISCORD_BOT_TOKEN` ใน Vercel Environment Variables แล้ว Deploy

การรัน `python app.py` ใช้ทดสอบในเครื่อง ยังไม่ได้ deploy จริงและยังไม่ได้ทดสอบบน Vercel

## ตรวจสอบระบบ

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

ครอบคลุมการดึงข้อมูล การใช้แคช Bot fallback ข้อมูลเก่าเมื่อ API ล่ม และการป้องกันไฟล์ส่วนตัว

## เครดิต

ภาพดอกกุหลาบ: [Tetiana Bovanenko / Unsplash](https://unsplash.com/photos/a-group-of-pink-flowers-TYjQMLm69JY)
ฟอนต์ DM Sans และ Manrope จาก Google Fonts (มี sans-serif สำรอง)
ภาพ placeholder และเสียง ambient สร้างขึ้นสำหรับโปรเจกต์นี้
