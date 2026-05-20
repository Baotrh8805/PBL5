import pathlib
import torch
import numpy as np

p = pathlib.Path(r"D:\University\PBL5\PBL5\src\main\model\mfcc_hatespeech_model.pt")
obj = torch.load(str(p), map_location='cpu', weights_only=False)
print(type(obj))
print(obj.get('description'))
w = obj.get('weights')
print(type(w), len(w))
for i, x in enumerate(w[:12]):
    arr = np.array(x)
    print(i, arr.shape, arr.dtype)
