# Creates the wiki database/user on local PostgreSQL (no Docker).
# Usage:
#   .\scripts\setup-local-db.ps1 -PostgresPassword "YOUR_PASSWORD"

param(
  [Parameter(Mandatory = $true)]
  [string]$PostgresPassword,

  [string]$Psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe",
  [string]$SuperUser = "postgres",
  [string]$DbName = "wiki",
  [string]$AppUser = "wiki",
  [string]$AppPassword = "wiki_secret"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $Psql)) {
  Write-Error "psql not found at $Psql. Install PostgreSQL or update -Psql."
}

$env:PGPASSWORD = $PostgresPassword

Write-Host "Creating role/database if missing..."

& $Psql -U $SuperUser -d postgres -v ON_ERROR_STOP=1 -c @"
DO `$`$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$AppUser') THEN
    CREATE ROLE $AppUser LOGIN PASSWORD '$AppPassword';
  END IF;
END
`$`$;
"@

$dbExists = & $Psql -U $SuperUser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$DbName'"
if ($dbExists -ne "1") {
  & $Psql -U $SuperUser -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $DbName OWNER $AppUser;"
}

& $Psql -U $SuperUser -d $DbName -v ON_ERROR_STOP=1 -c "GRANT ALL ON SCHEMA public TO $AppUser; ALTER SCHEMA public OWNER TO $AppUser;"

Write-Host "Done. DATABASE_URL should be:"
Write-Host "postgresql://${AppUser}:${AppPassword}@localhost:5432/${DbName}?schema=public"
