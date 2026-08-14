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
var queuePath = Path.Combine(Path.GetDirectoryName(statePath)!, "offline-queue.jsonl");
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
    var hardware = HardwareSnapshot.Read();
    try
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "api/device-agent/heartbeat");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", state!.Token);
        request.Content = JsonContent.Create(hardware);
        var response = await http.SendAsync(request);
        if (response.IsSuccessStatusCode)
        {
            await FlushQueue(http, state!.Token, queuePath);
            var command = await response.Content.ReadFromJsonAsync<AgentCommand>();
            File.WriteAllText(Path.Combine(Path.GetDirectoryName(statePath)!, "last-command.json"), JsonSerializer.Serialize(command));
            await ExecuteCommand(command, state!.Token, http, hardware);
        }
    }
    catch (Exception error)
    {
        await File.AppendAllTextAsync(queuePath, JsonSerializer.Serialize(new { inspectionType = "automated_health", snapshot = hardware }) + "\n");
        await File.AppendAllTextAsync(Path.Combine(Path.GetDirectoryName(statePath)!, "offline.log"), $"{DateTimeOffset.UtcNow:o} {error.Message}\n");
    }
    await Task.Delay(TimeSpan.FromMinutes(1));
}

static async Task FlushQueue(HttpClient http, string token, string queuePath)
{
    if (!File.Exists(queuePath)) return;
    var lines = await File.ReadAllLinesAsync(queuePath);
    var remaining = new List<string>();
    foreach (var line in lines.Where(line => !string.IsNullOrWhiteSpace(line)))
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "api/device-agent/inspection");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = new StringContent(line, Encoding.UTF8, "application/json");
        if (!(await http.SendAsync(request)).IsSuccessStatusCode) remaining.Add(line);
    }
    if (remaining.Count == 0) File.Delete(queuePath); else await File.WriteAllLinesAsync(queuePath, remaining.TakeLast(5000));
}

static async Task ExecuteCommand(AgentCommand? command, string token, HttpClient http, HardwareSnapshot hardware)
{
    if (command is null) return;
    var mode = command.DeviceMode ?? "normal";
    await File.WriteAllTextAsync(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "RentDeviceAgent", "mode.txt"), mode);
    if (command.RemoteLockEnabled) System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo("rundll32.exe", "user32.dll,LockWorkStation") { CreateNoWindow = true, UseShellExecute = false });
    using var inspection = new HttpRequestMessage(HttpMethod.Post, "api/device-agent/inspection");
    inspection.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
    inspection.Content = JsonContent.Create(new { inspectionType = "automated_health", snapshot = hardware });
    await http.SendAsync(inspection);
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
