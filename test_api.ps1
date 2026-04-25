$loginJson = '{"email":"moderator@gmail.com","password":"123456","rememberMe":false}'
$loginResp = Invoke-RestMethod -Method Post -Uri 'http://localhost:8080/api/auth/login' -ContentType 'application/json' -Body $loginJson
$token = $loginResp.token

$headers = @{ Authorization = "Bearer $token" }

Write-Host "--- GET /api/posts ---"
try {
    $getPosts = Invoke-WebRequest -UseBasicParsing -Method Get -Uri 'http://localhost:8080/api/posts' -Headers $headers
    Write-Host "GET_STATUS=$($getPosts.StatusCode)"
    Write-Host $getPosts.Content.SubString(0, [Math]::Min(200, $getPosts.Content.Length))
} catch {
    Write-Host "GET_ERROR_STATUS=$($_.Exception.Response.StatusCode.value__)"
    Write-Host $_.Exception.Message
}

Write-Host "
--- POST /api/posts/create ---"
$createBody = '{"content":"test post","imageUrl":null,"videoUrl":null,"visibility":"PUBLIC"}'
try {
    $createPost = Invoke-WebRequest -UseBasicParsing -Method Post -Uri 'http://localhost:8080/api/posts/create' -Headers $headers -ContentType 'application/json' -Body $createBody
    Write-Host "POST_STATUS=$($createPost.StatusCode)"
    Write-Host $createPost.Content.SubString(0, [Math]::Min(200, $createPost.Content.Length))
} catch {
    Write-Host "POST_ERROR_STATUS=$($_.Exception.Response.StatusCode.value__)"
    Write-Host $_.Exception.Message
}
