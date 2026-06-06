import os
import pathlib

workspace_dir = pathlib.Path(r"D:\University\PBL5\PBL5")
results = []

for root, dirs, files in os.walk(workspace_dir):
    # check files
    for file in files:
        if file.endswith(('.py', '.ipynb', '.txt', '.json', '.md', '.java', '.xml')):
            path = pathlib.Path(root) / file
            try:
                content = path.read_text(encoding='utf-8', errors='ignore')
                if 'mfcc_hatespeech_model' in content or 'mfcc_hatespeech' in content:
                    results.append(str(path))
            except Exception:
                pass

print("Search results:")
for r in results:
    print(r)
