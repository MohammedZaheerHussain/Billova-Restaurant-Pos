---
description: Start DFC POS Pro application (frontend + backend)
---

# Starting DFC POS Pro

// turbo-all

## Quick Start (Run Both at Once)

1. Open a terminal in the project root folder:
```
cd c:\Users\moham\OneDrive\Desktop\DFCPOS
```

2. Start the API backend:
```
cd packages/api && npm run dev
```

3. Open a NEW terminal and start the web frontend:
```
cd apps/web && npm run dev
```

4. Open browser to: http://localhost:5173

## Login Credentials
- **Email:** owner@dfc.com
- **Password:** admin123

## Features Working
- ✅ POS with menu, cart, and checkout
- ✅ Order notes (Parcel/Dine In)
- ✅ Online orders with Swiggy/Zomato selection
- ✅ Orders page with action icons (Complete/Cancel/Edit)
- ✅ In-modal item addition for editing orders
- ✅ Reports and analytics

## If Something Doesn't Work
1. Make sure database is running
2. Check `packages/database/.env` has correct DB credentials
3. Run `npm install` in root folder if packages are missing
