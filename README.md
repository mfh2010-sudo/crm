# Sales CRM — HeroTec
## خطوات النشر الكاملة

---

## الخطوة 1 — إنشاء مشروع Supabase

1. افتح **https://supabase.com** وسجّل دخول (مجاني)
2. اضغط **New Project** — اختار اسم مثلاً `sales-crm`
3. بعد إنشاء المشروع، اضغط **SQL Editor** من القائمة الجانبية
4. الصق محتوى ملف `supabase_setup.sql` كاملاً واضغط **Run**
5. روح **Settings → API** وانسخ:
   - `Project URL` → هيبقى شكله: `https://xxxx.supabase.co`
   - `anon public key` → المفتاح الطويل

---

## الخطوة 2 — رفع المشروع على GitHub

```bash
# افتح terminal في فولدر المشروع

git init
git add .
git commit -m "first commit"

# أنشئ repo على github.com باسم: sales-crm
git remote add origin https://github.com/USERNAME/sales-crm.git
git push -u origin main
```

---

## الخطوة 3 — إضافة Supabase credentials كـ GitHub Secrets

1. افتح الـ repo على GitHub
2. اضغط **Settings → Secrets and variables → Actions**
3. اضغط **New repository secret** وأضف:
   - Name: `VITE_SUPABASE_URL` → Value: الـ URL من Supabase
   - Name: `VITE_SUPABASE_ANON_KEY` → Value: الـ anon key

---

## الخطوة 4 — إضافة GitHub Actions للنشر التلقائي

أنشئ الملف: `.github/workflows/deploy.yml`

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install
        run: npm install

      - name: Build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
        run: npm run build

      - name: Deploy
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

---

## الخطوة 5 — تفعيل GitHub Pages

1. في الـ repo: **Settings → Pages**
2. Source: **Deploy from a branch**
3. Branch: **gh-pages** / **(root)**
4. اضغط Save

---

## الخطوة 6 — تأكيد اسم الـ repo في vite.config.js

افتح `vite.config.js` وتأكد إن اسم الـ repo صح:

```js
base: "/sales-crm/",  // غيّره لو الـ repo ليه اسم تاني
```

---

## بعد كده

- كل مرة تعمل `git push` → GitHub Actions هيبني وينشر تلقائياً ✅
- الرابط هيبقى: `https://USERNAME.github.io/sales-crm/`

---

## تشغيل محلي للتطوير

```bash
# أنشئ ملف .env وحط فيه credentials
cp .env.example .env
# عدّل الـ .env بالقيم الحقيقية

npm install
npm run dev
# افتح http://localhost:5173/sales-crm/
```
