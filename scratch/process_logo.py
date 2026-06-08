import os
from PIL import Image, ImageChops

# Path of the generated logo image
img_path = "/Users/thinguyen/.gemini/antigravity-ide/brain/546aa6cf-ccab-4856-81bd-010ec587fb1a/lc_network_monogram_logo_1780806430399.png"
dest_dir = "/Users/thinguyen/năm3 kì 2/pbl5/src/main/resources/static/images"
dest_path = os.path.join(dest_dir, "logo.png")

# Create destination directory if not exists
os.makedirs(dest_dir, exist_ok=True)

# Open image
img = Image.open(img_path).convert("RGBA")

# Bounding box of the emblem (approximate based on standard layout)
# Let's crop only the circular emblem (excluding the text below)
# Dimensions of generated image are 1024x1024
# The circle is roughly between y=100 and y=750, x=200 and x=850
# Let's crop a box centered at the circular emblem
width, height = img.size

# We can find the emblem by scanning the image from top to bottom
# Let's look for dark or colored pixels (where R < 240, G < 240, B < 240)
# to find the exact boundaries of the emblem.
left = width
top = height
right = 0
bottom = 0

for x in range(width):
    for y in range(height):
        r, g, b, a = img.getpixel((x, y))
        # If not close to white (allow some tolerance)
        if r < 245 or g < 245 or b < 245:
            # But we only want the circular emblem, which is in the upper part (y < 730)
            if y < 730:
                if x < left: left = x
                if y < top: top = y
                if x > right: right = x
                if y > bottom: bottom = y

# Add padding
padding = 15
left = max(0, left - padding)
top = max(0, top - padding)
right = min(width, right + padding)
bottom = min(height, bottom + padding)

print(f"Detected emblem bounds: left={left}, top={top}, right={right}, bottom={bottom}")

# Crop the emblem
emblem = img.crop((left, top, right, bottom))

# Convert white background to transparent
datas = emblem.getdata()
new_data = []
for item in datas:
    # If pixel is very close to white, make it transparent
    if item[0] > 240 and item[1] > 240 and item[2] > 240:
        new_data.append((255, 255, 255, 0))
    else:
        new_data.append(item)

emblem.putdata(new_data)

# Save processed transparent logo
emblem.save(dest_path, "PNG")
print(f"Successfully saved transparent logo to {dest_path}")
