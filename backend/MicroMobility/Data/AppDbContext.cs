using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using MicroMobility.Models;

namespace MicroMobility.Data;

/// <summary>
/// Mapping for the existing Neon schema. Table, column, constraint and index names match the live
/// database exactly, so the baseline migration (InitialSchema) describes what is already there and
/// future migrations diff against reality. All configuration lives here — entities carry no attributes.
/// </summary>
public sealed class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Station> Stations => Set<Station>();
    public DbSet<Vehicle> Vehicles => Set<Vehicle>();
    public DbSet<VehicleCurrentState> VehicleCurrentStates => Set<VehicleCurrentState>();
    public DbSet<VehiclePricing> VehiclePricing => Set<VehiclePricing>();
    public DbSet<Ride> Rides => Set<Ride>();
    public DbSet<Reservation> Reservations => Set<Reservation>();
    public DbSet<RidePackage> RidePackages => Set<RidePackage>();
    public DbSet<UserPackagePurchase> UserPackagePurchases => Set<UserPackagePurchase>();
    public DbSet<PaymentMethod> PaymentMethods => Set<PaymentMethod>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<SupportTicket> SupportTickets => Set<SupportTicket>();
    public DbSet<RideCharge> RideCharges => Set<RideCharge>();
    public DbSet<RideEvent> RideEvents => Set<RideEvent>();
    public DbSet<TelemetryEvent> TelemetryEvents => Set<TelemetryEvent>();
    public DbSet<UserVerification> UserVerifications => Set<UserVerification>();
    public DbSet<VehicleIssue> VehicleIssues => Set<VehicleIssue>();

    /// <summary>
    /// Most columns are `timestamp without time zone` holding UTC. Npgsql refuses to write a
    /// UTC-kind DateTime into one, and reads them back as Unspecified — which System.Text.Json
    /// would then serialize without a "Z", so the app parses them as local time (skewing ride
    /// durations by the phone's UTC offset). This converter keeps every DateTime in C# UTC-kind.
    /// </summary>
    private static readonly ValueConverter<DateTime, DateTime> UtcWallClock = new(
        v => DateTime.SpecifyKind(v.Kind == DateTimeKind.Local ? v.ToUniversalTime() : v, DateTimeKind.Unspecified),
        v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasPostgresExtension("pgcrypto");

        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("users");
            entity.HasKey(x => x.Id).HasName("users_pkey");
            entity.Property(x => x.Id).HasColumnName("user_id").HasDefaultValueSql("gen_random_uuid()");
            entity.Property(x => x.Name).HasMaxLength(150);
            entity.Property(x => x.Email).HasMaxLength(255);
            entity.Property(x => x.PhoneNumber).HasMaxLength(30);
            entity.Property(x => x.AuthProvider).HasMaxLength(50);
            entity.Property(x => x.IsActive).HasDefaultValueSql("true").ValueGeneratedNever();
            Timestamp(entity.Property(x => x.CreatedAt)).HasDefaultValueSql("now()");
            Timestamp(entity.Property(x => x.UpdatedAt)).HasDefaultValueSql("now()");

            // Live DB has this as a UNIQUE constraint; a unique index is equivalent for lookups and
            // keeps Email updatable through EF (an alternate key would make it immutable).
            entity.HasIndex(x => x.Email).IsUnique().HasDatabaseName("users_email_key");
        });

        modelBuilder.Entity<Station>(entity =>
        {
            entity.ToTable("stations", t => t.HasCheckConstraint("stations_capacity_check", "capacity >= 0"));
            entity.HasKey(x => x.Id).HasName("stations_pkey");
            entity.Property(x => x.Id).HasColumnName("station_id").HasDefaultValueSql("gen_random_uuid()");
            entity.Property(x => x.Name).HasMaxLength(150);
            entity.Property(x => x.Status).HasDefaultValueSql("'active'::station_status").ValueGeneratedNever();
            Timestamp(entity.Property(x => x.CreatedAt)).HasDefaultValueSql("now()");
            Timestamp(entity.Property(x => x.UpdatedAt)).HasDefaultValueSql("now()");
        });

        modelBuilder.Entity<Vehicle>(entity =>
        {
            entity.ToTable("vehicles");
            entity.HasKey(x => x.Id).HasName("vehicles_pkey");
            entity.Property(x => x.Id).HasColumnName("vehicle_id").HasDefaultValueSql("gen_random_uuid()");
            entity.Property(x => x.AvailabilityStatus)
                .HasDefaultValueSql("'available'::vehicle_availability_status").ValueGeneratedNever();
            entity.Property(x => x.OperationalStatus)
                .HasDefaultValueSql("'healthy'::vehicle_operational_status").ValueGeneratedNever();
            Timestamp(entity.Property(x => x.CreatedAt)).HasDefaultValueSql("now()");
            Timestamp(entity.Property(x => x.UpdatedAt)).HasDefaultValueSql("now()");

            // The map and station panels filter on these.
            entity.HasIndex(x => x.AvailabilityStatus).HasDatabaseName("idx_vehicles_availability_status");
            entity.HasIndex(x => x.OperationalStatus).HasDatabaseName("idx_vehicles_operational_status");
            entity.HasIndex(x => x.StationId).HasDatabaseName("idx_vehicles_station_id");

            entity.HasOne(x => x.Station)
                .WithMany(x => x.Vehicles)
                .HasForeignKey(x => x.StationId)
                .HasConstraintName("vehicles_station_id_fkey")
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<VehicleCurrentState>(entity =>
        {
            entity.ToTable("vehicle_current_state", t => t.HasCheckConstraint(
                "vehicle_current_state_current_battery_percent_check",
                "current_battery_percent >= 0 AND current_battery_percent <= 100"));
            entity.HasKey(x => x.VehicleId).HasName("vehicle_current_state_pkey");
            entity.Property(x => x.IsLocked).HasDefaultValueSql("true").ValueGeneratedNever();
            Timestamp(entity.Property(x => x.LastSeenAt));
            Timestamp(entity.Property(x => x.UpdatedAt)).HasDefaultValueSql("now()");

            entity.HasOne(x => x.Vehicle)
                .WithOne(x => x.CurrentState)
                .HasForeignKey<VehicleCurrentState>(x => x.VehicleId)
                .HasConstraintName("vehicle_current_state_vehicle_id_fkey")
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<VehiclePricing>(entity =>
        {
            entity.ToTable("vehicle_pricing");
            entity.HasKey(x => x.Id).HasName("vehicle_pricing_pkey");
            entity.Property(x => x.Id).UseSerialColumn();
            entity.Property(x => x.UpdatedAt).HasColumnType("timestamp with time zone").HasDefaultValueSql("now()");
            entity.HasIndex(x => x.VehicleType).IsUnique().HasDatabaseName("vehicle_pricing_vehicle_type_key");
        });

        modelBuilder.Entity<Ride>(entity =>
        {
            entity.ToTable("rides", t =>
            {
                t.HasCheckConstraint("ride_time_check", "ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at");
                t.HasCheckConstraint("rides_distance_meters_check", "distance_meters IS NULL OR distance_meters >= 0");
                t.HasCheckConstraint("rides_duration_seconds_check", "duration_seconds IS NULL OR duration_seconds >= 0");
                t.HasCheckConstraint("rides_total_cost_check", "total_cost >= 0");
            });
            entity.HasKey(x => x.Id).HasName("rides_pkey");
            entity.Property(x => x.Id).HasColumnName("ride_id").HasDefaultValueSql("gen_random_uuid()");
            entity.Property(x => x.Status).HasDefaultValueSql("'reserved'::ride_status").ValueGeneratedNever();
            entity.Property(x => x.TotalCost).HasColumnType("numeric").HasDefaultValueSql("0.00").ValueGeneratedNever();
            Timestamp(entity.Property(x => x.StartedAt));
            Timestamp(entity.Property(x => x.EndedAt));
            Timestamp(entity.Property(x => x.CreatedAt)).HasDefaultValueSql("now()");
            Timestamp(entity.Property(x => x.UpdatedAt)).HasDefaultValueSql("now()");

            entity.HasIndex(x => x.UserId).HasDatabaseName("idx_rides_user_id");       // my rides / active ride
            entity.HasIndex(x => x.VehicleId).HasDatabaseName("idx_rides_vehicle_id"); // "vehicle on a ride?"
            entity.HasIndex(x => x.Status).HasDatabaseName("idx_rides_status");
            entity.HasIndex(x => x.StartedAt).HasDatabaseName("idx_rides_started_at"); // history sort

            entity.HasOne(x => x.User)
                .WithMany(x => x.Rides)
                .HasForeignKey(x => x.UserId)
                .HasConstraintName("rides_user_id_fkey")
                .OnDelete(DeleteBehavior.Cascade);

            // Restrict: a vehicle with ride history cannot be deleted out from under its billing.
            entity.HasOne(x => x.Vehicle)
                .WithMany()
                .HasForeignKey(x => x.VehicleId)
                .HasConstraintName("rides_vehicle_id_fkey")
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne<Station>().WithMany().HasForeignKey(x => x.StartStationId)
                .HasConstraintName("rides_start_station_id_fkey").OnDelete(DeleteBehavior.SetNull);
            entity.HasOne<Station>().WithMany().HasForeignKey(x => x.EndStationId)
                .HasConstraintName("rides_end_station_id_fkey").OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Reservation>(entity =>
        {
            entity.ToTable("reservations", t => t.HasCheckConstraint("reservation_expiry_check", "expires_at > reserved_at"));
            entity.HasKey(x => x.Id).HasName("reservations_pkey");
            entity.Property(x => x.Id).HasColumnName("reservation_id").HasDefaultValueSql("gen_random_uuid()");
            entity.Property(x => x.Status).HasDefaultValueSql("'active'::reservation_status").ValueGeneratedNever();
            Timestamp(entity.Property(x => x.ReservedAt)).HasDefaultValueSql("now()");
            Timestamp(entity.Property(x => x.ExpiresAt));
            Timestamp(entity.Property(x => x.CancelledAt));
            Timestamp(entity.Property(x => x.CreatedAt)).HasDefaultValueSql("now()");

            entity.HasIndex(x => x.UserId).HasDatabaseName("idx_reservations_user_id");
            entity.HasIndex(x => x.VehicleId).HasDatabaseName("idx_reservations_vehicle_id");
            entity.HasIndex(x => x.Status).HasDatabaseName("idx_reservations_status");
            entity.HasIndex(x => x.ExpiresAt).HasDatabaseName("idx_reservations_expires_at"); // expiry sweep

            entity.HasOne(x => x.User)
                .WithMany(x => x.Reservations)
                .HasForeignKey(x => x.UserId)
                .HasConstraintName("reservations_user_id_fkey")
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Vehicle)
                .WithMany()
                .HasForeignKey(x => x.VehicleId)
                .HasConstraintName("reservations_vehicle_id_fkey")
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RidePackage>(entity =>
        {
            entity.ToTable("ride_packages");
            entity.HasKey(x => x.Id).HasName("ride_packages_pkey");
            entity.Property(x => x.Id).HasColumnName("package_id").HasDefaultValueSql("gen_random_uuid()");
            entity.Property(x => x.Price).HasColumnType("numeric");
            entity.Property(x => x.Currency).HasDefaultValueSql("'USD'::text").ValueGeneratedNever();
            entity.Property(x => x.IsActive).HasDefaultValueSql("true").ValueGeneratedNever();
        });

        modelBuilder.Entity<UserPackagePurchase>(entity =>
        {
            entity.ToTable("user_package_purchases");
            entity.HasKey(x => x.Id).HasName("user_package_purchases_pkey");
            entity.Property(x => x.Id).HasColumnName("purchase_id").HasDefaultValueSql("gen_random_uuid()");
            entity.Property(x => x.CreatedAt).HasColumnType("timestamp with time zone").HasDefaultValueSql("now()");

            entity.HasOne<User>().WithMany().HasForeignKey(x => x.UserId)
                .HasConstraintName("user_package_purchases_user_id_fkey").OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Package).WithMany().HasForeignKey(x => x.PackageId)
                .HasConstraintName("user_package_purchases_package_id_fkey").OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<PaymentMethod>(entity =>
        {
            entity.ToTable("payment_methods");
            entity.HasKey(x => x.Id).HasName("payment_methods_pkey");
            entity.Property(x => x.Id).HasColumnName("method_id").HasDefaultValueSql("gen_random_uuid()");
            entity.Property(x => x.IsDefault).HasDefaultValueSql("false").ValueGeneratedNever();
            entity.Property(x => x.CreatedAt).HasColumnType("timestamp with time zone").HasDefaultValueSql("now()");

            entity.HasOne<User>().WithMany().HasForeignKey(x => x.UserId)
                .HasConstraintName("payment_methods_user_id_fkey").OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Payment>(entity =>
        {
            entity.ToTable("payments", t => t.HasCheckConstraint("payments_amount_check", "amount >= 0"));
            entity.HasKey(x => x.Id).HasName("payments_pkey");
            entity.Property(x => x.Id).HasColumnName("payment_id").HasDefaultValueSql("gen_random_uuid()");
            entity.Property(x => x.Amount).HasColumnType("numeric");
            entity.Property(x => x.Currency).HasColumnType("character(3)")
                .HasDefaultValueSql("'USD'::bpchar").ValueGeneratedNever();
            entity.Property(x => x.Status).HasDefaultValueSql("'pending'::payment_status").ValueGeneratedNever();
            entity.Property(x => x.Provider).HasMaxLength(50);
            entity.Property(x => x.ProviderPaymentReference).HasMaxLength(255);
            Timestamp(entity.Property(x => x.PaidAt));
            Timestamp(entity.Property(x => x.CreatedAt)).HasDefaultValueSql("now()");
            Timestamp(entity.Property(x => x.UpdatedAt)).HasDefaultValueSql("now()");

            entity.HasIndex(x => x.UserId).HasDatabaseName("idx_payments_user_id");
            entity.HasIndex(x => x.RideId).HasDatabaseName("idx_payments_ride_id");
            entity.HasIndex(x => x.Status).HasDatabaseName("idx_payments_status");
            entity.HasIndex(x => x.ProviderPaymentReference).HasDatabaseName("idx_payments_provider_reference");

            entity.HasOne<User>().WithMany().HasForeignKey(x => x.UserId)
                .HasConstraintName("payments_user_id_fkey").OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<Ride>().WithMany().HasForeignKey(x => x.RideId)
                .HasConstraintName("payments_ride_id_fkey").OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SupportTicket>(entity =>
        {
            entity.ToTable("support_tickets");
            entity.HasKey(x => x.Id).HasName("support_tickets_pkey");
            entity.Property(x => x.Id).HasColumnName("ticket_id").HasDefaultValueSql("gen_random_uuid()");
            entity.Property(x => x.Priority).HasDefaultValueSql("'medium'::ticket_priority").ValueGeneratedNever();
            entity.Property(x => x.Status).HasDefaultValueSql("'open'::ticket_status").ValueGeneratedNever();
            entity.Property(x => x.Title).HasMaxLength(200);
            Timestamp(entity.Property(x => x.CreatedAt)).HasDefaultValueSql("now()");
            Timestamp(entity.Property(x => x.UpdatedAt)).HasDefaultValueSql("now()");
            Timestamp(entity.Property(x => x.ResolvedAt));

            entity.HasIndex(x => x.UserId).HasDatabaseName("idx_support_tickets_user_id");
            entity.HasIndex(x => x.RideId).HasDatabaseName("idx_support_tickets_ride_id");
            entity.HasIndex(x => x.Status).HasDatabaseName("idx_support_tickets_status");
            entity.HasIndex(x => x.Category).HasDatabaseName("idx_support_tickets_category");

            entity.HasOne<User>().WithMany().HasForeignKey(x => x.UserId)
                .HasConstraintName("support_tickets_user_id_fkey").OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<Ride>().WithMany().HasForeignKey(x => x.RideId)
                .HasConstraintName("support_tickets_ride_id_fkey").OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<RideCharge>(entity =>
        {
            entity.ToTable("ride_charges", t => t.HasCheckConstraint("ride_charges_amount_check", "amount >= 0"));
            entity.HasKey(x => x.Id).HasName("ride_charges_pkey");
            entity.Property(x => x.Id).HasColumnName("charge_id").HasDefaultValueSql("gen_random_uuid()");
            entity.Property(x => x.Amount).HasColumnType("numeric");
            Timestamp(entity.Property(x => x.CreatedAt)).HasDefaultValueSql("now()");
            entity.HasIndex(x => x.RideId).HasDatabaseName("idx_ride_charges_ride_id");
            entity.HasOne<Ride>().WithMany().HasForeignKey(x => x.RideId)
                .HasConstraintName("ride_charges_ride_id_fkey").OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RideEvent>(entity =>
        {
            entity.ToTable("ride_events");
            entity.HasKey(x => x.Id).HasName("ride_events_pkey");
            entity.Property(x => x.Id).HasColumnName("ride_event_id").HasDefaultValueSql("gen_random_uuid()");
            entity.Property(x => x.MetadataJson).HasColumnType("jsonb");
            Timestamp(entity.Property(x => x.EventTime)).HasDefaultValueSql("now()");
            Timestamp(entity.Property(x => x.CreatedAt)).HasDefaultValueSql("now()");
            entity.HasIndex(x => x.RideId).HasDatabaseName("idx_ride_events_ride_id");
            entity.HasIndex(x => x.EventType).HasDatabaseName("idx_ride_events_event_type");
            entity.HasIndex(x => x.EventTime).HasDatabaseName("idx_ride_events_event_time");
            entity.HasOne<Ride>().WithMany().HasForeignKey(x => x.RideId)
                .HasConstraintName("ride_events_ride_id_fkey").OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TelemetryEvent>(entity =>
        {
            entity.ToTable("telemetry_events", t =>
            {
                t.HasCheckConstraint("telemetry_events_battery_percent_check", "battery_percent >= 0 AND battery_percent <= 100");
                t.HasCheckConstraint("telemetry_events_speed_check", "speed IS NULL OR speed >= 0");
            });
            entity.HasKey(x => x.Id).HasName("telemetry_events_pkey");
            entity.Property(x => x.Id).HasColumnName("telemetry_id").HasDefaultValueSql("gen_random_uuid()");
            entity.Property(x => x.EventType).HasDefaultValueSql("'heartbeat'::telemetry_event_type").ValueGeneratedNever();
            Timestamp(entity.Property(x => x.Ts)).HasDefaultValueSql("now()");
            Timestamp(entity.Property(x => x.CreatedAt)).HasDefaultValueSql("now()");
            entity.HasIndex(x => x.VehicleId).HasDatabaseName("idx_telemetry_events_vehicle_id");
            entity.HasIndex(x => x.Ts).HasDatabaseName("idx_telemetry_events_ts");
            // Latest-reading-per-vehicle lookups.
            entity.HasIndex(x => new { x.VehicleId, x.Ts }).IsDescending(false, true)
                .HasDatabaseName("idx_telemetry_events_vehicle_ts");
            entity.HasOne<Vehicle>().WithMany().HasForeignKey(x => x.VehicleId)
                .HasConstraintName("telemetry_events_vehicle_id_fkey").OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<UserVerification>(entity =>
        {
            entity.ToTable("user_verifications");
            entity.HasKey(x => x.Id).HasName("user_verifications_pkey");
            entity.Property(x => x.Id).HasColumnName("verification_id").HasDefaultValueSql("gen_random_uuid()");
            entity.Property(x => x.Status).HasDefaultValueSql("'pending'::verification_status").ValueGeneratedNever();
            entity.Property(x => x.ProviderReference).HasMaxLength(255);
            Timestamp(entity.Property(x => x.SubmittedAt));
            Timestamp(entity.Property(x => x.VerifiedAt));
            Timestamp(entity.Property(x => x.CreatedAt)).HasDefaultValueSql("now()");
            entity.HasIndex(x => x.UserId).HasDatabaseName("idx_user_verifications_user_id");
            entity.HasOne<User>().WithMany().HasForeignKey(x => x.UserId)
                .HasConstraintName("user_verifications_user_id_fkey").OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<VehicleIssue>(entity =>
        {
            entity.ToTable("vehicle_issues");
            entity.HasKey(x => x.Id).HasName("vehicle_issues_pkey");
            entity.Property(x => x.Id).HasColumnName("issue_id").HasDefaultValueSql("gen_random_uuid()");
            entity.Property(x => x.Status).HasDefaultValueSql("'reported'::vehicle_issue_status").ValueGeneratedNever();
            Timestamp(entity.Property(x => x.ReportedAt)).HasDefaultValueSql("now()");
            Timestamp(entity.Property(x => x.ResolvedAt));
            Timestamp(entity.Property(x => x.CreatedAt)).HasDefaultValueSql("now()");
            entity.HasIndex(x => x.VehicleId).HasDatabaseName("idx_vehicle_issues_vehicle_id");
            entity.HasIndex(x => x.UserId).HasDatabaseName("idx_vehicle_issues_user_id");
            entity.HasIndex(x => x.RideId).HasDatabaseName("idx_vehicle_issues_ride_id");
            entity.HasIndex(x => x.Status).HasDatabaseName("idx_vehicle_issues_status");
            entity.HasOne<Vehicle>().WithMany().HasForeignKey(x => x.VehicleId)
                .HasConstraintName("vehicle_issues_vehicle_id_fkey").OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<User>().WithMany().HasForeignKey(x => x.UserId)
                .HasConstraintName("vehicle_issues_user_id_fkey").OnDelete(DeleteBehavior.SetNull);
            entity.HasOne<Ride>().WithMany().HasForeignKey(x => x.RideId)
                .HasConstraintName("vehicle_issues_ride_id_fkey").OnDelete(DeleteBehavior.SetNull);
        });

        ApplySnakeCaseColumnNames(modelBuilder);
    }

    private static PropertyBuilder<T> Timestamp<T>(PropertyBuilder<T> property)
    {
        property.HasColumnType("timestamp without time zone").HasConversion(UtcWallClock);
        return property;
    }

    /// <summary>Every column not named explicitly above follows the database's snake_case convention.</summary>
    private static void ApplySnakeCaseColumnNames(ModelBuilder modelBuilder)
    {
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var property in entityType.GetProperties())
            {
                if (property.GetColumnName() == property.Name)
                {
                    property.SetColumnName(ToSnakeCase(property.Name));
                }
            }
        }
    }

    internal static string ToSnakeCase(string name)
    {
        var builder = new StringBuilder(name.Length + 8);
        for (var i = 0; i < name.Length; i++)
        {
            var c = name[i];
            if (char.IsUpper(c))
            {
                if (i > 0) builder.Append('_');
                builder.Append(char.ToLowerInvariant(c));
            }
            else
            {
                builder.Append(c);
            }
        }
        return builder.ToString();
    }
}
