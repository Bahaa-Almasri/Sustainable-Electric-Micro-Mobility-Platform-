# One image, two roles. Which role a container plays is decided entirely by environment:
#   docker run -e Hangfire__Server__Enabled=false -e SignalR__HostHub=true  micromobility   # web
#   docker run -e Hangfire__Server__Enabled=true  -e SignalR__HostHub=false micromobility   # worker
# A single container with the defaults does both. Run once with --migrate-only before a rollout.
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
# Restore against the project file alone so this layer only invalidates on a dependency change.
COPY MicroMobility/MicroMobility.csproj MicroMobility/
RUN dotnet restore MicroMobility/MicroMobility.csproj
COPY MicroMobility/ MicroMobility/
RUN dotnet publish MicroMobility/MicroMobility.csproj -c Release -o /app/publish --no-restore /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/publish .
# The non-root user the base image ships with.
USER app
ENV App__Url=http://0.0.0.0:8000
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=6 \
    CMD curl --fail --silent http://127.0.0.1:8000/health > /dev/null || exit 1
ENTRYPOINT ["dotnet", "MicroMobility.dll"]
