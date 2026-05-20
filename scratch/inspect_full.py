import torch

p = r"D:\University\PBL5\PBL5\src\main\model\mfcc_hatespeech_model.pt"
obj = torch.load(p, map_location='cpu', weights_only=False)

with open(r"D:\University\PBL5\PBL5\scratch\inspect_full.txt", "w", encoding="utf-8") as f:
    f.write(f"Keys: {list(obj.keys())}\n")
    f.write(f"Description: {obj.get('description', 'None')}\n")
    
    # Print shapes of all weights
    f.write(f"Weights count: {len(obj['weights'])}\n")
    for idx, w in enumerate(obj['weights']):
        if hasattr(w, 'shape'):
            f.write(f"Weight {idx} shape: {w.shape}\n")
        else:
            f.write(f"Weight {idx} type: {type(w)}\n")
            
    for k, v in obj.items():
        if k not in ['description', 'weights']:
            f.write(f"Other key: {k}, type: {type(v)}\n")
            
print("Inspection output written to scratch/inspect_full.txt")
