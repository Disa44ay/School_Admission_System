using Microsoft.Extensions.Configuration;
using SchoolAdmission.Api;

namespace backend.Tests;

public class ConfigTests
{
    private static IConfiguration Config(params (string Key, string? Value)[] pairs) =>
        new ConfigurationBuilder().AddInMemoryCollection(pairs.Select(p => KeyValuePair.Create(p.Key, p.Value))).Build();

    [Theory]
    [InlineData(null, 600)]
    [InlineData("", 600)]
    [InlineData("abc", 600)]
    [InlineData("0", 600)]
    [InlineData("-5", 600)]
    [InlineData("2", 2)]
    [InlineData("600", 600)]
    public void Hold_duration_falls_back_to_600(string? value, int expected) =>
        Assert.Equal(expected, AppConfig.HoldDurationSeconds(Config(("HOLD_DURATION_SECONDS", value))));

    [Fact]
    public void Connection_string_precedence()
    {
        Assert.Equal("A", AppConfig.ConnectionString(Config(
            ("DATABASE_CONNECTION_STRING", "A"), ("DATABASE_URL", "postgres://u:p@h/d"), ("ConnectionStrings:DefaultConnection", "C"))));
        Assert.Contains("Host=h", AppConfig.ConnectionString(Config(
            ("DATABASE_CONNECTION_STRING", ""), ("DATABASE_URL", "postgres://u:p@h/d"), ("ConnectionStrings:DefaultConnection", "C"))));
        Assert.Equal("C", AppConfig.ConnectionString(Config(("DATABASE_URL", ""), ("ConnectionStrings:DefaultConnection", "C"))));
        Assert.Contains("Host=db", AppConfig.ConnectionString(Config()));
    }

    [Fact]
    public void Database_url_is_converted()
    {
        var cs = AppConfig.FromDatabaseUrl("postgresql://admin:p%40ss%3Aword@pg.local:6543/my_db");
        var b = new Npgsql.NpgsqlConnectionStringBuilder(cs);
        Assert.Equal(("pg.local", 6543, "my_db", "admin", "p@ss:word"), (b.Host, b.Port, b.Database, b.Username, b.Password));
        Assert.Equal(5432, new Npgsql.NpgsqlConnectionStringBuilder(AppConfig.FromDatabaseUrl("postgres://u:p@h/d")).Port);
        Assert.Throws<InvalidOperationException>(() => AppConfig.FromDatabaseUrl("mysql://u:p@h/d"));
    }
}
