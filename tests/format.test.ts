import assert from "node:assert/strict";
import { test } from "node:test";
import { statsStartDay } from "../lib/format.ts";

test("las estadísticas incluyen 30 días de calendario de Chile, incluso con cambio de hora", () => {
  assert.equal(statsStartDay(new Date("2026-10-05T03:30:00Z")), "2026-09-06");
  assert.equal(statsStartDay(new Date("2026-10-05T02:30:00Z")), "2026-09-05");
  assert.equal(statsStartDay(new Date("2024-03-01T12:00:00Z")), "2024-02-01");
});
