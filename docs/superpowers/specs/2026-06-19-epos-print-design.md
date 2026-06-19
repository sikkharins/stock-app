# ePOS-Print direct printing for ใบจัดของ (pick list)

**Date:** 2026-06-19
**Scope:** new `src/utils/eposPrint.ts` + button/config in `DeliveryPlanning.jsx`.

## Problem
Printing 80mm from mobile via Epson TM Print Assistant fails: the app renders
the page as A4 and scales to 80mm (tiny receipt). Browser print can't control
this. Desktop (Epson roll driver) already prints true-size fine.

## Goal
Print the pick list directly to the networked Epson TM-T88VI via ePOS-Print,
bypassing the OS/browser print pipeline entirely. Same result on desktop +
mobile, exact 80mm.

## Approach — raster (image), not text
Epson TM text-mode Thai is unreliable (font/codepage). Render the receipt to a
canvas with the browser (perfect Thai), convert to 1-bit raster, send as
ePOS-Print `<image>`.

### eposPrint.ts
- `drawReceiptCanvas(data)` → `<canvas>` width **576px** (=72mm printable @203dpi),
  height computed from content. Draws: title "ใบจัดของ", date, truck+driver line,
  summary (ชิ้น/รายการ/SO), dashed separators, per row brand + ×qty (large) + cat +
  name (char-wrapped for Thai), footer "พิมพ์ {nowStr}".
- `canvasToMonoRaster(canvas)` → `{ base64, width, height }`. Threshold luminance
  <128 → black bit=1, MSB-first, rows byte-padded.
- `printViaEpos(host, canvas)` → `Promise<{ ok, message }>`. POSTs SOAP+ePOS XML
  (`<image color="color_1" mode="mono">` + `<cut type="feed"/>`) to
  `https://{host}/cgi-bin/epos/service.cgi?devid=local_printer&timeout=10000`,
  Content-Type `text/xml; charset=utf-8`. Parses `<response success=.. code=..>`.
  Maps network failure (CORS/cert/offline) → clear Thai message.

### DeliveryPlanning.jsx
- printer IP in state, persisted to localStorage `v3_epos_printer_ip`
  (default `192.168.1.131`).
- In the ใบจัดของ modal: small IP input + button "พิมพ์เข้าเครื่อง (ePOS)".
  Keep existing browser print button (desktop fallback).
- Show inline result: "พิมพ์สำเร็จ" / error detail.

## Out of scope / printer-side (user sets up; cannot test here)
- Enable ePOS-Print on the device, HTTPS, CORS (`Access-Control-Allow-Origin`).
- Trust the printer's TLS cert on each device (visit https://{ip} once, accept).

## Verification
- typecheck + build green.
- Unit-test canvasToMonoRaster packing + XML envelope shape (no device needed).
- ePOS round-trip: user tests on real TM-T88VI; iterate on reported errors.
