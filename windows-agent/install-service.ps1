param([string]$InstallDir = "$env:ProgramFiles\RentDeviceAgent")
$exe = Join-Path $InstallDir "RentDeviceAgent.exe"
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
Copy-Item ".\RentDeviceAgent.exe", ".\device-agent.json" -Destination $InstallDir -Force
sc.exe create RentDeviceAgent binPath= "`"$exe`"" start= auto DisplayName= "Rent Device Agent"
sc.exe description RentDeviceAgent "Rent device monitoring and control service"
sc.exe start RentDeviceAgent
