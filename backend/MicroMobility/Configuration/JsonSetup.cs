using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace MicroMobility.Configuration;

/// <summary>
/// The wire format, shared by MVC, minimal endpoints and SignalR: snake_case keys and enum values
/// (matching the database labels and what the Expo app already reads), and UTC timestamps with a "Z".
/// </summary>
public static class JsonSetup
{
    public static void Apply(JsonSerializerOptions options)
    {
        options.PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower;
        options.DefaultIgnoreCondition = JsonIgnoreCondition.Never;
        options.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseLower));
        options.Converters.Add(new UtcDateTimeConverter());
    }
}

/// <summary>
/// Writes every DateTime as UTC ISO-8601 with a trailing "Z" (fractional seconds only when present),
/// treating Unspecified as UTC. Without the "Z", JavaScript parses the value as local time.
/// </summary>
public sealed class UtcDateTimeConverter : JsonConverter<DateTime>
{
    public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
        DateTime.Parse(reader.GetString()!, CultureInfo.InvariantCulture,
            DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal);

    public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options)
    {
        var utc = value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };
        writer.WriteStringValue(utc.ToString("yyyy-MM-dd'T'HH:mm:ss.FFFFFF'Z'", CultureInfo.InvariantCulture));
    }
}
