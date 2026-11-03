using Microsoft.AspNetCore.Connections;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting.Internal;
using MicroMobility.Configuration;

namespace MicroMobility.Testing;

public sealed class StartupFailureLoggingTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), $"mm-startup-{Guid.NewGuid():N}");

    public void Dispose()
    {
        if (Directory.Exists(_root)) Directory.Delete(_root, recursive: true);
    }

    [Fact]
    public void A_taken_port_is_logged_to_the_file_with_a_plain_hint()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["App:Url"] = "http://0.0.0.0:8000" })
            .Build();
        var environment = new HostingEnvironment { ContentRootPath = _root };
        var failure = new IOException("Failed to bind to address http://0.0.0.0:8000.",
            new AddressInUseException("Only one usage of each socket address is normally permitted."));

        LoggingSetup.LogStartupFailure(failure, configuration, environment);

        // Relative default path: logs/ under the content root.
        var log = File.ReadAllText(Directory.GetFiles(Path.Combine(_root, "logs"), "micromobility-*.log").Single());
        log.Should().Contain("[FTL]");
        log.Should().Contain("is already in use");
        log.Should().Contain("Failed to bind to address");
    }
}
