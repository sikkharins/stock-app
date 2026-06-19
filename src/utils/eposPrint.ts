// Direct printing to a networked Epson TM printer via ePOS-Print, bypassing the
// OS/browser print pipeline (which mangles 80mm thermal output on mobile).
// Strategy: render the receipt to a canvas (perfect Thai via browser fonts),
// convert to a 1-bit raster, and POST it as an ePOS-Print <image>.

export interface ReceiptRow {
  brand: string;
  catName: string;
  name: string;
  totalQty: number;
}

export interface ReceiptData {
  title: string; // "ใบจัดของ"
  dateStr: string; // "19/06/2569"
  truckLine: string; // "83-8925 · ศักดา"
  summaryLine: string; // "11 ชิ้น · 6 รายการ · 1 SO"
  footer: string; // "พิมพ์ 19/06/2569 15:20"
  rows: ReceiptRow[];
}

const WIDTH = 576; // 72mm printable @ 203dpi
const PAD = 16;
const CW = WIDTH - PAD * 2;
const FONT = "'Sarabun','Tahoma',sans-serif";

const setFont = (ctx: CanvasRenderingContext2D, px: number, bold: boolean) => {
  ctx.font = (bold ? "bold " : "") + px + "px " + FONT;
};

// Char-level wrap (Thai has no word spaces).
const wrapText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number
): string[] => {
  const lines: string[] = [];
  let cur = "";
  for (const ch of Array.from(text)) {
    const test = cur + ch;
    if (cur && ctx.measureText(test).width > maxW) {
      lines.push(cur);
      cur = ch;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
};

// Render the receipt to a monochrome-friendly canvas (black on white).
export const drawReceiptCanvas = (data: ReceiptData): HTMLCanvasElement => {
  const measure = document.createElement("canvas").getContext("2d")!;

  // --- layout pass: compute height ---
  const HDR = 38, SUB = 24, TOT = 26, BRAND = 26, QTY = 46, CAT = 22, NAME = 30, FOOT = 20;
  const SEP_GAP = 14;
  let h = PAD;
  h += HDR + 6;
  h += SUB + 2;
  setFont(measure, SUB, false);
  const truckLines = wrapText(measure, data.truckLine, CW);
  h += truckLines.length * (SUB + 2);
  h += TOT + 8;
  h += SEP_GAP;
  const rowNameLines: string[][] = [];
  for (const r of data.rows) {
    setFont(measure, NAME, true);
    const nl = wrapText(measure, r.name, CW);
    rowNameLines.push(nl);
    h += Math.max(QTY, BRAND) + 4; // brand + qty line
    h += CAT + 2;
    h += nl.length * (NAME + 2);
    h += SEP_GAP;
  }
  h += FOOT + PAD;

  // --- draw pass ---
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = Math.ceil(h);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000";
  ctx.textBaseline = "top";

  const center = (text: string, px: number, bold: boolean, y: number) => {
    setFont(ctx, px, bold);
    ctx.textAlign = "center";
    ctx.fillText(text, WIDTH / 2, y);
  };
  const left = (text: string, px: number, bold: boolean, y: number) => {
    setFont(ctx, px, bold);
    ctx.textAlign = "left";
    ctx.fillText(text, PAD, y);
  };
  const dashed = (y: number) => {
    ctx.save();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(WIDTH - PAD, y);
    ctx.stroke();
    ctx.restore();
  };

  let y = PAD;
  center(data.title, HDR, true, y);
  y += HDR + 6;
  center(data.dateStr, SUB, false, y);
  y += SUB + 2;
  for (const tl of truckLines) {
    center(tl, SUB, false, y);
    y += SUB + 2;
  }
  center(data.summaryLine, TOT, true, y);
  y += TOT + 8;
  dashed(y);
  y += SEP_GAP;

  data.rows.forEach((r, i) => {
    const rowTop = y;
    left(r.brand, BRAND, true, rowTop + (QTY - BRAND) / 2);
    setFont(ctx, QTY, true);
    ctx.textAlign = "right";
    ctx.fillText("×" + r.totalQty, WIDTH - PAD, rowTop);
    y += Math.max(QTY, BRAND) + 4;
    left(r.catName, CAT, false, y);
    y += CAT + 2;
    for (const nl of rowNameLines[i]) {
      left(nl, NAME, true, y);
      y += NAME + 2;
    }
    y += SEP_GAP - 7;
    dashed(y);
    y += 7;
  });

  center(data.footer, FOOT, false, y);
  return canvas;
};

// Pack canvas pixels into a 1-bit raster (1 = black dot), MSB-first, byte-padded
// rows. Returns base64 + dimensions for the ePOS <image> element.
export const canvasToMonoRaster = (
  canvas: HTMLCanvasElement
): { base64: string; width: number; height: number } => {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext("2d")!;
  const { data } = ctx.getImageData(0, 0, w, h);
  const bytesPerRow = Math.ceil(w / 8);
  const out = new Uint8Array(bytesPerRow * h);
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const idx = (yy * w + xx) * 4;
      const a = data[idx + 3];
      // luminance; transparent counts as white
      const lum = a === 0 ? 255 : (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114);
      if (lum < 128) {
        out[yy * bytesPerRow + (xx >> 3)] |= 0x80 >> (xx & 7);
      }
    }
  }
  let bin = "";
  for (let i = 0; i < out.length; i++) bin += String.fromCharCode(out[i]);
  return { base64: btoa(bin), width: w, height: h };
};

const buildEnvelope = (raster: { base64: string; width: number; height: number }): string =>
  '<?xml version="1.0" encoding="utf-8"?>' +
  '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>' +
  '<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">' +
  '<image width="' + raster.width + '" height="' + raster.height + '" ' +
  'color="color_1" mode="mono">' + raster.base64 + "</image>" +
  '<cut type="feed"/>' +
  "</epos-print></s:Body></s:Envelope>";

export interface EposResult {
  ok: boolean;
  message: string;
}

// Send a rendered receipt canvas to the printer at `host` (IP or hostname).
export const printViaEpos = async (
  host: string,
  canvas: HTMLCanvasElement
): Promise<EposResult> => {
  const cleanHost = (host || "").trim();
  if (!cleanHost) return { ok: false, message: "ยังไม่ได้ตั้ง IP เครื่องพิมพ์" };
  const url =
    "https://" + cleanHost + "/cgi-bin/epos/service.cgi?devid=local_printer&timeout=10000";
  const body = buildEnvelope(canvasToMonoRaster(canvas));
  let res: Response;
  try {
    // text/plain keeps this a CORS "simple request" → no preflight OPTIONS, which
    // some ePOS firmwares don't answer. The device parses the SOAP body regardless
    // of the declared content type.
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body,
    });
  } catch {
    return {
      ok: false,
      message:
        "เชื่อมต่อเครื่องพิมพ์ไม่ได้ — เช็ก: trust cert (เปิด https://" +
        cleanHost +
        " ใน Chrome กด Proceed ก่อน), เปิดแอปใน Chrome (ไม่ใช่ PWA), เครื่องเปิด ePOS-Print + HTTPS, อยู่ Wi-Fi เดียวกัน. หมายเหตุ: ถ้าใบ 'ออกมาแล้ว' แต่ขึ้น error นี้ = เครื่องไม่ตอบ CORS แต่พิมพ์สำเร็จ",
    };
  }
  const text = await res.text().catch(() => "");
  const m = text.match(/success="(true|false)"/i);
  if (m && m[1].toLowerCase() === "true") {
    return { ok: true, message: "พิมพ์สำเร็จ" };
  }
  const code = (text.match(/code="([^"]*)"/i) || [])[1] || "";
  return {
    ok: false,
    message:
      "เครื่องพิมพ์ปฏิเสธงาน" +
      (code ? " (code: " + code + ")" : "") +
      (res.ok ? "" : " [HTTP " + res.status + "]"),
  };
};
