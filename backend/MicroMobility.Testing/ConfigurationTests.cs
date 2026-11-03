using System.Text;
using System.Text.Json;
using MicroMobility.Authorization;
using MicroMobility.Configuration;
using MicroMobility.Helpers;
using MicroMobility.Models;
using Npgsql;

namespace MicroMobility.Testing;

public sealed class PostgresConnectionStringTests
{
    [Fact]
    public void Neon_uri_becomes_an_npgsql_keyword_string()
    {
        var normalized = PostgresConnectionString.Normalize(
            "postgresql://neondb_owner:p%40ss%23word@ep-cool-1234-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require");

        var builder = new NpgsqlConnectionStringBuilder(normalized);
        builder.Host.Should().Be("ep-cool-1234-pooler.eu-central-1.aws.neon.tech");
        builder.Port.Should().Be(5432);
        builder.Database.Should().Be("neondb");
        builder.Username.Should().Be("neondb_owner");
        builder.Password.Should().Be("p@ss#word");     // URL-encoded characters are decoded
        builder.SslMode.Should().Be(SslMode.Require);
        builder.ChannelBinding.Should().Be(ChannelBinding.Require);
    }

    [Fact]
    public void Keyword_strings_pass_through_unchanged()
    {
        const string keyword = "Host=localhost;Port=5432;Database=db;Username=u;Password=p";
        PostgresConnectionString.Normalize(keyword).Should().Be(keyword);
    }

    [Fact]
    public void Unknown_uri_parameters_are_refused_rather_than_silently_dropped()
    {
        var act = () => PostgresConnectionString.Normalize("postgres://u:p@host/db?sslrootcert=/x.pem");
        act.Should().Throw<InvalidOperationException>().WithMessage("*sslrootcert*");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("  ")]
    public void Missing_connection_string_explains_where_to_set_it(string? value)
    {
        var act = () => PostgresConnectionString.Normalize(value);
        act.Should().Throw<InvalidOperationException>().WithMessage("*ConnectionStrings*");
    }
}

public sealed class JsonContractTests
{
    private static readonly JsonSerializerOptions Options = CreateOptions();

    private static JsonSerializerOptions CreateOptions()
    {
        var options = new JsonSerializerOptions();
        JsonSetup.Apply(options);
        return options;
    }

    [Theory]
    [InlineData(DateTimeKind.Unspecified)]   // what a `timestamp without time zone` column yields
    [InlineData(DateTimeKind.Utc)]
    public void Timestamps_are_utc_with_a_trailing_z(DateTimeKind kind)
    {
        var value = DateTime.SpecifyKind(new DateTime(2026, 11, 3, 9, 30, 5), kind);
        JsonSerializer.Serialize(value, Options).Should().Be("\"2026-11-03T09:30:05Z\"");
    }

    [Fact]
    public void Fractional_seconds_are_kept_to_microseconds()
    {
        var value = new DateTime(2026, 11, 3, 9, 30, 5, DateTimeKind.Utc).AddTicks(1234560);
        JsonSerializer.Serialize(value, Options).Should().Be("\"2026-11-03T09:30:05.123456Z\"");
    }

    [Fact]
    public void Enums_and_properties_are_snake_case_matching_the_database_labels()
    {
        var json = JsonSerializer.Serialize(new { AvailabilityStatus = VehicleAvailabilityStatus.InUse }, Options);
        json.Should().Be("{\"availability_status\":\"in_use\"}");
    }
}

public sealed class GuardTests
{
    [Theory]
    [InlineData(" Rider@Example.COM ", "rider@example.com")]
    [InlineData("a.b+c@sub.domain.io", "a.b+c@sub.domain.io")]
    public void Email_is_trimmed_and_lowercased(string input, string expected)
    {
        Guard.Email(input).Should().Be(expected);
    }

    [Theory]
    [InlineData("no-at-sign")]
    [InlineData("two@@example.com")]
    [InlineData("missing@tld")]
    [InlineData("spaces in@example.com")]
    public void Invalid_email_is_a_sentence_naming_the_field(string input)
    {
        var act = () => Guard.Email(input);
        act.Should().Throw<ArgumentException>().Which.Message.Should().StartWith("email is not a valid email address.");
    }
}

public sealed class HangfireDashboardAuthorizationFilterTests
{
    private static string Basic(string credentials) =>
        "Basic " + Convert.ToBase64String(Encoding.UTF8.GetBytes(credentials));

    [Fact]
    public void Correct_credentials_are_accepted()
    {
        HangfireDashboardAuthorizationFilter.IsAuthorized(Basic("ops:s3cret"), "ops", "s3cret").Should().BeTrue();
    }

    [Theory]
    [InlineData("ops:wrong")]
    [InlineData("other:s3cret")]
    [InlineData("ops")]
    [InlineData("")]
    public void Anything_else_is_refused(string credentials)
    {
        HangfireDashboardAuthorizationFilter.IsAuthorized(Basic(credentials), "ops", "s3cret").Should().BeFalse();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("Bearer abc")]
    [InlineData("Basic not-base64!!")]
    public void Malformed_headers_are_refused(string? header)
    {
        HangfireDashboardAuthorizationFilter.IsAuthorized(header, "ops", "s3cret").Should().BeFalse();
    }
}
