import os
import pathlib

brain_dir = pathlib.Path(r"C:\Users\DELL\.gemini\antigravity\brain")
results = []

if brain_dir.exists():
    for root, dirs, files in os.walk(brain_dir):
        for file in files:
            if file.endswith('.txt') or file.endswith('.md') or file.endswith('.json'):
                path = pathlib.Path(root) / file
                try:
                    content = path.read_text(encoding='utf-8', errors='ignore')
                    if 'mfcc' in content or 'ViHSD' in content or 'hatespeech_model' in content:
                        results.append((str(path), len(content)))
                except Exception as e:
                    pass

with open(r"D:\University\PBL5\PBL5\scratch\log_search_results.txt", "w", encoding="utf-8") as out:
    for path, length in results:
        out.write(f"{path} (len={length})\n")
print(f"Done, found {len(results)} files.")
