# Configurações do Nexus Machine
$baseUrl = "https://hqyuxponbobmuletqshq.supabase.co/functions/v1"
$SERVICE_ROLE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxeXV4cG9uYm9ibXVsZXRxc2hxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQyMzgxNSwiZXhwIjoyMDg2OTk5ODE1fQ.B_W53OyGyO2KVi6QeW09O1voS1lnG7jFVhTnNAxrY2k"

$headers = @{
    "Authorization" = "Bearer $SERVICE_ROLE"
    "apikey"        = $SERVICE_ROLE
    "Content-Type"  = "application/json"
}

Write-Host "A iniciar migração de segurança (AES-256-GCM)..." -ForegroundColor Cyan

# Execução com o novo formato de headers
Invoke-RestMethod -Uri "$baseUrl/encrypt-existing-tokens" -Method Post -Headers $headers -Body "{}"

Write-Host "Processo Concluído com Sucesso!" -ForegroundColor Green