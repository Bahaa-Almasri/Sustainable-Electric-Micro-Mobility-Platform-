using System;
using MicroMobility.Models;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace MicroMobility.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:Enum:charge_type", "unlock_fee,usage_fee,pause_fee,parking_penalty,damage_penalty,adjustment")
                .Annotation("Npgsql:Enum:payment_status", "pending,authorized,paid,failed,refunded")
                .Annotation("Npgsql:Enum:reservation_status", "active,expired,cancelled,converted_to_ride")
                .Annotation("Npgsql:Enum:ride_event_type", "ride_requested,ride_started,ride_paused,ride_resumed,ride_ended,ride_cancelled,unlock_failed,payment_initiated,payment_failed")
                .Annotation("Npgsql:Enum:ride_status", "reserved,started,paused,completed,cancelled,failed")
                .Annotation("Npgsql:Enum:station_status", "active,inactive,full,maintenance")
                .Annotation("Npgsql:Enum:telemetry_event_type", "heartbeat,location_update,battery_update,lock_update,ride_event,fault")
                .Annotation("Npgsql:Enum:ticket_category", "payment,vehicle_issue,ride_issue,account,other")
                .Annotation("Npgsql:Enum:ticket_priority", "low,medium,high,urgent")
                .Annotation("Npgsql:Enum:ticket_status", "open,in_progress,resolved,closed")
                .Annotation("Npgsql:Enum:user_verification_type", "identity,driver_license,student_id")
                .Annotation("Npgsql:Enum:vehicle_availability_status", "available,reserved,in_use,unavailable")
                .Annotation("Npgsql:Enum:vehicle_issue_status", "reported,under_review,resolved,dismissed")
                .Annotation("Npgsql:Enum:vehicle_issue_type", "battery,brake,tire,motor,gps,lock,physical_damage,other")
                .Annotation("Npgsql:Enum:vehicle_operational_status", "healthy,low_battery,charging,maintenance,offline,damaged")
                .Annotation("Npgsql:Enum:vehicle_type", "scooter,bike,ebike,car")
                .Annotation("Npgsql:Enum:verification_status", "pending,approved,rejected,expired")
                .Annotation("Npgsql:PostgresExtension:pgcrypto", ",,");

            migrationBuilder.CreateTable(
                name: "ride_packages",
                columns: table => new
                {
                    package_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    title = table.Column<string>(type: "text", nullable: true),
                    description = table.Column<string>(type: "text", nullable: true),
                    ride_credits = table.Column<int>(type: "integer", nullable: true),
                    price = table.Column<decimal>(type: "numeric", nullable: true),
                    currency = table.Column<string>(type: "text", nullable: true, defaultValueSql: "'USD'::text"),
                    is_active = table.Column<bool>(type: "boolean", nullable: true, defaultValueSql: "true")
                },
                constraints: table =>
                {
                    table.PrimaryKey("ride_packages_pkey", x => x.package_id);
                });

            migrationBuilder.CreateTable(
                name: "stations",
                columns: table => new
                {
                    station_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    lat = table.Column<double>(type: "double precision", nullable: false),
                    lng = table.Column<double>(type: "double precision", nullable: false),
                    capacity = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<StationStatus>(type: "station_status", nullable: false, defaultValueSql: "'active'::station_status"),
                    created_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("stations_pkey", x => x.station_id);
                    table.CheckConstraint("stations_capacity_check", "capacity >= 0");
                });

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    user_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    phone_number = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    auth_provider = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false, defaultValueSql: "true"),
                    password_hash = table.Column<string>(type: "text", nullable: true),
                    status = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("users_pkey", x => x.user_id);
                });

            migrationBuilder.CreateTable(
                name: "vehicle_pricing",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.SerialColumn),
                    vehicle_type = table.Column<string>(type: "text", nullable: false),
                    initial_fee = table.Column<double>(type: "double precision", nullable: false),
                    price_per_minute = table.Column<double>(type: "double precision", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("vehicle_pricing_pkey", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "vehicles",
                columns: table => new
                {
                    vehicle_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    type = table.Column<VehicleType>(type: "vehicle_type", nullable: false),
                    availability_status = table.Column<VehicleAvailabilityStatus>(type: "vehicle_availability_status", nullable: false, defaultValueSql: "'available'::vehicle_availability_status"),
                    operational_status = table.Column<VehicleOperationalStatus>(type: "vehicle_operational_status", nullable: false, defaultValueSql: "'healthy'::vehicle_operational_status"),
                    station_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("vehicles_pkey", x => x.vehicle_id);
                    table.ForeignKey(
                        name: "vehicles_station_id_fkey",
                        column: x => x.station_id,
                        principalTable: "stations",
                        principalColumn: "station_id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "payment_methods",
                columns: table => new
                {
                    method_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    provider = table.Column<string>(type: "text", nullable: true),
                    last_four = table.Column<string>(type: "text", nullable: true),
                    brand = table.Column<string>(type: "text", nullable: true),
                    is_default = table.Column<bool>(type: "boolean", nullable: true, defaultValueSql: "false"),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("payment_methods_pkey", x => x.method_id);
                    table.ForeignKey(
                        name: "payment_methods_user_id_fkey",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "user_package_purchases",
                columns: table => new
                {
                    purchase_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    package_id = table.Column<Guid>(type: "uuid", nullable: false),
                    rides_remaining = table.Column<int>(type: "integer", nullable: true),
                    payment_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("user_package_purchases_pkey", x => x.purchase_id);
                    table.ForeignKey(
                        name: "user_package_purchases_package_id_fkey",
                        column: x => x.package_id,
                        principalTable: "ride_packages",
                        principalColumn: "package_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "user_package_purchases_user_id_fkey",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "user_verifications",
                columns: table => new
                {
                    verification_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    verification_type = table.Column<UserVerificationType>(type: "user_verification_type", nullable: false),
                    status = table.Column<VerificationStatus>(type: "verification_status", nullable: false, defaultValueSql: "'pending'::verification_status"),
                    provider_reference = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    submitted_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    verified_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("user_verifications_pkey", x => x.verification_id);
                    table.ForeignKey(
                        name: "user_verifications_user_id_fkey",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "reservations",
                columns: table => new
                {
                    reservation_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    vehicle_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<ReservationStatus>(type: "reservation_status", nullable: false, defaultValueSql: "'active'::reservation_status"),
                    reserved_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false, defaultValueSql: "now()"),
                    expires_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    cancelled_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("reservations_pkey", x => x.reservation_id);
                    table.CheckConstraint("reservation_expiry_check", "expires_at > reserved_at");
                    table.ForeignKey(
                        name: "reservations_user_id_fkey",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "reservations_vehicle_id_fkey",
                        column: x => x.vehicle_id,
                        principalTable: "vehicles",
                        principalColumn: "vehicle_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "rides",
                columns: table => new
                {
                    ride_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    vehicle_id = table.Column<Guid>(type: "uuid", nullable: false),
                    start_station_id = table.Column<Guid>(type: "uuid", nullable: true),
                    end_station_id = table.Column<Guid>(type: "uuid", nullable: true),
                    status = table.Column<RideStatus>(type: "ride_status", nullable: false, defaultValueSql: "'reserved'::ride_status"),
                    started_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    ended_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    start_lat = table.Column<double>(type: "double precision", nullable: true),
                    start_lng = table.Column<double>(type: "double precision", nullable: true),
                    end_lat = table.Column<double>(type: "double precision", nullable: true),
                    end_lng = table.Column<double>(type: "double precision", nullable: true),
                    distance_meters = table.Column<double>(type: "double precision", nullable: true),
                    duration_seconds = table.Column<int>(type: "integer", nullable: true),
                    total_cost = table.Column<decimal>(type: "numeric", nullable: false, defaultValueSql: "0.00"),
                    initial_fee = table.Column<double>(type: "double precision", nullable: true),
                    price_per_minute = table.Column<double>(type: "double precision", nullable: true),
                    duration_minutes = table.Column<int>(type: "integer", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("rides_pkey", x => x.ride_id);
                    table.CheckConstraint("ride_time_check", "ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at");
                    table.CheckConstraint("rides_distance_meters_check", "distance_meters IS NULL OR distance_meters >= 0");
                    table.CheckConstraint("rides_duration_seconds_check", "duration_seconds IS NULL OR duration_seconds >= 0");
                    table.CheckConstraint("rides_total_cost_check", "total_cost >= 0");
                    table.ForeignKey(
                        name: "rides_end_station_id_fkey",
                        column: x => x.end_station_id,
                        principalTable: "stations",
                        principalColumn: "station_id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "rides_start_station_id_fkey",
                        column: x => x.start_station_id,
                        principalTable: "stations",
                        principalColumn: "station_id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "rides_user_id_fkey",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "rides_vehicle_id_fkey",
                        column: x => x.vehicle_id,
                        principalTable: "vehicles",
                        principalColumn: "vehicle_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "telemetry_events",
                columns: table => new
                {
                    telemetry_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    vehicle_id = table.Column<Guid>(type: "uuid", nullable: false),
                    ts = table.Column<DateTime>(type: "timestamp without time zone", nullable: false, defaultValueSql: "now()"),
                    lat = table.Column<double>(type: "double precision", nullable: true),
                    lng = table.Column<double>(type: "double precision", nullable: true),
                    battery_percent = table.Column<int>(type: "integer", nullable: true),
                    speed = table.Column<double>(type: "double precision", nullable: true),
                    event_type = table.Column<TelemetryEventType>(type: "telemetry_event_type", nullable: false, defaultValueSql: "'heartbeat'::telemetry_event_type"),
                    created_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("telemetry_events_pkey", x => x.telemetry_id);
                    table.CheckConstraint("telemetry_events_battery_percent_check", "battery_percent >= 0 AND battery_percent <= 100");
                    table.CheckConstraint("telemetry_events_speed_check", "speed IS NULL OR speed >= 0");
                    table.ForeignKey(
                        name: "telemetry_events_vehicle_id_fkey",
                        column: x => x.vehicle_id,
                        principalTable: "vehicles",
                        principalColumn: "vehicle_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "vehicle_current_state",
                columns: table => new
                {
                    vehicle_id = table.Column<Guid>(type: "uuid", nullable: false),
                    current_lat = table.Column<double>(type: "double precision", nullable: true),
                    current_lng = table.Column<double>(type: "double precision", nullable: true),
                    current_battery_percent = table.Column<int>(type: "integer", nullable: true),
                    last_seen_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    is_locked = table.Column<bool>(type: "boolean", nullable: false, defaultValueSql: "true"),
                    updated_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("vehicle_current_state_pkey", x => x.vehicle_id);
                    table.CheckConstraint("vehicle_current_state_current_battery_percent_check", "current_battery_percent >= 0 AND current_battery_percent <= 100");
                    table.ForeignKey(
                        name: "vehicle_current_state_vehicle_id_fkey",
                        column: x => x.vehicle_id,
                        principalTable: "vehicles",
                        principalColumn: "vehicle_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "payments",
                columns: table => new
                {
                    payment_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    ride_id = table.Column<Guid>(type: "uuid", nullable: false),
                    amount = table.Column<decimal>(type: "numeric", nullable: false),
                    currency = table.Column<string>(type: "character(3)", nullable: false, defaultValueSql: "'USD'::bpchar"),
                    status = table.Column<PaymentStatus>(type: "payment_status", nullable: false, defaultValueSql: "'pending'::payment_status"),
                    provider = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    provider_payment_reference = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    failure_reason = table.Column<string>(type: "text", nullable: true),
                    paid_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("payments_pkey", x => x.payment_id);
                    table.CheckConstraint("payments_amount_check", "amount >= 0");
                    table.ForeignKey(
                        name: "payments_ride_id_fkey",
                        column: x => x.ride_id,
                        principalTable: "rides",
                        principalColumn: "ride_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "payments_user_id_fkey",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ride_charges",
                columns: table => new
                {
                    charge_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    ride_id = table.Column<Guid>(type: "uuid", nullable: false),
                    charge_type = table.Column<ChargeType>(type: "charge_type", nullable: false),
                    amount = table.Column<decimal>(type: "numeric", nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("ride_charges_pkey", x => x.charge_id);
                    table.CheckConstraint("ride_charges_amount_check", "amount >= 0");
                    table.ForeignKey(
                        name: "ride_charges_ride_id_fkey",
                        column: x => x.ride_id,
                        principalTable: "rides",
                        principalColumn: "ride_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ride_events",
                columns: table => new
                {
                    ride_event_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    ride_id = table.Column<Guid>(type: "uuid", nullable: false),
                    event_type = table.Column<RideEventType>(type: "ride_event_type", nullable: false),
                    metadata_json = table.Column<string>(type: "jsonb", nullable: true),
                    event_time = table.Column<DateTime>(type: "timestamp without time zone", nullable: false, defaultValueSql: "now()"),
                    created_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("ride_events_pkey", x => x.ride_event_id);
                    table.ForeignKey(
                        name: "ride_events_ride_id_fkey",
                        column: x => x.ride_id,
                        principalTable: "rides",
                        principalColumn: "ride_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "support_tickets",
                columns: table => new
                {
                    ticket_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    ride_id = table.Column<Guid>(type: "uuid", nullable: true),
                    category = table.Column<TicketCategory>(type: "ticket_category", nullable: false),
                    priority = table.Column<TicketPriority>(type: "ticket_priority", nullable: false, defaultValueSql: "'medium'::ticket_priority"),
                    status = table.Column<TicketStatus>(type: "ticket_status", nullable: false, defaultValueSql: "'open'::ticket_status"),
                    title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    description = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false, defaultValueSql: "now()"),
                    resolved_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("support_tickets_pkey", x => x.ticket_id);
                    table.ForeignKey(
                        name: "support_tickets_ride_id_fkey",
                        column: x => x.ride_id,
                        principalTable: "rides",
                        principalColumn: "ride_id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "support_tickets_user_id_fkey",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "vehicle_issues",
                columns: table => new
                {
                    issue_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    vehicle_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    ride_id = table.Column<Guid>(type: "uuid", nullable: true),
                    issue_type = table.Column<VehicleIssueType>(type: "vehicle_issue_type", nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    status = table.Column<VehicleIssueStatus>(type: "vehicle_issue_status", nullable: false, defaultValueSql: "'reported'::vehicle_issue_status"),
                    reported_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false, defaultValueSql: "now()"),
                    resolved_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp without time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("vehicle_issues_pkey", x => x.issue_id);
                    table.ForeignKey(
                        name: "vehicle_issues_ride_id_fkey",
                        column: x => x.ride_id,
                        principalTable: "rides",
                        principalColumn: "ride_id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "vehicle_issues_user_id_fkey",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "vehicle_issues_vehicle_id_fkey",
                        column: x => x.vehicle_id,
                        principalTable: "vehicles",
                        principalColumn: "vehicle_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_payment_methods_user_id",
                table: "payment_methods",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "idx_payments_provider_reference",
                table: "payments",
                column: "provider_payment_reference");

            migrationBuilder.CreateIndex(
                name: "idx_payments_ride_id",
                table: "payments",
                column: "ride_id");

            migrationBuilder.CreateIndex(
                name: "idx_payments_status",
                table: "payments",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "idx_payments_user_id",
                table: "payments",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "idx_reservations_expires_at",
                table: "reservations",
                column: "expires_at");

            migrationBuilder.CreateIndex(
                name: "idx_reservations_status",
                table: "reservations",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "idx_reservations_user_id",
                table: "reservations",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "idx_reservations_vehicle_id",
                table: "reservations",
                column: "vehicle_id");

            migrationBuilder.CreateIndex(
                name: "idx_ride_charges_ride_id",
                table: "ride_charges",
                column: "ride_id");

            migrationBuilder.CreateIndex(
                name: "idx_ride_events_event_time",
                table: "ride_events",
                column: "event_time");

            migrationBuilder.CreateIndex(
                name: "idx_ride_events_event_type",
                table: "ride_events",
                column: "event_type");

            migrationBuilder.CreateIndex(
                name: "idx_ride_events_ride_id",
                table: "ride_events",
                column: "ride_id");

            migrationBuilder.CreateIndex(
                name: "idx_rides_started_at",
                table: "rides",
                column: "started_at");

            migrationBuilder.CreateIndex(
                name: "idx_rides_status",
                table: "rides",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "idx_rides_user_id",
                table: "rides",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "idx_rides_vehicle_id",
                table: "rides",
                column: "vehicle_id");

            migrationBuilder.CreateIndex(
                name: "IX_rides_end_station_id",
                table: "rides",
                column: "end_station_id");

            migrationBuilder.CreateIndex(
                name: "IX_rides_start_station_id",
                table: "rides",
                column: "start_station_id");

            migrationBuilder.CreateIndex(
                name: "idx_support_tickets_category",
                table: "support_tickets",
                column: "category");

            migrationBuilder.CreateIndex(
                name: "idx_support_tickets_ride_id",
                table: "support_tickets",
                column: "ride_id");

            migrationBuilder.CreateIndex(
                name: "idx_support_tickets_status",
                table: "support_tickets",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "idx_support_tickets_user_id",
                table: "support_tickets",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "idx_telemetry_events_ts",
                table: "telemetry_events",
                column: "ts");

            migrationBuilder.CreateIndex(
                name: "idx_telemetry_events_vehicle_id",
                table: "telemetry_events",
                column: "vehicle_id");

            migrationBuilder.CreateIndex(
                name: "idx_telemetry_events_vehicle_ts",
                table: "telemetry_events",
                columns: new[] { "vehicle_id", "ts" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "IX_user_package_purchases_package_id",
                table: "user_package_purchases",
                column: "package_id");

            migrationBuilder.CreateIndex(
                name: "IX_user_package_purchases_user_id",
                table: "user_package_purchases",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "idx_user_verifications_user_id",
                table: "user_verifications",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "users_email_key",
                table: "users",
                column: "email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_vehicle_issues_ride_id",
                table: "vehicle_issues",
                column: "ride_id");

            migrationBuilder.CreateIndex(
                name: "idx_vehicle_issues_status",
                table: "vehicle_issues",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "idx_vehicle_issues_user_id",
                table: "vehicle_issues",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "idx_vehicle_issues_vehicle_id",
                table: "vehicle_issues",
                column: "vehicle_id");

            migrationBuilder.CreateIndex(
                name: "vehicle_pricing_vehicle_type_key",
                table: "vehicle_pricing",
                column: "vehicle_type",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_vehicles_availability_status",
                table: "vehicles",
                column: "availability_status");

            migrationBuilder.CreateIndex(
                name: "idx_vehicles_operational_status",
                table: "vehicles",
                column: "operational_status");

            migrationBuilder.CreateIndex(
                name: "idx_vehicles_station_id",
                table: "vehicles",
                column: "station_id");

            // Hand-written (EF cannot model triggers): keeps updated_at current on every UPDATE,
            // exactly as the trigger function in the live Neon database does.
            migrationBuilder.Sql("""
                CREATE OR REPLACE FUNCTION public.set_updated_at()
                 RETURNS trigger
                 LANGUAGE plpgsql
                AS $function$
                BEGIN
                  NEW.updated_at = NOW();
                  RETURN NEW;
                END;
                $function$;
                """);

            foreach (var table in UpdatedAtTables)
            {
                migrationBuilder.Sql(
                    $"CREATE TRIGGER trg_{table}_updated_at BEFORE UPDATE ON public.{table} " +
                    "FOR EACH ROW EXECUTE FUNCTION set_updated_at();");
            }
        }

        private static readonly string[] UpdatedAtTables =
            ["stations", "vehicles", "vehicle_current_state", "support_tickets", "payments", "rides", "users"];

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            foreach (var table in UpdatedAtTables)
            {
                migrationBuilder.Sql($"DROP TRIGGER IF EXISTS trg_{table}_updated_at ON public.{table};");
            }
            migrationBuilder.Sql("DROP FUNCTION IF EXISTS public.set_updated_at();");

            migrationBuilder.DropTable(
                name: "payment_methods");

            migrationBuilder.DropTable(
                name: "payments");

            migrationBuilder.DropTable(
                name: "reservations");

            migrationBuilder.DropTable(
                name: "ride_charges");

            migrationBuilder.DropTable(
                name: "ride_events");

            migrationBuilder.DropTable(
                name: "support_tickets");

            migrationBuilder.DropTable(
                name: "telemetry_events");

            migrationBuilder.DropTable(
                name: "user_package_purchases");

            migrationBuilder.DropTable(
                name: "user_verifications");

            migrationBuilder.DropTable(
                name: "vehicle_current_state");

            migrationBuilder.DropTable(
                name: "vehicle_issues");

            migrationBuilder.DropTable(
                name: "vehicle_pricing");

            migrationBuilder.DropTable(
                name: "ride_packages");

            migrationBuilder.DropTable(
                name: "rides");

            migrationBuilder.DropTable(
                name: "users");

            migrationBuilder.DropTable(
                name: "vehicles");

            migrationBuilder.DropTable(
                name: "stations");
        }
    }
}
