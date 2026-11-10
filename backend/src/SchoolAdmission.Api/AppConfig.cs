using Npgsql;

namespace SchoolAdmission.Api;

public static class AppConfig
{
    public const int DefaultHoldDurationSeconds = 600;
    private const string DefaultConnectionString =
        "Host=db;Port=5432;Database=school_admission;Username=postgres;Password=postgres";

    // First one set wins: DATABASE_CONNECTION_STRING, DATABASE_URL, ConnectionStrings:DefaultConnection, compose default.
    public static string ConnectionString(IConfiguration config)
    {
        if (config["DATABASE_CONNECTION_STRING"] is { Length: > 0 } cs) return cs;
        if (config["DATABASE_URL"] is { Length: > 0 } url) return FromDatabaseUrl(url);
        if (config.GetConnectionString("DefaultConnection") is { Length: > 0 } def) return def;
        return DefaultConnectionString;
    }

    // postgres://user:pass@host:port/db -> Npgsql connection string.
    // shortcut: query options such as ?sslmode=require are ignored; add them if a hosted database needs TLS.
    public static string FromDatabaseUrl(string url)
    {
        var uri = new Uri(url);
        if (uri.Scheme is not ("postgres" or "postgresql"))
            throw new InvalidOperationException("DATABASE_URL must start with postgres:// or postgresql://");
        var userInfo = uri.UserInfo.Split(':', 2);
        return new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.IsDefaultPort || uri.Port <= 0 ? 5432 : uri.Port,
            Database = Uri.UnescapeDataString(uri.AbsolutePath.TrimStart('/')),
            Username = Uri.UnescapeDataString(userInfo[0]),
            Password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : null,
        }.ConnectionString;
    }

    // Missing, non-numeric, or <= 0 falls back to 600.
    public static int HoldDurationSeconds(IConfiguration config) =>
        int.TryParse(config["HOLD_DURATION_SECONDS"], out var s) && s > 0 ? s : DefaultHoldDurationSeconds;
}
