## Decisions

1. **Modular Architecture & Separation of Concerns:**
   - **Decision:** Separated the backend logic (built with Hono on Cloudflare Workers using TypeScript) completely from the frontend interface (built with React, Vite, and TanStack Router).
   - **Why:** This ensures clean code maintainability, allows independent testing of database operations and APIs, and fits natively with Cloudflare D1 (SQLite) bindings.

2. **Strict Integer Arithmetic for Financial Safety:**
   - **Decision:** Handled all currency values strictly in whole cents (integers) rather than floating-point decimals.
   - **Why:** Prevents standard floating-point precision errors during bill splitting and ensures that calculated shares (including handling uneven remainders added one-by-one in member order) always add up accurately to the total amount.

3. **Idempotency & Concurrent Safety Mechanisms:**
   - **Decision:** Implemented header-based idempotency checks (`Idempotency-Key`) for payment routes.
   - **Why:** Prevents duplicate payments from accidental double-submits, ensures safe handling of concurrent requests, and maintains data integrity under race conditions without breaking database constraints.