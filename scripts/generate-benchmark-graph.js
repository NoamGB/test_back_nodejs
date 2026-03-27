const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const inputCsv = process.env.BENCHMARK_CURVE_FILE || 'benchmark-curve.csv';
const outputPng = process.env.BENCHMARK_CURVE_PNG || 'benchmark-curve.png';
const width = 1280;
const height = 720;
const margin = { top: 40, right: 40, bottom: 70, left: 90 };

const readCsv = (csvPath) => {
  const raw = fs.readFileSync(csvPath, 'utf-8').trim();
  const [headerLine, ...lines] = raw.split('\n');
  const headers = headerLine.split(',');
  return lines
    .filter(Boolean)
    .map((line) => {
      const values = line.split(',');
      const row = {};
      headers.forEach((h, i) => {
        row[h] = values[i];
      });
      return {
        elapsedSeconds: Number(row.elapsedSeconds || 0),
        documentsPerSecond:
          Number(row.completed || 0) / Math.max(0.0001, Number(row.elapsedSeconds || 1)),
        cpuPercent: Number(row.cpuPercent || 0),
        memoryRssMb: Number(row.memoryRssMb || 0)
      };
    });
};

const setPixel = (png, x, y, r, g, b, a = 255) => {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const idx = (png.width * y + x) << 2;
  png.data[idx] = r;
  png.data[idx + 1] = g;
  png.data[idx + 2] = b;
  png.data[idx + 3] = a;
};

const drawLine = (png, x1, y1, x2, y2, color) => {
  let dx = Math.abs(x2 - x1);
  let dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;
  let err = dx - dy;
  let x = x1;
  let y = y1;

  while (true) {
    setPixel(png, x, y, color[0], color[1], color[2]);
    if (x === x2 && y === y2) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
};

const drawAxes = (png) => {
  const left = margin.left;
  const right = width - margin.right;
  const top = margin.top;
  const bottom = height - margin.bottom;
  drawLine(png, left, top, left, bottom, [200, 200, 200]);
  drawLine(png, left, bottom, right, bottom, [200, 200, 200]);
};

const drawSeries = (png, points, maxX, maxY, color) => {
  const left = margin.left;
  const right = width - margin.right;
  const top = margin.top;
  const bottom = height - margin.bottom;
  const plotW = right - left;
  const plotH = bottom - top;

  for (let i = 1; i < points.length; i++) {
    const p1 = points[i - 1];
    const p2 = points[i];
    const x1 = Math.round(left + (p1.x / Math.max(maxX, 1)) * plotW);
    const y1 = Math.round(bottom - (p1.y / Math.max(maxY, 1)) * plotH);
    const x2 = Math.round(left + (p2.x / Math.max(maxX, 1)) * plotW);
    const y2 = Math.round(bottom - (p2.y / Math.max(maxY, 1)) * plotH);
    drawLine(png, x1, y1, x2, y2, color);
  }
};

const main = () => {
  const csvPath = path.resolve(process.cwd(), inputCsv);
  const outPath = path.resolve(process.cwd(), outputPng);
  const rows = readCsv(csvPath);
  if (!rows.length) {
    throw new Error('No rows in benchmark CSV.');
  }

  const png = new PNG({ width, height });
  png.data.fill(16);

  drawAxes(png);

  const maxX = Math.max(...rows.map((r) => r.elapsedSeconds), 1);
  const maxY = Math.max(
    ...rows.map((r) => Math.max(r.documentsPerSecond, r.cpuPercent, r.memoryRssMb)),
    1
  );

  drawSeries(
    png,
    rows.map((r) => ({ x: r.elapsedSeconds, y: r.documentsPerSecond })),
    maxX,
    maxY,
    [66, 165, 245]
  );
  drawSeries(
    png,
    rows.map((r) => ({ x: r.elapsedSeconds, y: r.cpuPercent })),
    maxX,
    maxY,
    [239, 83, 80]
  );
  drawSeries(
    png,
    rows.map((r) => ({ x: r.elapsedSeconds, y: r.memoryRssMb })),
    maxX,
    maxY,
    [102, 187, 106]
  );

  png.pack().pipe(fs.createWriteStream(outPath));
  console.log(`Graph written to ${outPath}`);
};

main();
