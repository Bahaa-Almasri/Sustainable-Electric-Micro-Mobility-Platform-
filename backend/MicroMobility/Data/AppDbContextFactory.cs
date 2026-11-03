using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace MicroMobility.Data;

/// <summary>Design-time factory for `dotnet ef`, which runs without the app's DI container.</summary>
public sealed class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Development";
        var basePath = Directory.GetCurrentDirectory();

        // Allows `dotnet ef` from backend/ as well as from backend/MicroMobility/.
        if (!File.Exists(Path.Combine(basePath, "appsettings.json"))
            && File.Exists(Path.Combine(basePath, "MicroMobility", "appsettings.json")))
        {
            basePath = Path.Combine(basePath, "MicroMobility");
        }

        var configuration = new ConfigurationBuilder()
            .SetBasePath(basePath)
            .AddJsonFile("appsettings.json", optional: false)
            .AddJsonFile($"appsettings.{environment}.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
        optionsBuilder.UseAppNpgsql(configuration.GetConnectionString("DefaultConnection"));
        return new AppDbContext(optionsBuilder.Options);
    }
}
