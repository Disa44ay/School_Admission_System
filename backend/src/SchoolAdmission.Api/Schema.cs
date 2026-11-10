using Npgsql;

namespace SchoolAdmission.Api;

// Schema from ASSUMPTIONS.md. Idempotent, so every API process can run it at startup.
public static class Schema
{
    // Any fixed number works; it only has to be the same in every process.
    private const long AdvisoryLockKey = 20261110;

    private const string Ddl = """
        CREATE TABLE IF NOT EXISTS classes (
            id          VARCHAR(64)  PRIMARY KEY,
            name        VARCHAR(200) NOT NULL,
            total_seats INTEGER      NOT NULL CHECK (total_seats > 0),
            created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS holds (
            id          VARCHAR(64)  PRIMARY KEY,
            class_id    VARCHAR(64)  NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
            student_id  CHAR(17)     NOT NULL CHECK (student_id ~ '^[0-9]{17}$'),
            status      VARCHAR(16)  NOT NULL CHECK (status IN ('HELD', 'CONFIRMED', 'EXPIRED', 'CANCELLED')),
            expires_at  TIMESTAMPTZ  NOT NULL,
            created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_holds_one_active_per_student_class
            ON holds (class_id, student_id) WHERE status IN ('HELD', 'CONFIRMED');
        CREATE INDEX IF NOT EXISTS idx_holds_class_status_expires ON holds (class_id, status, expires_at);
        CREATE INDEX IF NOT EXISTS idx_holds_student_id ON holds (student_id, created_at DESC);
        """;

    public static async Task EnsureAsync(NpgsqlDataSource db)
    {
        await using var conn = await db.OpenConnectionAsync();
        await using var tx = await conn.BeginTransactionAsync();
        // Two API processes starting together would race on CREATE ... IF NOT EXISTS; the lock serialises them.
        await using (var lockCmd = new NpgsqlCommand($"SELECT pg_advisory_xact_lock({AdvisoryLockKey})", conn, tx))
            await lockCmd.ExecuteNonQueryAsync();
        await using (var ddl = new NpgsqlCommand(Ddl, conn, tx))
            await ddl.ExecuteNonQueryAsync();
        await tx.CommitAsync();
    }
}
