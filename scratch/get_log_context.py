import re

log_path = r"C:\Users\DELL\.gemini\antigravity\brain\f9ab3dd6-8573-47a3-a30b-9e7d350644c5\.system_generated\logs\overview.txt"
with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
    lines = f.readlines()

output_lines = []
for i, line in enumerate(lines):
    line_lower = line.lower()
    if "mfcc" in line_lower or "vihsd" in line_lower or "hatespeech_model" in line_lower:
        start = max(0, i - 15)
        end = min(len(lines), i + 20)
        output_lines.append(f"--- MATCH AT LINE {i} ---")
        for idx in range(start, end):
            output_lines.append(f"{idx}: {lines[idx].strip()}")
        output_lines.append("\n" + "="*50 + "\n")

with open(r"D:\University\PBL5\PBL5\scratch\log_context.txt", "w", encoding="utf-8") as out:
    out.write("\n".join(output_lines))

print(f"Context written to log_context.txt. Found matches: {len(output_lines)}")
