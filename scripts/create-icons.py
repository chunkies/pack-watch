#!/usr/bin/env python3
"""Generate PackWatch PNG icons using pure Python (no dependencies)."""

import struct, zlib, os

def make_png(size, rgb):
    r, g, b = rgb

    def chunk(name, data):
        body = name + data
        return struct.pack('>I', len(data)) + body + struct.pack('>I', zlib.crc32(body) & 0xffffffff)

    ihdr = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)

    # Build raw pixel rows: filter byte (0=None) + RGB * size
    rows = b''
    for _ in range(size):
        rows += b'\x00' + bytes([r, g, b] * size)

    return (
        b'\x89PNG\r\n\x1a\n' +
        chunk(b'IHDR', ihdr) +
        chunk(b'IDAT', zlib.compress(rows, 9)) +
        chunk(b'IEND', b'')
    )

os.makedirs('icons', exist_ok=True)

# PackWatch violet
color = (124, 58, 237)

for size in [16, 48, 128]:
    path = f'icons/icon{size}.png'
    with open(path, 'wb') as f:
        f.write(make_png(size, color))
    print(f'  Created {path}')

print('Done.')
