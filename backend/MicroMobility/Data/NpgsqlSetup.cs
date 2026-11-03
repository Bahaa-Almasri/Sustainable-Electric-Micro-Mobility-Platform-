using Microsoft.EntityFrameworkCore;
using MicroMobility.Configuration;
using MicroMobility.Models;

namespace MicroMobility.Data;

/// <summary>
/// The one place the app, the design-time factory and the tests configure Npgsql, so all three
/// agree on the enum mapping. Each CLR enum maps to the native PostgreSQL enum of the same name.
/// </summary>
public static class NpgsqlSetup
{
    public static DbContextOptionsBuilder UseAppNpgsql(this DbContextOptionsBuilder options, string? connectionString) =>
        options.UseNpgsql(PostgresConnectionString.Normalize(connectionString), npgsql =>
        {
            npgsql.MapEnum<VehicleType>("vehicle_type");
            npgsql.MapEnum<VehicleAvailabilityStatus>("vehicle_availability_status");
            npgsql.MapEnum<VehicleOperationalStatus>("vehicle_operational_status");
            npgsql.MapEnum<StationStatus>("station_status");
            npgsql.MapEnum<RideStatus>("ride_status");
            npgsql.MapEnum<ReservationStatus>("reservation_status");
            npgsql.MapEnum<PaymentStatus>("payment_status");
            npgsql.MapEnum<TicketCategory>("ticket_category");
            npgsql.MapEnum<TicketPriority>("ticket_priority");
            npgsql.MapEnum<TicketStatus>("ticket_status");
            npgsql.MapEnum<ChargeType>("charge_type");
            npgsql.MapEnum<RideEventType>("ride_event_type");
            npgsql.MapEnum<TelemetryEventType>("telemetry_event_type");
            npgsql.MapEnum<UserVerificationType>("user_verification_type");
            npgsql.MapEnum<VerificationStatus>("verification_status");
            npgsql.MapEnum<VehicleIssueType>("vehicle_issue_type");
            npgsql.MapEnum<VehicleIssueStatus>("vehicle_issue_status");
        });
}
