using System.Net;
using MicroMobility.Testing.Integration.Infrastructure;

namespace MicroMobility.Testing.Integration;

[Collection(IntegrationCollection.Name)]
public sealed class LoggingTests : IAsyncLifetime
{
    private readonly IntegrationTestFixture _fixture;
    private readonly string _logDirectory = Path.Combine(Path.GetTempPath(), $"mm-logs-{Guid.NewGuid():N}");

    public LoggingTests(IntegrationTestFixture fixture) => _fixture = fixture;

    public Task InitializeAsync() => _fixture.ResetDatabaseAsync();

    public Task DisposeAsync()
    {
        try
        {
            if (Directory.Exists(_logDirectory)) Directory.Delete(_logDirectory, recursive: true);
        }
        catch (IOException)
        {
            // A temp folder left behind is harmless; failing the test over cleanup is not.
        }
        return Task.CompletedTask;
    }

    [Fact]
    public async Task Every_response_carries_a_request_id_readable_by_browsers()
    {
        var client = _fixture.Factory.CreateClient();
        var request = new HttpRequestMessage(HttpMethod.Get, "/rides/me");
        request.Headers.Add("Origin", "http://localhost:8081");

        var response = await client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        response.Headers.GetValues("X-Request-Id").Single().Should().NotBeNullOrWhiteSpace();
        response.Headers.GetValues("Access-Control-Expose-Headers").Should().Contain(v => v.Contains("X-Request-Id"));
    }

    [Fact]
    public async Task Requests_are_written_to_the_log_file_with_their_request_id_and_without_query_strings()
    {
        string requestId;
        await using (var factory = new MicroMobilityWebApplicationFactory(_fixture.ConnectionString,
                         new Dictionary<string, string?>
                         {
                             ["LogFiles:Enabled"] = "true",
                             ["LogFiles:Path"] = Path.Combine(_logDirectory, "api-.log")
                         }))
        {
            var client = factory.CreateClient();
            var response = await client.GetAsync("/rides/me?access_token=leak-check-secret");
            requestId = response.Headers.GetValues("X-Request-Id").Single();
            await client.GetAsync("/health");
        }   // disposing the host flushes and closes the log file

        var log = string.Join("\n", Directory.GetFiles(_logDirectory, "api-*.log").Select(ReadShared));

        log.Should().Contain($"[{requestId}]");
        log.Should().Contain("HTTP GET /rides/me responded 401");
        log.Should().NotContain("leak-check-secret");
        log.Should().NotContain("/health responded");     // probes are logged at Verbose, i.e. not at all
    }

    /// <summary>Reads the way a log viewer does: the file may still be open for writing.</summary>
    private static string ReadShared(string path)
    {
        using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }
}
