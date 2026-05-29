Write-Host "Stopping existing servers..."
$port8080Pid = (Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue) | Select-Object -ExpandProperty OwningProcess -Unique
$port5000Pid = (Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue) | Select-Object -ExpandProperty OwningProcess -Unique

if ($port8080Pid) {
    foreach ($p in $port8080Pid) {
        Write-Host "Killing process on port 8080: $p"
        Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
    }
}
if ($port5000Pid) {
    foreach ($p in $port5000Pid) {
        Write-Host "Killing process on port 5000: $p"
        Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
    }
}
# Also kill hardcoded ones just in case
Stop-Process -Id 26944 -Force -ErrorAction SilentlyContinue
Stop-Process -Id 29680 -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3

Write-Host "Starting Python AI Server..."
$pyProc = Start-Process -FilePath "C:\Users\DELL\AppData\Local\Programs\Python\Python312\python.exe" -ArgumentList "-u moderate.py" -WorkingDirectory "D:\University\PBL5\PBL5\src\main\model" -RedirectStandardOutput "D:\University\PBL5\PBL5\python_stdout.log" -RedirectStandardError "D:\University\PBL5\PBL5\python_stderr.log" -PassThru -NoNewWindow
Write-Host "Python AI Server started with PID: $($pyProc.Id)"

Write-Host "Starting Java Spring Boot Server..."
$javaProc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c D:\University\PBL5\PBL5\run_java.cmd" -WorkingDirectory "D:\University\PBL5\PBL5" -RedirectStandardOutput "D:\University\PBL5\PBL5\java_stdout.log" -RedirectStandardError "D:\University\PBL5\PBL5\java_stderr.log" -PassThru -NoNewWindow
Write-Host "Java Server started with PID: $($javaProc.Id)"

Start-Sleep -Seconds 5
