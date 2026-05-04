# 1. Cria pasta temp e instala dependência
mkdir C:\nexus-encrypt; cd C:\nexus-encrypt
npm init -y
npm i @supabase/supabase-js

# 2. Copia o ficheiro encrypt-tokens.mjs para esta pasta

# 3. Define env vars (substitui os valores)
$env:SUPABASE_URL = "https://hqyuxponbobmuletqshq.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxeXV4cG9uYm9ibXVsZXRxc2hxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQyMzgxNSwiZXhwIjoyMDg2OTk5ODE1fQ.B_W53OyGyO2KVi6QeW09O1voS1lnG7jFVhTnNAxrY2k"
$env:ENCRYPTION_KEY = "<0673ed93eb2a437997cb2f448345f7f320fe87de4a2c42d5a7ff0b58d6fb2da5>"

# 4. Executa
node encrypt-tokens.mjs