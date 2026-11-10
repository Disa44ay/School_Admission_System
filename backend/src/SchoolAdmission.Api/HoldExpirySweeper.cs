using Npgsql;

namespace SchoolAdmission.Api;

// Keeps stored statuses correct. Seat counts never wait for it: they already ignore past-due HELD rows.
// Safe to run in several API processes at once; the UPDATE is idempotent.
public class HoldExpirySweeper(NpgsqlDataSource db, ILogger<HoldExpirySweeper> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(1));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await using var cmd = db.CreateCommand(
                    "UPDATE holds SET status = 'EXPIRED', updated_at = NOW() WHERE status = 'HELD' AND expires_at <= NOW()");
                var n = await cmd.ExecuteNonQueryAsync(stoppingToken);
                if (n > 0) log.LogInformation("Expired {Count} hold(s)", n);
            }
            catch (Exception e) when (e is not OperationCanceledException)
            {
                // A database outage must not stop the sweeper; try again next tick.
                log.LogWarning(e, "Hold expiry sweep failed");
            }
        }
    }
}
