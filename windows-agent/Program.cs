using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;

// The published executable runs as a long-lived Windows process. Install it as a
// Windows Service with sc.exe or an MSI wrapper in the deployment environment.
var configPath = Path.Combine(AppContext.BaseDirectory, "device-agent.json");
if (!File.Exists(configPath)) throw new FileNotFoundException("device-agent.json is required", configPath);
var config = JsonSerializer.Deserialize<AgentConfig>(await File.ReadAllTextAsync(configPath)) ?? throw new InvalidDataException("Invalid device-agent.json");
using var http = new HttpClient { BaseAddress = new Uri(config.ServerUrl.TrimEnd('/') + "/") };
var statePath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "RentDeviceAgent", "state.json");
Directory.CreateDirectory(Path.GetDirectoryName(statePath)!);
var state = File.Exists(statePath) ? JsonSerializer.Deserialize<AgentState>(await File.ReadAllTextAsync(statePath)) : null;

if (state?.Token is null)
{
    var hardware = HardwareSnapshot.Read();
    var response = await http.PostAsJsonAsync("api/device-agent/register", new { serialNumber = hardware.SerialNumber, setupCode = config.RegistrationCode });
    response.EnsureSuccessStatusCode();
    var registered = await response.Content.ReadFromJsonAsync<RegisterResponse>() ?? throw new InvalidDataException("Invalid registration response");
    state = new AgentState(registered.Token);
    await File.WriteAllTextAsync(statePath, JsonSerializer.Serialize(state));
}

while (true)
{
    try
    {
        var hardware = HardwareSnapshot.Read();
        using var request = new HttpRequestMessage(HttpMethod.Post, "api/device-agent/heartbeat");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", state!.Token);
        request.Content = JsonContent.Create(hardware);
        var response = await http.SendAsync(request);
        if (response.IsSuccessStatusCode)
        {
            var command = await response.Content.ReadFromJsonAsync<AgentCommand>();
            File.WriteAllText(Path.Combine(Path.GetDirectoryName(statePath)!, "last-command.json"), JsonSerializer.Serialize(command));
        }
    }
    catch (Exception error) { await File.AppendAllTextAsync(Path.Combine(Path.GetDirectoryName(statePath)!, "offline.log"), $"{DateTimeOffset.UtcNow:o} {error}\n"); }
    await Task.Delay(TimeSpan.FromMinutes(1));
}

record AgentConfig(string ServerUrl, string DeviceId, string RegistrationCode, string? ExpiresAt);
record AgentState(string Token);
record RegisterResponse(bool Ok, string DeviceId, string DeviceName, string Token);
record AgentCommand(bool Ok, string? DeviceMode, bool RemoteLockEnabled, string? LockMessage, string? ContractLink);
record HardwareSnapshot(string SerialNumber, string Hostname, string OsVersion, string Cpu, long MemoryMb, long StorageFreeBytes)
{
    public static HardwareSnapshot Read()
    {
        var serial = Environment.GetEnvironmentVariable("COMPUTERNAME") ?? Environment.MachineName;
        var free = new DriveInfo(Path.GetPathRoot(Environment.SystemDirectory)!).AvailableFreeSpace;
        return new(serial, Environment.MachineName, Environment.OSVersion.VersionString, Environment.GetEnvironmentVariable("PROCESSOR_IDENTIFIER") ?? "unknown", GC.GetGCMemoryInfo().TotalAvailableMemoryBytes / 1024 / 1024, free);
    }
}
