using Microsoft.AspNetCore.Mvc.Testing;
using Npgsql;

namespace backend.Tests;

// One throwaway database per test run, dropped at the end.
// TEST_POSTGRES points at the server (compose sets it to the db service; local default below).
public sealed class DatabaseFixture : IAsyncLifetime
{
    private readonly string _server =
        Environment.GetEnvironmentVariable("TEST_POSTGRES") ?? "Host=localhost;Port=5432;Username=postgres;Password=postgres";
    private readonly List<string> _databases = [];

    public string ConnectionString { get; private set; } = "";
    public WebApplicationFactory<Program> Factory { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        ConnectionString = await CreateDatabaseAsync();
        // Program reads the connection string while building, so set it before the factory starts the app.
        Environment.SetEnvironmentVariable("ConnectionStrings__DefaultConnection", ConnectionString);
        Factory = new WebApplicationFactory<Program>();
    }

    public async Task<string> CreateDatabaseAsync()
    {
        var name = $"sa_test_{Guid.NewGuid():N}";
        await ExecAsync($"CREATE DATABASE {name}");
        _databases.Add(name);
        return $"{_server};Database={name}";
    }

    public async Task DisposeAsync()
    {
        await Factory.DisposeAsync();
        NpgsqlConnection.ClearAllPools();
        foreach (var name in _databases)
            await ExecAsync($"DROP DATABASE IF EXISTS {name} WITH (FORCE)");
    }

    private async Task ExecAsync(string sql)
    {
        await using var conn = new NpgsqlConnection(_server);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand(sql, conn);
        await cmd.ExecuteNonQueryAsync();
    }
}

[CollectionDefinition("db")]
public class DbCollection : ICollectionFixture<DatabaseFixture>;
