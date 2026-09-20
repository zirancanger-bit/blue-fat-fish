const zlib = require('node:zlib');
function crc32(buf) {
  let crc = 0xffffffff;
  for (const b of buf) {
    crc ^= b;
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, bytes) {
  const t = Buffer.from(type);
  const head = Buffer.alloc(4);
  head.writeUInt32BE(bytes.length);
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(Buffer.concat([t, bytes])));
  return Buffer.concat([head, t, bytes, tail]);
}
function iconPNG(size = 64) {
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const nx = (x + 0.5) / size,
        ny = (y + 0.5) / size;
      const dx = nx - 0.5,
        dy = ny - 0.54;
      const face = (dx / 0.34) ** 2 + (dy / 0.3) ** 2 < 1;
      const earL =
        ny > 0.1 && ny < 0.47 && nx > 0.14 + (ny - 0.1) * 0.13 && nx < 0.16 + (ny - 0.1) * 0.72;
      const earR =
        ny > 0.1 && ny < 0.47 && nx < 0.86 - (ny - 0.1) * 0.13 && nx > 0.84 - (ny - 0.1) * 0.72;
      const star = Math.abs(nx - 0.75) + Math.abs(ny - 0.2) < 0.1;
      let c = face || earL || earR ? [100 + ny * 25, 98 + ny * 37, 225, 255] : [0, 0, 0, 0];
      if (face && ny > 0.47 && ny < 0.67 && Math.abs(dx) < 0.22) c = [224, 236, 255, 255];
      if (
        face &&
        (((nx - 0.37) / 0.035) ** 2 + ((ny - 0.55) / 0.061) ** 2 < 1 ||
          ((nx - 0.63) / 0.035) ** 2 + ((ny - 0.55) / 0.061) ** 2 < 1)
      )
        c = [44, 45, 93, 255];
      if (star) c = [255, 216, 125, 255];
      const i = y * (size * 4 + 1) + 1 + x * 4;
      c.forEach((v, j) => (rows[i + j] = Math.round(v)));
    }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
module.exports = { iconPNG };
