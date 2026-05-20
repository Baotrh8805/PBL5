import os
import pathlib

university_dir = pathlib.Path(r"D:\University")
results = []

if university_dir.exists():
    for root, dirs, files in os.walk(university_dir):
        # skip git and cache
        if '.git' in root or '__pycache__' in root or '.metadata' in root:
            continue
        for file in files:
            if file.endswith(('.py', '.ipynb', '.txt', '.json')):
                path = pathlib.Path(root) / file
                try:
                    content = path.read_text(encoding='utf-8', errors='ignore')
                    if 'mfcc_hatespeech' in content or 'mfcc_hatespeech_model' in content:
                        results.append(str(path))
                except Exception:
                    pass

print("Search results:")
for r in results:
    print(r)
