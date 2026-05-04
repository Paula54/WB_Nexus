# 1. Cria pasta temp e instala dependência
mkdir C:\nexus-encrypt; cd C:\nexus-encrypt
npm init -y
npm i @supabase/supabase-js

# 2. Copia o ficheiro encrypt-tokens.mjs para esta pasta

# 3. Define env vars (substitui os valores)
$env:SUPABASE_URL = "https://hqyuxponbobmuletqshq.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "<service_role_key>"
$env:ENCRYPTION_KEY = "<64_hex_chars>"

# 4. Executa
node encrypt-tokens.mjs