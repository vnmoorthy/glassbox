"""Builds slides/Glassbox-Pitch.pptx and .pdf from rendered slide PNGs (slides/png/slide-XX.png).
Speaker notes come from slides/SCRIPT.md. Run after rendering PNGs with headless Chrome."""
import re, pathlib
from pptx import Presentation
from pptx.util import Inches
from PIL import Image

here = pathlib.Path(__file__).parent
pngs = sorted((here / 'png').glob('slide-*.png'))
script = (here / 'SCRIPT.md').read_text()
notes = {}
for line in script.splitlines():
    m = re.match(r'\| (\d+) \| ([^|]+)\| \*\*(.+?)\*\*[^|]*\|[^|]*\| (.+) \|$', line)
    if m:
        notes[int(m.group(1))] = f"[{m.group(2).strip()}] {m.group(3)}\n\n" + re.sub(r'\*\*|\*', '', m.group(4)).strip('"“” ')

prs = Presentation()
prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)
for i, p in enumerate(pngs, 1):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    s.shapes.add_picture(str(p), 0, 0, width=prs.slide_width, height=prs.slide_height)
    s.notes_slide.notes_text_frame.text = notes.get(i, '')
prs.save(here / 'Glassbox-Pitch.pptx')

imgs = [Image.open(p).convert('RGB') for p in pngs]
imgs[0].save(here / 'Glassbox-Pitch.pdf', save_all=True, append_images=imgs[1:], resolution=150)
print(f'built {len(pngs)} slides, notes for {len(notes)}')
