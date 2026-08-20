---
paths:
  - "core/modules/**/*"
  - "core/common/**/*"
  - "server/**/*"
  - "shared/contracts/**/*"
---

**Invariant:** write the failing test **before** changing API or core behavior. The test lives in the nearest `__tests__/` folder or in `tests/server/`. Never delete or disable a test without explicit user request.
