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
Start-Sleep -Seconds 3

Write-Host "Starting Python AI Server..."
$pyProc = Start-Process -FilePath "python" -ArgumentList "-u moderate.py" -WorkingDirectory "$PSScriptRoot\src\main\model" -RedirectStandardOutput "$PSScriptRoot\python_stdout.log" -RedirectStandardError "$PSScriptRoot\python_stderr.log" -PassThru -NoNewWindow
Write-Host "Python AI Server started with PID: $($pyProc.Id)"

Write-Host "Starting Java Spring Boot Server..."
$javaProc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c run_java.cmd" -WorkingDirectory "$PSScriptRoot" -RedirectStandardOutput "$PSScriptRoot\java_stdout.log" -RedirectStandardError "$PSScriptRoot\java_stderr.log" -PassThru -NoNewWindow
Write-Host "Java Server started with PID: $($javaProc.Id)"

Start-Sleep -Seconds 5
