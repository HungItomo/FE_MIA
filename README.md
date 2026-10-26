# MIA Milk Tracker — Frontend

React + Vite interface for recording and reviewing the baby's daily milk intake.

Giao diện có 3 tab mobile-first: bé uống sữa, mẹ hút sữa và giấc ngủ của con.

## Chạy local

```bash
npm install
npm run dev
```

Frontend chạy tại `http://localhost:3000` và gọi backend ở `http://localhost:4002/api`.

Nếu backend chạy ở nơi khác, tạo `FE_MIA/.env`:

```bash
VITE_API_URL=http://localhost:4002/api
```
