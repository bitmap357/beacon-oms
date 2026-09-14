from collections import deque
from PIL import Image

img = Image.open("public/brand/mark-source.png").convert("RGBA")
pix = img.load()
width, height = img.size


def is_bg(pixel):
    red, green, blue, alpha = pixel
    return alpha > 0 and red < 28 and green < 28 and blue < 28


seen = [[False] * height for _ in range(width)]
queue = deque()
for x in range(width):
    queue.append((x, 0))
    queue.append((x, height - 1))
for y in range(height):
    queue.append((0, y))
    queue.append((width - 1, y))

while queue:
    x, y = queue.popleft()
    if x < 0 or y < 0 or x >= width or y >= height or seen[x][y]:
        continue
    seen[x][y] = True
    if not is_bg(pix[x, y]):
        continue
    pix[x, y] = (0, 0, 0, 0)
    queue.append((x + 1, y))
    queue.append((x - 1, y))
    queue.append((x, y + 1))
    queue.append((x, y - 1))

img.save("public/brand/mark.png")
img.save("src/app/icon.png")
print(f"saved {width}x{height}")
