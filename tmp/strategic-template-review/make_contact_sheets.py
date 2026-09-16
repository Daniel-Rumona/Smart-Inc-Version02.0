from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).parent
for source in (ROOT / "docx", ROOT / "pdf"):
    pages = sorted(source.glob("page-*.png"))
    thumbs = []
    for index, path in enumerate(pages, 1):
        image = Image.open(path).convert("RGB")
        image.thumbnail((260, 340))
        tile = Image.new("RGB", (280, 375), "white")
        tile.paste(image, ((280 - image.width) // 2, 24))
        ImageDraw.Draw(tile).text((10, 5), f"Page {index}", fill="black")
        thumbs.append(tile)
    for start in range(0, len(thumbs), 12):
        batch = thumbs[start:start + 12]
        sheet = Image.new("RGB", (1120, 1125), "#d9dde3")
        for offset, tile in enumerate(batch):
            sheet.paste(tile, ((offset % 4) * 280, (offset // 4) * 375))
        sheet.save(source / f"contact-{start // 12 + 1}.png")
