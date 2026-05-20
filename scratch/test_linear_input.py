import torch
import torch.nn as nn

class MfccHatespeechModel(nn.Module):
    def __init__(self):
        super().__init__()
        # 1. Linear first layer
        self.embedding = nn.Linear(50000, 128)
        
        # 2. Conv block 1
        self.conv1 = nn.Conv1d(128, 128, kernel_size=8, padding='same')
        self.bn1 = nn.BatchNorm1d(128)
        self.relu1 = nn.ReLU()
        
        # 3. Conv block 2
        self.conv2 = nn.Conv1d(128, 128, kernel_size=8, padding='same')
        self.bn2 = nn.BatchNorm1d(128)
        self.relu2 = nn.ReLU()
        
        # 4. Conv block 3
        self.conv3 = nn.Conv1d(128, 64, kernel_size=4, padding='same')
        self.bn3 = nn.BatchNorm1d(64)
        self.relu3 = nn.ReLU()
        
        # 5. Conv block 4
        self.conv4 = nn.Conv1d(64, 32, kernel_size=4, padding='same')
        self.bn4 = nn.BatchNorm1d(32)
        self.relu4 = nn.ReLU()
        
        # 6. BiLSTM 1
        self.lstm1 = nn.LSTM(input_size=32, hidden_size=128, batch_first=True, bidirectional=True)
        
        # 7. BiLSTM 2
        self.lstm2 = nn.LSTM(input_size=256, hidden_size=64, batch_first=True, bidirectional=True)
        
        # 8. Fully Connected Layers
        self.fc1 = nn.Linear(128, 64)
        self.relu_fc1 = nn.ReLU()
        self.fc2 = nn.Linear(64, 16)
        self.relu_fc2 = nn.ReLU()
        self.fc3 = nn.Linear(16, 3)

    def forward(self, x):
        # x shape: (batch, 50000)
        x = self.embedding(x)  # (batch, 128)
        
        # Conv1d expects (batch, channels, seq_len)
        x = x.unsqueeze(2)  # (batch, 128, 1)
        
        x = self.relu1(self.bn1(self.conv1(x)))
        x = self.relu2(self.bn2(self.conv2(x)))
        x = self.relu3(self.bn3(self.conv3(x)))
        x = self.relu4(self.bn4(self.conv4(x)))
        
        # LSTM expects (batch, seq_len, channels)
        x = x.transpose(1, 2)  # (batch, 1, 32)
        
        x, _ = self.lstm1(x)  # (batch, 1, 256)
        x, _ = self.lstm2(x)  # (batch, 1, 128)
        x = x[:, -1, :]       # (batch, 128)
        
        x = self.relu_fc1(self.fc1(x))
        x = self.relu_fc2(self.fc2(x))
        x = self.fc3(x)       # (batch, 3)
        return x

if __name__ == "__main__":
    p = r"D:\University\PBL5\PBL5\src\main\model\mfcc_hatespeech_model.pt"
    obj = torch.load(p, map_location='cpu', weights_only=False)
    
    model = MfccHatespeechModel()
    
    # weights is a list of tensors
    weights = obj['weights']
    model.embedding.weight.data = weights[0].T.clone().detach()
    # Let's set model to eval mode!
    model.eval()
    
    # Conv 1
    w1 = weights[1].permute(2, 1, 0).clone().detach()
    model.conv1.weight.data = w1
    model.conv1.bias.data = weights[2].clone().detach()
    # BN 1
    model.bn1.weight.data = weights[3].clone().detach()
    model.bn1.bias.data = weights[4].clone().detach()
    model.bn1.running_mean.data = weights[5].clone().detach()
    model.bn1.running_var.data = weights[6].clone().detach()
    
    # Conv 2
    w7 = weights[7].permute(2, 1, 0).clone().detach()
    model.conv2.weight.data = w7
    model.conv2.bias.data = weights[8].clone().detach()
    # BN 2
    model.bn2.weight.data = weights[9].clone().detach()
    model.bn2.bias.data = weights[10].clone().detach()
    model.bn2.running_mean.data = weights[11].clone().detach()
    model.bn2.running_var.data = weights[12].clone().detach()
    
    # Conv 3
    w13 = weights[13].permute(2, 1, 0).clone().detach()
    model.conv3.weight.data = w13
    model.conv3.bias.data = weights[14].clone().detach()
    # BN 3
    model.bn3.weight.data = weights[15].clone().detach()
    model.bn3.bias.data = weights[16].clone().detach()
    model.bn3.running_mean.data = weights[17].clone().detach()
    model.bn3.running_var.data = weights[18].clone().detach()
    
    # Conv 4
    w19 = weights[19].permute(2, 1, 0).clone().detach()
    model.conv4.weight.data = w19
    model.conv4.bias.data = weights[20].clone().detach()
    # BN 4
    model.bn4.weight.data = weights[21].clone().detach()
    model.bn4.bias.data = weights[22].clone().detach()
    model.bn4.running_mean.data = weights[23].clone().detach()
    model.bn4.running_var.data = weights[24].clone().detach()
    
    # BiLSTM 1
    model.lstm1.weight_ih_l0.data = weights[25].T.clone().detach()
    model.lstm1.weight_hh_l0.data = weights[26].T.clone().detach()
    model.lstm1.bias_ih_l0.data = weights[27].clone().detach()
    model.lstm1.bias_hh_l0.data = torch.zeros(512)
    model.lstm1.weight_ih_l0_reverse.data = weights[28].T.clone().detach()
    model.lstm1.weight_hh_l0_reverse.data = weights[29].T.clone().detach()
    model.lstm1.bias_ih_l0_reverse.data = weights[30].clone().detach()
    model.lstm1.bias_hh_l0_reverse.data = torch.zeros(512)
    
    # BiLSTM 2
    model.lstm2.weight_ih_l0.data = weights[31].T.clone().detach()
    model.lstm2.weight_hh_l0.data = weights[32].T.clone().detach()
    model.lstm2.bias_ih_l0.data = weights[33].clone().detach()
    model.lstm2.bias_hh_l0.data = torch.zeros(256)
    model.lstm2.weight_ih_l0_reverse.data = weights[34].T.clone().detach()
    model.lstm2.weight_hh_l0_reverse.data = weights[35].T.clone().detach()
    model.lstm2.bias_ih_l0_reverse.data = weights[36].clone().detach()
    model.lstm2.bias_hh_l0_reverse.data = torch.zeros(256)
    
    # FC Layers
    model.fc1.weight.data = weights[37].T.clone().detach()
    model.fc1.bias.data = weights[38].clone().detach()
    
    model.fc2.weight.data = weights[39].T.clone().detach()
    model.fc2.bias.data = weights[40].clone().detach()
    
    model.fc3.weight.data = weights[41].T.clone().detach()
    model.fc3.bias.data = weights[42].clone().detach()
    
    print("Successfully mapped using Linear!")
    
    dummy_input = torch.randn(1, 50000)
    logits = model(dummy_input)
    print("Logits output shape:", logits.shape)
    print("Logits:", logits)
